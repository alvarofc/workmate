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
import type { PermissionRequest } from "@/types";

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
    setLoading,
    setPendingPermission,
  } = useAppStore();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const clientRef = useRef<OpenCodeClient | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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

      case "message.created":
      case "message.updated":
        // Handle message updates - could be used for streaming
        break;

      case "session.updated":
        // Handle session updates
        break;

      default:
        // Log unknown events for debugging
        console.debug("Unknown event:", event.type, event.properties);
    }
  }, [setPendingPermission]);

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
      
      const response = await client.session.prompt({
        path: { id: sessionId },
        body: {
          model: { providerID, modelID },
          parts,
        },
      });
      
      if (response.data) {
        const assistantMessageId = `assistant-${Date.now()}`;
        const responseData = response.data as { 
          info?: { id: string }; 
          parts?: Array<{ type: string; text?: string; toolName?: string }> 
        };
        
        const textContent = responseData.parts
          ?.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n") || "";
        
        addMessage({
          id: responseData.info?.id || assistantMessageId,
          role: "assistant",
          content: textContent,
          timestamp: Date.now(),
          status: "complete",
          parts: responseData.parts?.map((p) => ({
            type: p.type as "text" | "tool_use" | "tool_result",
            content: p.text || "",
            toolName: p.toolName,
          })),
        });
      }
      
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
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
