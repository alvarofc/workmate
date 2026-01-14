import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import { FolderPlus, Trash2, Eye, EyeOff, ExternalLink, Plus, Database } from "lucide-react";
import { useState, useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const PROVIDERS = [
  { id: "openrouter", name: "OpenRouter", description: "Access multiple models with one API" },
  { id: "anthropic", name: "Anthropic", description: "Claude models" },
  { id: "openai", name: "OpenAI", description: "GPT models" },
  { id: "google", name: "Google", description: "Gemini models" },
  { id: "ollama", name: "Ollama", description: "Local models" },
];

const MODELS: Record<string, { id: string; name: string }[]> = {
  openrouter: [
    { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "openai/gpt-4o", name: "GPT-4o" },
    { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash" },
    { id: "z-ai/glm-4.5-air:free", name: "GLM-4.5 Air (Free)" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  ],
  google: [
    { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
  ],
  ollama: [
    { id: "llama3.2", name: "Llama 3.2" },
    { id: "codellama", name: "Code Llama" },
  ],
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { config, updateConfig, folders, addFolder, removeFolder } = useAppStore();
  const { client } = useOpenCode();
  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpConfig, setNewMcpConfig] = useState({
    name: "",
    type: "stdio",
    command: "",
    args: "",
    url: "",
  });

  useEffect(() => {
    if (open && client) {
      loadMcpStatus();
    }
  }, [open, client]);

  const loadMcpStatus = async () => {
    if (!client) return;
    try {
      const response = await client.mcp.status({});
      if (response.data && 'servers' in response.data) {
        setMcpServers((response.data as any).servers || []);
      }
    } catch (err) {
      console.error("Failed to load MCP status:", err);
    }
  };

  const handleAddMcpServer = async () => {
    if (!client || !newMcpConfig.name) return;

    try {
      const config: any = {
        name: newMcpConfig.name,
      };

      if (newMcpConfig.type === "stdio") {
        config.type = "stdio";
        config.command = newMcpConfig.command;
        config.args = newMcpConfig.args.split(" ").filter(Boolean);
      } else {
        config.type = "sse";
        config.url = newMcpConfig.url;
      }

      await client.mcp.add({
        body: config
      });

      setIsAddingMcp(false);
      setNewMcpConfig({ name: "", type: "stdio", command: "", args: "", url: "" });
      loadMcpStatus();
    } catch (err) {
      console.error("Failed to add MCP server:", err);
    }
  };

  const handleRemoveMcpServer = async (name: string) => {
    if (!client) return;
    try {
      // Assuming disconnect or remove endpoint
      // The SDK has disconnect
      await client.mcp.disconnect({
        body: { name } 
      } as any);
      loadMcpStatus();
    } catch (err) {
      console.error("Failed to remove MCP server:", err);
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.id === config.selectedProvider);
  const availableModels = MODELS[config.selectedProvider] || [];

  const handleAddFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select a folder to give Workmate access to",
      });
      
      if (selected && typeof selected === "string") {
        const folderName = selected.split("/").pop() || selected;
        addFolder({
          path: selected,
          name: folderName,
          addedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error("Failed to open folder picker:", error);
    }
  };

  const handleApiKeyChange = (value: string) => {
    updateConfig({
      apiKeys: {
        ...config.apiKeys,
        [config.selectedProvider]: value,
      },
    });
  };

  const currentApiKey = config.apiKeys[config.selectedProvider] || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider and folder access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Provider</label>
            <Select
              value={config.selectedProvider}
              onValueChange={(value) => updateConfig({ selectedProvider: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex flex-col">
                      <span>{provider.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {provider.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          {config.selectedProvider !== "ollama" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={`Enter your ${selectedProvider?.name} API key`}
                  value={currentApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <a
                href={getProviderUrl(config.selectedProvider)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Get your API key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={config.selectedModel}
              onValueChange={(value) => updateConfig({ selectedModel: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Appearance</label>
            <Select
              value={config.theme}
              onValueChange={(value: "light" | "dark" | "system") => updateConfig({ theme: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light (Cream)</SelectItem>
                <SelectItem value="dark">Dark (Stone)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Folder Access */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Folder Access</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFolder}
                className="gap-1"
              >
                <FolderPlus className="h-4 w-4" />
                Add Folder
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Workmate can only read and write files in folders you explicitly allow.
            </p>
            <div className="space-y-2">
              {folders.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No folders added yet
                </div>
              ) : (
                folders.map((folder) => (
                  <div
                    key={folder.path}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {folder.path}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFolder(folder.path)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* MCP Servers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                MCP Servers
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingMcp(!isAddingMcp)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Server
              </Button>
            </div>
            
            {isAddingMcp && (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Name</label>
                    <Input 
                      value={newMcpConfig.name}
                      onChange={(e) => setNewMcpConfig({...newMcpConfig, name: e.target.value})}
                      placeholder="e.g. memory"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Type</label>
                    <Select
                      value={newMcpConfig.type}
                      onValueChange={(value) => setNewMcpConfig({...newMcpConfig, type: value})}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stdio">Stdio</SelectItem>
                        <SelectItem value="sse">SSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {newMcpConfig.type === "stdio" ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Command</label>
                      <Input 
                        value={newMcpConfig.command}
                        onChange={(e) => setNewMcpConfig({...newMcpConfig, command: e.target.value})}
                        placeholder="e.g. npx"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Args</label>
                      <Input 
                        value={newMcpConfig.args}
                        onChange={(e) => setNewMcpConfig({...newMcpConfig, args: e.target.value})}
                        placeholder="e.g. -y @modelcontextprotocol/server-memory"
                        className="h-8 text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">URL</label>
                    <Input 
                      value={newMcpConfig.url}
                      onChange={(e) => setNewMcpConfig({...newMcpConfig, url: e.target.value})}
                      placeholder="http://localhost:8000/sse"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingMcp(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleAddMcpServer} className="h-7 text-xs">Save</Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {mcpServers.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No MCP servers connected
                </div>
              ) : (
                mcpServers.map((server) => (
                  <div
                    key={server.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{server.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                          {server.type || "stdio"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {server.status || "Connected"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMcpServer(server.name)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getProviderUrl(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/keys";
    case "anthropic":
      return "https://console.anthropic.com/settings/keys";
    case "openai":
      return "https://platform.openai.com/api-keys";
    case "google":
      return "https://aistudio.google.com/app/apikey";
    default:
      return "#";
  }
}
