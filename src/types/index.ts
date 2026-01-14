export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  timestamp: number;
  status?: "pending" | "streaming" | "complete" | "error";
}

export interface MessagePart {
  type: "text" | "tool_use" | "tool_result" | "file_edit" | "file_create";
  content: string;
  toolName?: string;
  filePath?: string;
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
}

export interface Model {
  id: string;
  name: string;
  description?: string;
}

export interface AppConfig {
  selectedProvider: string;
  selectedModel: string;
  apiKeys: Record<string, string>;
  theme: "dark" | "light" | "system";
  folders: Folder[];
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
