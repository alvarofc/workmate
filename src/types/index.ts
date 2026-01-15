export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  timestamp: number;
  status?: "pending" | "streaming" | "complete" | "error";
}

export interface MessagePart {
  type: "text" | "reasoning" | "tool_use" | "tool_result" | "file_edit" | "file_create";
  content: string;
  id?: string;
  toolName?: string;
  filePath?: string;
  status?: "pending" | "running" | "completed" | "error";
  // Tool-specific fields
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  toolError?: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Folder {
  path: string;
  name: string;
  addedAt: number;
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
  configured: boolean;
  // Auth methods available
  authMethods?: string[];
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  // From OpenCode config
  limit?: {
    context?: number;
    output?: number;
  };
  modalities?: {
    input?: string[];
    output?: string[];
  };
}

export interface AppConfig {
  selectedProvider: string;
  selectedModel: string;
  // We no longer store API keys here - OpenCode manages auth
  theme: "dark" | "light" | "system";
  folders: Folder[];
  favoriteModels?: string[]; // array of "providerId/modelId"
  isWebBrowsingEnabled?: boolean;
}

export interface PermissionRequest {
  id: string;
  type: "file_edit" | "file_create" | "file_delete" | "shell_command";
  description: string;
  details: {
    path?: string;
    command?: string;
    diff?: string;
  };
}
