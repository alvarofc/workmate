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
import { FolderPlus, Trash2, Plus, Database, AlertCircle, Search, Key, Globe, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { config, updateConfig, folders, addFolder, removeFolder, providers } = useAppStore();
  const { client, isConnected, authorizeProvider, setProviderKey } = useOpenCode();
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpConfig, setNewMcpConfig] = useState({
    name: "",
    type: "stdio",
    command: "",
    args: "",
    url: "",
  });
  
  // Provider auth state
  const [providerSearch, setProviderSearch] = useState("");
  const [keyInputProvider, setKeyInputProvider] = useState<string | null>(null);
  const [keyInputValue, setKeyInputValue] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);

  useEffect(() => {
    if (open && client) {
      loadMcpStatus();
    }
  }, [open, client]);

  // ... (keep existing loadMcpStatus and handleAddMcpServer/handleRemoveMcpServer)

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
      await client.mcp.disconnect({
        body: { name } 
      } as any);
      loadMcpStatus();
    } catch (err) {
      console.error("Failed to remove MCP server:", err);
    }
  };

  // Provider Management
  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const lower = providerSearch.toLowerCase();
    return providers.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.id.toLowerCase().includes(lower)
    );
  }, [providers, providerSearch]);

  const handleAuth = async (providerId: string, method: 'oauth' | 'key') => {
    if (method === 'oauth') {
      try {
        setIsAuthenticating(providerId);
        await authorizeProvider(providerId);
      } catch (err) {
        // Error handling
      } finally {
        setIsAuthenticating(null);
      }
    } else {
      setKeyInputProvider(providerId);
      setKeyInputValue("");
    }
  };

  const handleSubmitKey = async (providerId: string) => {
    if (!keyInputValue.trim()) return;
    try {
      setIsAuthenticating(providerId);
      await setProviderKey(providerId, keyInputValue);
      setKeyInputProvider(null);
      setKeyInputValue("");
    } catch (err) {
      // Error handling
    } finally {
      setIsAuthenticating(null);
    }
  };

  const getProviderLogo = (providerId: string) => {
    const logoId = providerId === "opencode" ? "opencode" : providerId;
    return (
      <img
        src={`https://models.dev/logos/${logoId}.svg`}
        alt={`${providerId} logo`}
        className="h-4 w-4 dark:invert"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', `<div class="h-4 w-4 flex items-center justify-center bg-muted rounded-sm text-[10px] font-bold">${providerId[0].toUpperCase()}</div>`);
        }}
      />
    );
  };

  // Get current provider and its models from dynamic providers list
  const currentProvider = useMemo(() => 
    providers.find((p) => p.id === config.selectedProvider),
    [providers, config.selectedProvider]
  );

  const availableModels = useMemo(() => 
    currentProvider?.models || [],
    [currentProvider]
  );

  // Parse the selected model to get provider and model IDs
  const selectedModelParts = useMemo(() => {
    if (config.selectedModel.includes("/")) {
      const [providerID, modelID] = config.selectedModel.split("/");
      return { providerID, modelID };
    }
    return { providerID: config.selectedProvider, modelID: config.selectedModel };
  }, [config.selectedModel, config.selectedProvider]);

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

  const handleProviderChange = (providerId: string) => {
    updateConfig({ selectedProvider: providerId });
    
    // Auto-select first model of the new provider
    const newProvider = providers.find(p => p.id === providerId);
    if (newProvider && newProvider.models.length > 0) {
      const firstModel = newProvider.models[0];
      updateConfig({ selectedModel: `${providerId}/${firstModel.id}` });
    }
  };

  const handleModelChange = (modelId: string) => {
    // Store as "provider/model" format
    updateConfig({ selectedModel: `${config.selectedProvider}/${modelId}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider and folder access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Default Model</label>
              {!isConnected && (
                <span className="text-xs text-muted-foreground">
                  Connect to load providers
                </span>
              )}
            </div>
            
            {providers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isConnected 
                    ? "Loading providers..." 
                    : "Add a folder and connect to load available providers from OpenCode"
                  }
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={config.selectedProvider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers
                      .filter(p => p.configured)
                      .map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span>{provider.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedModelParts.modelID}
                  onValueChange={handleModelChange}
                  disabled={availableModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          {model.limit && (
                            <span className="text-xs text-muted-foreground">
                              Context: {Math.round((model.limit.context || 0) / 1024)}K
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Manage Providers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Manage Providers</label>
            </div>
            
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70 group-focus-within:text-foreground transition-colors" />
              <Input
                placeholder="Search providers (e.g. OpenAI, Anthropic)..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="pl-9 bg-muted/20 border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring transition-all"
              />
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-2 border rounded-lg p-2 bg-muted/20">
              {filteredProviders.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No providers found
                </div>
              ) : (
                filteredProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border transition-colors",
                      provider.configured 
                        ? "bg-green-500/5 border-green-500/20" 
                        : "bg-background border-border hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 flex items-center justify-center rounded-sm bg-background border shrink-0">
                        {getProviderLogo(provider.id)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{provider.name}</p>
                          {provider.configured && (
                            <Check className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {provider.models.length} models available
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {keyInputProvider === provider.id ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-5 fade-in duration-200">
                          <Input
                            type="password"
                            placeholder="API Key"
                            value={keyInputValue}
                            onChange={(e) => setKeyInputValue(e.target.value)}
                            className="h-8 w-40 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSubmitKey(provider.id);
                              if (e.key === 'Escape') setKeyInputProvider(null);
                            }}
                          />
                          <Button 
                            size="sm" 
                            className="h-8 px-2"
                            onClick={() => handleSubmitKey(provider.id)}
                            disabled={isAuthenticating === provider.id}
                          >
                            {isAuthenticating === provider.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => setKeyInputProvider(null)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : !provider.configured ? (
                        <div className="flex gap-1">
                          {/* Prefer OAuth if available, otherwise Key */}
                          {(provider.authMethods?.includes("oauth") || ["google", "anthropic"].includes(provider.id)) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => handleAuth(provider.id, 'oauth')}
                              disabled={isAuthenticating === provider.id}
                            >
                              {isAuthenticating === provider.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Globe className="h-3 w-3" />
                              )}
                              Connect
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => handleAuth(provider.id, 'key')}
                            >
                              <Key className="h-3 w-3" />
                              Set Key
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground cursor-default hover:bg-transparent"
                        >
                          Connected
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

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
                disabled={!isConnected}
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
              {!isConnected ? (
                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Connect to manage MCP servers
                </div>
              ) : mcpServers.length === 0 ? (
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
