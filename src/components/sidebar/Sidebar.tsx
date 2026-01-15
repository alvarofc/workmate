import { 
  Plus, 
  MessageSquare, 
  FolderOpen, 
  Settings, 
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Sidebar() {
  const { 
    sessions, 
    folders,
    removeFolder,
    isSidebarOpen, 
    toggleSidebar,
    setSettingsOpen,
    config,
    updateConfig,
    setMessages,
  } = useAppStore();

  const {
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    isConnected,
  } = useOpenCode();

  const handleSelectSession = (sessionId: string) => {
    switchSession(sessionId);
  };

  const handleNewChat = async () => {
    if (!isConnected) return;
    try {
      setMessages([]); // Clear messages immediately
      await createSession();
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent selecting the session
    if (!isConnected) return;
    try {
      await deleteSession(sessionId);
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleToggleTheme = () => {
    // If currently system, assume we want to toggle away from the *current* system resolved value?
    // Or just simple toggle: Light <-> Dark
    const newTheme = config.theme === "dark" ? "light" : "dark";
    updateConfig({ theme: newTheme });
  };

  if (!isSidebarOpen) {
    return (
      <div className="w-14 h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleSidebar}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-sidebar-border drag-region">
        <div className="flex items-center gap-2 no-drag">
          <img src="/workmate.svg" alt="Workmate" className="h-6 w-6" />
          <span className="font-semibold text-sidebar-foreground">Workmate</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={toggleSidebar}
          className="no-drag text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button 
          variant="secondary" 
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
          disabled={!isConnected}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Conversations
        </div>
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No conversations yet
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectSession(session.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
                  "hover:bg-sidebar-accent",
                  currentSessionId === session.id 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{session.title || "New Chat"}</span>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5 rounded hover:bg-sidebar-accent"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Folders Section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Folders
        </div>
        <div className="space-y-1">
          {folders.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2 text-center">
              No folders added
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.path}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent group"
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0 text-sidebar-primary" />
                <span className="truncate flex-1">{folder.name}</span>
                <button
                  onClick={() => removeFolder(folder.path)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 flex gap-2">
        <Button 
          variant="ghost" 
          className="flex-1 justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleToggleTheme}
          title="Toggle Theme"
        >
          {config.theme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
