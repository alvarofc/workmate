import { 
  Plus, 
  MessageSquare, 
  FolderOpen, 
  Settings, 
  Trash2,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Sidebar() {
  const { 
    sessions, 
    currentSessionId, 
    setCurrentSession,
    folders,
    removeFolder,
    isSidebarOpen, 
    toggleSidebar,
    setSettingsOpen 
  } = useAppStore();

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
        <span className="font-semibold text-sidebar-foreground no-drag">Workmate</span>
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
          onClick={() => setCurrentSession(null)}
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
              <button
                key={session.id}
                onClick={() => setCurrentSession(session.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  "hover:bg-sidebar-accent",
                  currentSessionId === session.id 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{session.title || "New Chat"}</span>
                </div>
              </button>
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
      <div className="border-t border-sidebar-border p-3">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
