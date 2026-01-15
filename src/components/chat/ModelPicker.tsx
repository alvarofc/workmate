import { useState, useMemo } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  Search, 
  Star, 
  Plus,
  Eye,
  Brain,
} from "lucide-react";
import type { Provider, Model } from "@/types";

// Provider logo mapping from models.dev
function getProviderLogo(providerId: string, className?: string) {
  // Map some provider IDs to their logos if they differ
  const logoId = providerId === "opencode" ? "opencode" : providerId;
  
  return (
    <img
      src={`https://models.dev/logos/${logoId}.svg`}
      alt={`${providerId} logo`}
      className={cn("h-4 w-4 dark:invert", className)}
      onError={(e) => {
        // Fallback if image fails to load
        e.currentTarget.style.display = 'none';
        e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<div class="h-4 w-4 flex items-center justify-center bg-muted rounded-sm text-[10px] font-bold">' + providerId[0].toUpperCase() + '</div>');
      }}
    />
  );
}

// Model capability icons
function getModelCapabilities(model: Model) {
  const caps: { icon: React.ReactNode; label: string }[] = [];
  
  if (model.modalities?.input?.includes("image")) {
    caps.push({ icon: <Eye className="h-3 w-3" />, label: "Vision" });
  }
  
  if (model.name?.toLowerCase().includes("thinking") || model.name?.toLowerCase().includes("reason")) {
    caps.push({ icon: <Brain className="h-3 w-3" />, label: "Reasoning" });
  }
  
  return caps;
}

interface ModelPickerProps {
  className?: string;
}

export function ModelPicker({ className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  
  const { providers, config, updateConfig } = useAppStore();
  const { isConnected } = useOpenCode();
  
  const favoriteModels = config.favoriteModels || [];
  
  // Parse current selection
  const currentSelection = useMemo(() => {
    if (config.selectedModel.includes("/")) {
      const [providerId, modelId] = config.selectedModel.split("/");
      return { providerId, modelId };
    }
    return { providerId: config.selectedProvider, modelId: config.selectedModel };
  }, [config.selectedModel, config.selectedProvider]);
  
  // Get current model name for display
  const currentModelName = useMemo(() => {
    const provider = providers.find(p => p.id === currentSelection.providerId);
    const model = provider?.models.find(m => m.id === currentSelection.modelId);
    return model?.name || currentSelection.modelId;
  }, [providers, currentSelection]);
  
  // Filter providers based on selected sidebar item
  const activeProvider = selectedProviderId 
    ? providers.find(p => p.id === selectedProviderId) 
    : null;
  
  // Get models to display (from active provider or all)
  const displayModels = useMemo(() => {
    let models: { provider: Provider; model: Model }[] = [];
    
    if (activeProvider) {
      // Specific provider selected
      models = activeProvider.models.map(m => ({ provider: activeProvider, model: m }));
    } else if (selectedProviderId === null) {
      // Star icon clicked - ALWAYS show favorites view
      providers.forEach(p => {
        p.models.forEach(m => {
          const modelId = `${p.id}/${m.id}`;
          if (favoriteModels.includes(modelId)) {
            models.push({ provider: p, model: m });
          }
        });
      });
    }
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      models = models.filter(({ model, provider }) => 
        model.name.toLowerCase().includes(searchLower) ||
        model.id.toLowerCase().includes(searchLower) ||
        provider.name.toLowerCase().includes(searchLower)
      );
    }
    
    return models;
  }, [providers, activeProvider, search, selectedProviderId, favoriteModels]);
  
  const handleSelectModel = (providerId: string, modelId: string) => {
    updateConfig({ 
      selectedProvider: providerId,
      selectedModel: `${providerId}/${modelId}` 
    });
    setOpen(false);
  };

  const toggleFavorite = (e: React.MouseEvent, providerId: string, modelId: string) => {
    e.stopPropagation();
    const id = `${providerId}/${modelId}`;
    const newFavorites = favoriteModels.includes(id)
      ? favoriteModels.filter(f => f !== id)
      : [...favoriteModels, id];
    
    updateConfig({ favoriteModels: newFavorites });
  };
  
  const handleOpenSettings = () => {
    setOpen(false);
    useAppStore.getState().setSettingsOpen(true);
  };
  
  // No providers connected state
  if (!isConnected || providers.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenSettings}
        className={cn("gap-2 text-muted-foreground", className)}
      >
        <Plus className="h-3.5 w-3.5" />
        Connect a provider
      </Button>
    );
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 px-2.5 h-8 text-sm font-medium",
            "bg-muted/50 hover:bg-muted border border-border/50",
            "rounded-sm",
            className
          )}
        >
          {getProviderLogo(currentSelection.providerId)}
          <span className="max-w-[120px] truncate">{currentModelName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-[480px] p-0 shadow-xl" 
        align="start"
        sideOffset={8}
      >
        {/* Search Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20 transition-colors duration-200 focus-within:border-primary focus-within:bg-background">
          <Search className="h-4 w-4 text-muted-foreground/70 shrink-0 transition-colors focus-within:text-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 !border-0 !ring-0 !ring-offset-0 !shadow-none !outline-none focus-visible:!ring-0 focus-visible:!border-0 bg-transparent h-8 px-0 text-sm placeholder:text-muted-foreground/70"
            autoFocus
          />
        </div>
        
        <div className="flex">
          {/* Provider Sidebar */}
          <div className="w-12 border-r border-border bg-muted/30 py-2 flex flex-col items-center gap-1">
            {/* All/Favorites */}
            <button
              onClick={() => setSelectedProviderId(null)}
              className={cn(
                "w-9 h-9 rounded-sm flex items-center justify-center transition-colors",
                selectedProviderId === null 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={favoriteModels.length > 0 ? `Favorites (${favoriteModels.length})` : "Favorites"}
            >
              <Star className={cn("h-4 w-4", favoriteModels.length > 0 && "fill-current")} />
            </button>
            
            {/* Provider icons */}
            {providers
              .filter(p => p.configured || p.id === selectedProviderId)
              .map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProviderId(provider.id)}
                className={cn(
                  "w-9 h-9 rounded-sm flex items-center justify-center transition-colors overflow-hidden p-2",
                  selectedProviderId === provider.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={provider.name}
              >
                {getProviderLogo(provider.id)}
              </button>
            ))}
            
            {/* Add provider button */}
            <button
              onClick={handleOpenSettings}
              className="w-9 h-9 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-auto"
              title="Add provider"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Model List */}
          <ScrollArea className="flex-1 h-[320px]">
            <div className="p-2">
              {displayModels.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm px-4">
                  {search 
                    ? "No models found" 
                    : selectedProviderId === null
                    ? (
                      <div className="space-y-2">
                        <Star className="h-8 w-8 mx-auto text-muted-foreground/50" />
                        <p className="font-medium">No favorites yet</p>
                        <p className="text-xs">Click the star on any model to add it to your favorites</p>
                      </div>
                    )
                    : "No models available"}
                </div>
              ) : (
                displayModels.map(({ provider, model }) => {
                  const modelId = `${provider.id}/${model.id}`;
                  const isSelected = 
                    currentSelection.providerId === provider.id && 
                    currentSelection.modelId === model.id;
                  const isFavorite = favoriteModels.includes(modelId);
                  const capabilities = getModelCapabilities(model);
                  
                  return (
                    <button
                      key={modelId}
                      onClick={() => handleSelectModel(provider.id, model.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-sm transition-colors group",
                        "hover:bg-muted/80",
                        isSelected && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Provider icon */}
                        <div className="mt-0.5 text-muted-foreground">
                          {getProviderLogo(provider.id)}
                        </div>
                        
                        {/* Model info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {model.name}
                            </span>
                          </div>
                          {model.limit?.context && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Math.round(model.limit.context / 1024)}K context
                            </p>
                          )}
                        </div>
                        
                        {/* Actions & Capabilities */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 mr-1">
                            {capabilities.map((cap, i) => (
                              <div 
                                key={i}
                                className="text-muted-foreground"
                                title={cap.label}
                              >
                                {cap.icon}
                              </div>
                            ))}
                          </div>
                          
                          {!provider.configured ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 px-2 text-[10px] uppercase font-bold tracking-wider rounded-sm bg-background hover:bg-background"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSettings();
                              }}
                            >
                              Connect
                            </Button>
                          ) : (
                            <button
                              onClick={(e) => toggleFavorite(e, provider.id, model.id)}
                              className={cn(
                                "opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded-sm",
                                isFavorite && "opacity-100 text-yellow-500"
                              )}
                            >
                              <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
