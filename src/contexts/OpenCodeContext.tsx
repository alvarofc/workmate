import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { createOpencodeClient } from "@opencode-ai/sdk/client";
import {
  startOpenCodeServer,
  stopOpenCodeServer,
  getOpenCodeStatus,
  checkOpenCodeInstalled,
  type ServerInfo,
  type OpenCodeConfig,
} from "@/lib/tauri";
import { useAppStore } from "@/stores/appStore";
import type { PermissionRequest, Message, MessagePart } from "@/types";

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

interface OpenCodeContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  serverInfo: ServerInfo | null;
  error: string | null;
  
  // OpenCode availability
  isInstalled: boolean;
  
  // Client instance
  client: OpenCodeClient | null;
  
  // Actions
  connect: (projectPath: string) => Promise<void>;
  disconnect: () => Promise<void>;
  authorizeProvider: (providerId: string) => Promise<void>;
  setProviderKey: (providerId: string, key: string) => Promise<void>;
  
  // Session management
  currentSessionId: string | null;
  createSession: (title?: string) => Promise<string>;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (text: string, files?: File[]) => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  abortSession: () => Promise<void>;
  
  // Permissions
  respondToPermission: (permissionId: string, approved: boolean, remember?: boolean) => Promise<void>;
}

const OpenCodeContext = createContext<OpenCodeContextValue | null>(null);

export function OpenCodeProvider({ children }: { children: ReactNode }) {
  const { 
    config, 
    addMessage, 
    updateMessage,
    setLoading,
    setPendingPermission,
    setSessions,
    setMessages,
    setProviders,
  } = useAppStore();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const clientRef = useRef<OpenCodeClient | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  // Track user message IDs to avoid treating their parts as assistant messages
  const userMessageIdsRef = useRef<Set<string>>(new Set());
  // Track if we're in a pending session (just created, don't clear messages)
  const pendingSessionIdRef = useRef<string | null>(null);
  // Track setError for use in handleEvent
  const setErrorRef = useRef(setError);
  setErrorRef.current = setError;

  // Check if OpenCode is installed on mount
  useEffect(() => {
    checkOpenCodeInstalled()
      .then(setIsInstalled)
      .catch(() => setIsInstalled(false));
  }, []);

  // Handle incoming events from OpenCode
  const handleEvent = useCallback((event: { type: string; properties?: Record<string, unknown> }) => {
    // Log events for debugging
    console.log(`[SSE] ${event.type}:`, JSON.stringify(event.properties, null, 2));
    
    switch (event.type) {
      case "permission.request": {
        const props = event.properties as {
          id: string;
          type: string;
          description: string;
          path?: string;
          command?: string;
          diff?: string;
        };
        
        const permissionRequest: PermissionRequest = {
          id: props.id,
          type: props.type as PermissionRequest["type"],
          description: props.description,
          details: {
            path: props.path,
            command: props.command,
            diff: props.diff,
          },
        };
        setPendingPermission(permissionRequest);
        break;
      }

      case "message.created":
      case "message.updated": {
        // Structure: event.properties.info.{id, role, sessionID, ...}
        const props = event.properties as any;
        const msg = props.info || props;
        
        console.log("[SSE] message - role:", msg.role, "id:", msg.id);
        
        // Track user message IDs so we don't process their parts as assistant
        if (msg.role === "user") {
          userMessageIdsRef.current.add(msg.id);
        }
        
        // Only create assistant messages (user messages added optimistically)
        if (msg.role === "assistant") {
          const existingMessage = useAppStore.getState().messages.find(m => m.id === msg.id);
          if (!existingMessage) {
            lastMessageIdRef.current = msg.id;
            addMessage({
              id: msg.id,
              role: "assistant",
              content: "",
              timestamp: msg.time?.created || Date.now(),
              status: "streaming",
              parts: [],
            });
            console.log("[SSE] Created assistant message:", msg.id);
          } else {
            lastMessageIdRef.current = msg.id;
          }
        }
        break;
      }

      case "message.part.updated": {
        const props = event.properties as any;
        const part = props.part;
        
        // Structure: part.{id, sessionID, messageID, type, ...}
        const messageId = part?.messageID;
        
        console.log("[SSE] part.updated - messageId:", messageId, "type:", part?.type);
        
        // Skip user message parts (we already added the user message optimistically)
        if (messageId && userMessageIdsRef.current.has(messageId)) {
          console.log("[SSE] Skipping user message part");
          break;
        }
        
        // Ensure we have an assistant message to update
        if (messageId && !lastMessageIdRef.current) {
          const existingMessage = useAppStore.getState().messages.find(m => m.id === messageId);
          if (!existingMessage) {
            lastMessageIdRef.current = messageId;
            addMessage({
              id: messageId,
              role: "assistant",
              content: "",
              timestamp: Date.now(),
              status: "streaming",
              parts: [],
            });
            console.log("[SSE] Created assistant from part:", messageId);
          } else {
            lastMessageIdRef.current = messageId;
          }
        }
        
        const targetId = lastMessageIdRef.current || messageId;
        if (!targetId) break;
        
        // Get current message to append parts
        const currentMessage = useAppStore.getState().messages.find(m => m.id === targetId);
        const currentParts = currentMessage?.parts || [];
        
        if (part?.type === "text") {
          // Update or add text part
          const textPartIndex = currentParts.findIndex(p => p.type === "text" && p.id === part.id);
          let newParts: MessagePart[];
          
          if (textPartIndex >= 0) {
            // Update existing text part
            newParts = [...currentParts];
            newParts[textPartIndex] = { 
              type: "text", 
              content: part.text || "",
              id: part.id,
            };
          } else {
            // Add new text part
            newParts = [...currentParts, { 
              type: "text", 
              content: part.text || "",
              id: part.id,
            }];
          }
          
          // Combine all text content
          const textContent = newParts
            .filter(p => p.type === "text")
            .map(p => p.content)
            .join("\n");
          
          updateMessage(targetId, {
            content: textContent,
            status: "streaming",
            parts: newParts,
          });
        } else if (part?.type === "reasoning") {
          // Handle reasoning part
          const partIndex = currentParts.findIndex(p => p.type === "reasoning" && p.id === part.id);
          let newParts: MessagePart[];
          
          if (partIndex >= 0) {
            newParts = [...currentParts];
            newParts[partIndex] = { 
              type: "reasoning", 
              content: part.text || "",
              id: part.id,
            };
          } else {
            newParts = [...currentParts, { 
              type: "reasoning", 
              content: part.text || "",
              id: part.id,
            }];
          }
          
          updateMessage(targetId, {
            status: "streaming",
            parts: newParts,
          });
        } else if (part?.type === "tool") {
          // Handle tool invocation/result
          const toolState = part.state;
          const toolName = part.tool;
          
          console.log("[SSE] Tool part:", toolName, "status:", toolState?.status);
          
          // Find existing tool part or add new one
          const toolPartIndex = currentParts.findIndex(p => 
            (p.type === "tool_use" || p.type === "tool_result") && p.id === part.id
          );
          
          let newPart: MessagePart;
          if (toolState?.status === "completed") {
            // Parse output - try to determine if it's JSON
            let outputContent = "";
            let outputObj: unknown = toolState.output;
            
            if (typeof toolState.output === "string") {
              try {
                outputObj = JSON.parse(toolState.output);
                outputContent = JSON.stringify(outputObj, null, 2);
              } catch {
                outputContent = toolState.output;
              }
            } else if (toolState.output) {
              outputContent = JSON.stringify(toolState.output, null, 2);
            }
            
            newPart = {
              type: "tool_result",
              id: part.id,
              toolName: toolName,
              content: outputContent,
              toolInput: toolState?.input as Record<string, unknown>,
              toolOutput: outputObj,
              status: "completed",
            };
          } else if (toolState?.status === "error") {
            newPart = {
              type: "tool_result",
              id: part.id,
              toolName: toolName,
              content: "",
              toolInput: toolState?.input as Record<string, unknown>,
              toolError: toolState.error || "Tool execution failed",
              status: "error",
            };
          } else {
            newPart = {
              type: "tool_use",
              id: part.id,
              toolName: toolName,
              content: JSON.stringify(toolState?.input || {}, null, 2),
              toolInput: toolState?.input as Record<string, unknown>,
              status: toolState?.status as MessagePart["status"],
            };
          }
          
          let newParts: MessagePart[];
          if (toolPartIndex >= 0) {
            newParts = [...currentParts];
            newParts[toolPartIndex] = newPart;
          } else {
            newParts = [...currentParts, newPart];
          }
          
          updateMessage(targetId, {
            status: "streaming",
            parts: newParts,
          });
        }
        break;
      }

      case "session.status": {
        const props = event.properties as any;
        console.log("[SSE] session.status:", props.status?.type);
        
        if (props.status?.type === "busy") {
          // Ensure loading is set while busy
          setLoading(true);
        } else if (props.status?.type === "idle") {
          if (lastMessageIdRef.current) {
            updateMessage(lastMessageIdRef.current, { status: "complete" });
            lastMessageIdRef.current = null;
          }
          pendingSessionIdRef.current = null;
          setLoading(false);
        }
        break;
      }

      case "session.idle":
      case "run.completed":
      case "run.failed":
        if (lastMessageIdRef.current) {
          updateMessage(lastMessageIdRef.current, { status: "complete" });
          lastMessageIdRef.current = null;
        }
        pendingSessionIdRef.current = null;
        setLoading(false);
        break;

      case "session.error": {
        const props = event.properties as any;
        console.error("[SSE] Session error:", props);
        setErrorRef.current(props.message || props.error || "Session error occurred");
        if (lastMessageIdRef.current) {
          updateMessage(lastMessageIdRef.current, { status: "complete" });
          lastMessageIdRef.current = null;
        }
        pendingSessionIdRef.current = null;
        setLoading(false);
        break;
      }

      case "session.created": {
        // Add new session to the list
        const props = event.properties as any;
        const sessionInfo = props.info;
        if (sessionInfo) {
          const newSession = {
            id: sessionInfo.id,
            title: sessionInfo.title || "New Chat",
            createdAt: sessionInfo.time?.created || Date.now(),
            updatedAt: sessionInfo.time?.updated || Date.now(),
            messageCount: 0,
          };
          // Add to sessions if not already present
          const existingSessions = useAppStore.getState().sessions;
          if (!existingSessions.find(s => s.id === sessionInfo.id)) {
            setSessions([newSession, ...existingSessions]);
            console.log("[SSE] Added new session:", sessionInfo.id);
          }
        }
        break;
      }

      case "session.updated": {
        // Update existing session in the list
        const props = event.properties as any;
        const sessionInfo = props.info;
        if (sessionInfo) {
          const existingSessions = useAppStore.getState().sessions;
          const updatedSessions = existingSessions.map(s => 
            s.id === sessionInfo.id 
              ? {
                  ...s,
                  title: sessionInfo.title || s.title,
                  updatedAt: sessionInfo.time?.updated || Date.now(),
                }
              : s
          );
          // If session wasn't found, add it
          if (!existingSessions.find(s => s.id === sessionInfo.id)) {
            updatedSessions.unshift({
              id: sessionInfo.id,
              title: sessionInfo.title || "New Chat",
              createdAt: sessionInfo.time?.created || Date.now(),
              updatedAt: sessionInfo.time?.updated || Date.now(),
              messageCount: 0,
            });
          }
          setSessions(updatedSessions);
        }
        break;
      }

      case "server.heartbeat":
      case "server.connected":
        // Ignore these events
        break;

      default:
        console.debug("[SSE] Unknown event:", event.type, event.properties);
    }
  }, [setPendingPermission, addMessage, updateMessage, setLoading, setSessions]);

  // Subscribe to OpenCode events (SSE)
  const subscribeToEvents = useCallback((serverUrl: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${serverUrl}/event`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch (err) {
        console.error("Failed to parse event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [handleEvent]);

  // Load messages for a session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const client = clientRef.current;
    if (!client) return;

    // Don't clear messages for a newly created session
    if (pendingSessionIdRef.current === sessionId) {
      console.log("[loadSessionMessages] Skipping for pending session:", sessionId);
      return;
    }

    try {
      setLoading(true);
      const response = await client.session.messages({
        path: { id: sessionId }
      });

      if (response.data) {
        console.log("[loadSessionMessages] Raw API response:", JSON.stringify(response.data, null, 2));
        const messages: Message[] = (response.data as any[]).map((item: any) => {
          // Handle both structure types: { info: Message, parts: Part[] } or just Message
          const info = item.info || item;
          const rawParts = item.parts || info.parts || [];
          
          console.log("[loadSessionMessages] Processing message:", info.id, "role:", info.role);
          
          // Map parts from API format to our MessagePart format
          const parts: MessagePart[] = rawParts.map((p: any, index: number) => {
            // Handle different part types from the API
            if (p.type === "text") {
              return {
                type: "text" as const,
                id: p.id || `${info.id}-text-${index}`,
                content: p.text || "",
              };
            } else if (p.type === "tool") {
              // Tool parts from API have state info
              const toolState = p.state || {};
              const isCompleted = toolState.status === "completed";
              const isError = toolState.status === "error";
              
              return {
                type: isCompleted || isError ? "tool_result" as const : "tool_use" as const,
                id: p.id || `${info.id}-tool-${index}`,
                toolName: p.tool || p.toolName || "unknown",
                content: typeof toolState.output === "string" 
                  ? toolState.output 
                  : JSON.stringify(toolState.output || toolState.input || {}, null, 2),
                toolInput: toolState.input,
                toolOutput: toolState.output,
                toolError: toolState.error,
                status: isError ? "error" : (isCompleted ? "completed" : (toolState.status as MessagePart["status"] || "completed")),
              };
            } else {
              // Fallback for other types
              return {
                type: p.type || "text",
                id: p.id || `${info.id}-${index}`,
                content: p.text || p.content || "",
                toolName: p.toolName || p.tool,
              };
            }
          });
          
          // If no parts but we have content, create a text part
          if (parts.length === 0 && info.content) {
            parts.push({
              type: "text",
              id: `${info.id}-content`,
              content: info.content,
            });
          }
          
          const content = parts
            .filter((p) => p.type === "text")
            .map((p) => p.content)
            .join("\n");

          // Normalize role to ensure it matches our expected types
          const role: "user" | "assistant" = info.role === "user" ? "user" : "assistant";
          
          // Get timestamp from time.created or created_at
          const timestamp = info.time?.created 
            ? info.time.created 
            : info.created_at 
              ? new Date(info.created_at).getTime() 
              : Date.now();

          return {
            id: info.id,
            role,
            content,
            parts,
            timestamp,
            status: "complete" as const,
          };
        });
        setMessages(messages);
        
        // Track any user message IDs from loaded messages
        messages.filter(m => m.role === "user").forEach(m => userMessageIdsRef.current.add(m.id));
      }


    } catch (err) {
      console.error("Failed to load session messages:", err);
    } finally {
      setLoading(false);
    }
  }, [setMessages, setLoading]);

  // Sync currentSessionId with store
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, loadSessionMessages, setMessages]);

  // Load sessions from API
  const loadSessions = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      const sessionsResponse = await client.session.list({});
      if (sessionsResponse.data) {
        const sessions = (sessionsResponse.data as any[]).map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled Session",
          createdAt: s.time?.created || Date.now(),
          updatedAt: s.time?.updated || Date.now(),
          messageCount: 0
        }));
        setSessions(sessions);
        console.log("[loadSessions] Loaded", sessions.length, "sessions");
        
        if (sessions.length > 0) {
          const mostRecent = sessions.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(mostRecent.id);
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, [setSessions]);

  // Load providers from OpenCode API
  const loadProviders = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      const response = await client.provider.list({});
      if (response.data) {
        // Response structure: { all: Provider[], default: {...}, connected: string[] }
        const data = response.data as { 
          all?: any[]; 
          default?: any; 
          connected?: string[]; 
        };
        
        const providersData = data.all || [];
        const connectedIds = new Set(data.connected || []);
        
        const providers = providersData.map((p: any) => {
          const isConfigured = connectedIds.has(p.id);
          
          // Always load models to ensure we have data for the UI
          // The list might be large but it's better than missing data
          const modelsObj = p.models || {};
          const modelsArray = Object.entries(modelsObj).map(([id, model]: [string, any]) => ({
            id,
            name: model.name || id,
            description: model.description,
            limit: model.limit,
            modalities: model.modalities,
          }));
          
          return {
            id: p.id,
            name: p.name || p.id,
            configured: isConfigured,
            authMethods: p.env || [],
            models: modelsArray,
          };
        });
        
        // Sort: Configured first, then by name
        const sortedProviders = providers.sort((a: any, b: any) => {
          if (a.configured && !b.configured) return -1;
          if (!a.configured && b.configured) return 1;
          return a.name.localeCompare(b.name);
        });
        
        setProviders(sortedProviders);
        console.log("[loadProviders] Loaded", sortedProviders.length, "providers");
      }
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  }, [setProviders]);

  const authorizeProvider = useCallback(async (providerId: string) => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to OpenCode");

    try {
      // Start OAuth flow
      // We default to method 0 (usually the primary one)
      const response = await client.provider.oauth.authorize({
        path: { id: providerId },
        body: { method: 0 }
      });
      
      if (response.data && (response.data as any).url) {
        // Open the URL in the default browser
        // We can use window.open since we're in a browser environment (Tauri WebView)
        window.open((response.data as any).url, '_blank');
      }
      
      // Reload providers to update status
      // We might need to wait for the user to complete auth, 
      // but reloading immediately is a good start
      setTimeout(() => loadProviders(), 5000); 
    } catch (err) {
      console.error("Failed to authorize provider:", err);
      throw err;
    }
  }, [loadProviders]);

  const setProviderKey = useCallback(async (providerId: string, key: string) => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to OpenCode");

    try {
      await client.auth.set({
        path: { id: providerId },
        body: {
          type: "api",
          key: key
        }
      });
      
      // Reload providers to update status
      await loadProviders();
    } catch (err) {
      console.error("Failed to set provider key:", err);
      throw err;
    }
  }, [loadProviders]);

  // Connect to OpenCode server
  const connect = useCallback(async (projectPath: string) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // OpenCode manages its own auth via its config file
      const openCodeConfig: OpenCodeConfig = {
        provider: config.selectedProvider,
        model: config.selectedModel,
      };
      
      const info = await startOpenCodeServer(projectPath, openCodeConfig);
      setServerInfo(info);
      
      const client = createOpencodeClient({
        baseUrl: info.url,
      });
      clientRef.current = client;
      
      // Wait a bit for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsConnected(true);
      console.log("Connected to OpenCode server at:", info.url);
      
      subscribeToEvents(info.url);

      // Load sessions and providers
      await Promise.all([
        loadSessions(),
        loadProviders(),
      ]);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setIsConnected(false);
      clientRef.current = null;
    } finally {
      setIsConnecting(false);
    }
  }, [config, isConnecting, subscribeToEvents, loadSessions, loadProviders]);

  // Check for existing server on mount
  useEffect(() => {
    getOpenCodeStatus()
      .then(async (status) => {
        if (status) {
          setServerInfo(status);
          setIsConnected(true);
          clientRef.current = createOpencodeClient({
            baseUrl: status.url,
          });
          subscribeToEvents(status.url);
          // Load sessions and providers after reconnecting
          await Promise.all([
            loadSessions(),
            loadProviders(),
          ]);
        }
      })
      .catch(console.error);
  }, [subscribeToEvents, loadSessions, loadProviders]);

  // Disconnect from OpenCode server
  const disconnect = useCallback(async () => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      await stopOpenCodeServer();
      
      setIsConnected(false);
      setServerInfo(null);
      clientRef.current = null;
      setCurrentSessionId(null);
      
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (title?: string): Promise<string> => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to OpenCode");
    
    const response = await client.session.create({
      body: { title },
    });
    
    const sessionId = response.data?.id;
    if (!sessionId) throw new Error("Failed to create session");
    
    // Mark as pending so loadSessionMessages won't clear our optimistic messages
    pendingSessionIdRef.current = sessionId;
    // Clear user message tracking for new session
    userMessageIdsRef.current.clear();
    
    setCurrentSessionId(sessionId);
    return sessionId;
  }, []);

  // Switch to a different session
  const switchSession = useCallback((sessionId: string) => {
    // Clear pending session ref since we're switching
    pendingSessionIdRef.current = null;
    userMessageIdsRef.current.clear();
    lastMessageIdRef.current = null;
    setCurrentSessionId(sessionId);
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to OpenCode");
    
    try {
      // Call the delete API
      await client.session.delete({
        path: { id: sessionId },
      });
      
      // Remove from local state
      const existingSessions = useAppStore.getState().sessions;
      const updatedSessions = existingSessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);
      
      // If we deleted the current session, switch to another one or clear
      if (currentSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          const mostRecent = updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(mostRecent.id);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
      
      console.log("[deleteSession] Deleted session:", sessionId);
    } catch (err) {
      console.error("Failed to delete session:", err);
      throw err;
    }
  }, [currentSessionId, setSessions, setMessages]);

  // Send a message
  const sendMessage = useCallback(async (text: string, _files?: File[]) => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to OpenCode");
    
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
    }
    
    setLoading(true);
    
    const userMessageId = `user-${Date.now()}`;
    addMessage({
      id: userMessageId,
      role: "user",
      content: text,
      parts: [{ type: "text", id: `${userMessageId}-text`, content: text }],
      timestamp: Date.now(),
      status: "complete",
    });
    
    try {
      let systemPrompt: string | undefined;

      // Inject web browsing instructions if enabled
      if (config.isWebBrowsingEnabled) {
        systemPrompt = "System Note: Web browsing is ENABLED. You have access to the `agent-browser` tool. When the user asks to look up information or browse the web, you MUST use `npx agent-browser` (e.g. `npx agent-browser open <url>`) instead of using other research tools like Nia. Use the browser to find live information.";
      }

      const parts: Array<{ type: "text"; text: string }> = [
        { type: "text", text },
      ];
      
      // Parse model format: "provider/model" or just "model"
      const [providerID, modelID] = config.selectedModel.includes("/")
        ? config.selectedModel.split("/")
        : [config.selectedProvider, config.selectedModel];
      
      console.log("[sendMessage] Sending with model:", { providerID, modelID, sessionId });
      
      // Use promptAsync for streaming via SSE
      await client.session.promptAsync({
        path: { id: sessionId },
        body: {
          model: { providerID, modelID },
          parts,
          system: systemPrompt,
        },
      });
      
      console.log("[sendMessage] promptAsync returned successfully");
      
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setLoading(false);
    }
  }, [currentSessionId, createSession, config, addMessage, setLoading]);

  // Regenerate the last assistant message
  const regenerateLastMessage = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !currentSessionId) throw new Error("Not connected to OpenCode");
    
    // Get the current messages from the store
    const messages = useAppStore.getState().messages;
    
    // Find the last user message
    const lastUserMessageIndex = [...messages].reverse().findIndex(m => m.role === "user");
    if (lastUserMessageIndex === -1) {
      throw new Error("No user message to regenerate from");
    }
    
    const actualIndex = messages.length - 1 - lastUserMessageIndex;
    const lastUserMessage = messages[actualIndex];
    
    // Remove all messages after (and including) the last assistant response
    const messagesToKeep = messages.slice(0, actualIndex + 1);
    setMessages(messagesToKeep);
    
    setLoading(true);
    
    try {
      // Parse model format
      const [providerID, modelID] = config.selectedModel.includes("/")
        ? config.selectedModel.split("/")
        : [config.selectedProvider, config.selectedModel];
      
      console.log("[regenerateLastMessage] Regenerating with model:", { providerID, modelID });
      
      let systemPrompt: string | undefined;

      // Inject web browsing instructions if enabled
      if (config.isWebBrowsingEnabled) {
        systemPrompt = "System Note: Web browsing is ENABLED. You have access to the `agent-browser` tool. When the user asks to look up information or browse the web, you MUST use `npx agent-browser` (e.g. `npx agent-browser open <url>`) instead of using other research tools like Nia. Use the browser to find live information.";
      }
      
      // Re-send the last user message
      await client.session.promptAsync({
        path: { id: currentSessionId },
        body: {
          model: { providerID, modelID },
          parts: [{ type: "text", text: lastUserMessage.content }],
          system: systemPrompt,
        },
      });
      
    } catch (err) {
      console.error("Failed to regenerate message:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate");
      setLoading(false);
    }
  }, [currentSessionId, config, setMessages, setLoading]);

  // Abort current session
  const abortSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !currentSessionId) return;
    
    try {
      await client.session.abort({
        path: { id: currentSessionId },
      });
    } catch (err) {
      console.error("Failed to abort session:", err);
    }
  }, [currentSessionId]);

  // Respond to a permission request
  const respondToPermission = useCallback(async (
    permissionId: string, 
    approved: boolean, 
    remember?: boolean
  ) => {
    const client = clientRef.current;
    if (!client || !currentSessionId) return;
    
    try {
      await client.postSessionIdPermissionsPermissionId({
        path: { 
          id: currentSessionId,
          permissionID: permissionId,
        },
        body: {
          response: approved ? (remember ? "always" : "once") : "reject",
        },
      });
      
      setPendingPermission(null);
    } catch (err) {
      console.error("Failed to respond to permission:", err);
    }
  }, [currentSessionId, setPendingPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <OpenCodeContext.Provider
      value={{
        isConnected,
        isConnecting,
        serverInfo,
        error,
        isInstalled,
        client: clientRef.current,
        connect,
        disconnect,
        authorizeProvider,
        setProviderKey,
        currentSessionId,
        createSession,
        switchSession,
        deleteSession,
        sendMessage,
        regenerateLastMessage,
        abortSession,
        respondToPermission,
      }}
    >
      {children}
    </OpenCodeContext.Provider>
  );
}

export function useOpenCode() {
  const context = useContext(OpenCodeContext);
  if (!context) {
    throw new Error("useOpenCode must be used within an OpenCodeProvider");
  }
  return context;
}
