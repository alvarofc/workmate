import { useState, useEffect, useCallback, useRef } from "react";
import { createOpencodeClient } from "@opencode-ai/sdk";
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

interface UseOpenCodeResult {
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
  
  // Session management
  currentSessionId: string | null;
  createSession: (title?: string) => Promise<string>;
  sendMessage: (text: string, files?: File[]) => Promise<void>;
  abortSession: () => Promise<void>;
  
  // Permissions
  respondToPermission: (permissionId: string, approved: boolean, remember?: boolean) => Promise<void>;
}

export function useOpenCode(): UseOpenCodeResult {
  const { 
    config, 
    addMessage, 
    updateMessage,
    setLoading,
    setPendingPermission,
    setSessions,
    setMessages,
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

  // Load messages for a session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const client = clientRef.current;
    if (!client) return;

    try {
      setLoading(true);
      const response = await client.session.messages({
        path: { id: sessionId }
      });

      if (response.data) {
        const messages = (response.data as any[]).map((msg: any) => {
          const parts: MessagePart[] = (msg.parts || []).map((p: any) => ({
            type: p.type,
            content: p.text || "",
            toolName: p.toolName,
          }));
          
          const content = parts
            .filter((p) => p.type === "text")
            .map((p) => p.content)
            .join("\n");

          return {
            id: msg.id,
            role: msg.role,
            content,
            parts,
            timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
            status: "complete" as const,
          };
        });
        setMessages(messages);
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

  // Check if OpenCode is installed on mount
  useEffect(() => {
    checkOpenCodeInstalled()
      .then(setIsInstalled)
      .catch(() => setIsInstalled(false));
  }, []);

  // Check for existing server on mount
  useEffect(() => {
    getOpenCodeStatus()
      .then((status) => {
        if (status) {
          setServerInfo(status);
          setIsConnected(true);
          clientRef.current = createOpencodeClient({
            baseUrl: status.url,
          });
          // Start listening for events
          subscribeToEvents(status.url);
        }
      })
      .catch(console.error);
  }, []);

  // Subscribe to OpenCode events (SSE)
  const subscribeToEvents = useCallback((serverUrl: string) => {
    // Close existing event source
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
  }, []);

  // Handle incoming events from OpenCode
  const handleEvent = useCallback((event: { type: string; properties?: Record<string, unknown> }) => {
    switch (event.type) {
      case "permission.request":
        // Show permission dialog
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

      case "message.created": {
        const msg = event.properties as any;
        // Only handle assistant messages (user messages are added optimistically)
        if (msg.role === "assistant") {
          lastMessageIdRef.current = msg.id;
          const parts: MessagePart[] = (msg.parts || []).map((p: any) => ({
            type: p.type,
            content: p.text || "",
            toolName: p.toolName,
          }));
          
          const textContent = parts
            .filter((p) => p.type === "text")
            .map((p) => p.content)
            .join("\n");

          addMessage({
            id: msg.id,
            role: "assistant",
            content: textContent,
            timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
            status: "streaming",
            parts,
          });
        }
        break;
      }

      case "message.updated": {
        const msg = event.properties as any;
        const parts: MessagePart[] = (msg.parts || []).map((p: any) => ({
          type: p.type,
          content: p.text || "",
          toolName: p.toolName,
        }));
        
        const textContent = parts
          .filter((p) => p.type === "text")
          .map((p) => p.content)
          .join("\n");

        updateMessage(msg.id, {
          content: textContent,
          parts,
          status: "streaming",
        });
        break;
      }

      case "run.completed":
      case "run.failed":
        if (lastMessageIdRef.current) {
          updateMessage(lastMessageIdRef.current, { status: "complete" });
          lastMessageIdRef.current = null;
        }
        setLoading(false);
        break;

      case "session.updated":
        // Handle session updates
        break;

      default:
        // Log unknown events for debugging
        console.debug("Unknown event:", event.type, event.properties);
    }
  }, [setPendingPermission, addMessage, updateMessage, setLoading]);

  // Connect to OpenCode server
  const connect = useCallback(async (projectPath: string) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const apiKey = config.apiKeys[config.selectedProvider];
      
      const openCodeConfig: OpenCodeConfig = {
        provider: config.selectedProvider,
        model: config.selectedModel,
        api_key: apiKey,
      };
      
      const info = await startOpenCodeServer(projectPath, openCodeConfig);
      setServerInfo(info);
      
      const client = createOpencodeClient({
        baseUrl: info.url,
      });
      clientRef.current = client;
      
      // Wait a bit for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify connection - just try to create a session
      // The SDK client doesn't have a health endpoint, so we'll just set connected
      setIsConnected(true);
      console.log("Connected to OpenCode server at:", info.url);
      
      // Subscribe to events
      subscribeToEvents(info.url);

      // Load sessions
      try {
        const sessionsResponse = await client.session.list({});
        if (sessionsResponse.data) {
          const sessions = (sessionsResponse.data as any[]).map((s: any) => ({
            id: s.id,
            title: s.title || "Untitled Session",
            createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
            updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
            messageCount: 0
          }));
          setSessions(sessions);
          
          // Select most recent session if available
          if (sessions.length > 0) {
            const mostRecent = sessions.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0];
            setCurrentSessionId(mostRecent.id);
          }
        }
      } catch (err) {
        console.error("Failed to load sessions:", err);
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setIsConnected(false);
      clientRef.current = null;
    } finally {
      setIsConnecting(false);
    }
  }, [config, isConnecting, subscribeToEvents]);

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
    
    setCurrentSessionId(sessionId);
    return sessionId;
  }, []);

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
      timestamp: Date.now(),
      status: "complete",
    });
    
    try {
      const parts: Array<{ type: "text"; text: string }> = [
        { type: "text", text },
      ];
      
      const [providerID, modelID] = config.selectedModel.includes("/")
        ? config.selectedModel.split("/")
        : [config.selectedProvider, config.selectedModel];
      
      await client.session.promptAsync({
        path: { id: sessionId },
        body: {
          model: { providerID, modelID },
          parts,
        },
      });
      
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setLoading(false);
    }
  }, [currentSessionId, createSession, config, addMessage, setLoading]);

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
          // SDK uses "once" (approve once), "always" (remember approval), or "reject"
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

  return {
    isConnected,
    isConnecting,
    serverInfo,
    error,
    isInstalled,
    client: clientRef.current,
    connect,
    disconnect,
    currentSessionId,
    createSession,
    sendMessage,
    abortSession,
    respondToPermission,
  };
}
