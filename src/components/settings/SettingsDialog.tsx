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
import { FolderPlus, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useState } from "react";
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
  const [showApiKey, setShowApiKey] = useState(false);

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
