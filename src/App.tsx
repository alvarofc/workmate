import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { PermissionDialog } from "@/components/permissions/PermissionDialog";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import "./index.css";

function App() {
  const { 
    isSettingsOpen, 
    setSettingsOpen,
    pendingPermission,
    setPendingPermission,
    config,
  } = useAppStore();

  // Handle theme switching
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (config.theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(config.theme);
  }, [config.theme]);

  const { respondToPermission } = useOpenCode();

  const handlePermissionApprove = async (remember?: boolean) => {
    if (pendingPermission) {
      try {
        await respondToPermission(pendingPermission.id, true, remember);
      } catch (error) {
        console.error("Failed to approve permission:", error);
      }
    }
    setPendingPermission(null);
  };

  const handlePermissionDeny = async (remember?: boolean) => {
    if (pendingPermission) {
      try {
        await respondToPermission(pendingPermission.id, false, remember);
      } catch (error) {
        console.error("Failed to deny permission:", error);
      }
    }
    setPendingPermission(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar for window drag */}
        <div className="h-10 flex-shrink-0 border-b border-border drag-region flex items-center px-4">
          <span className="text-sm text-muted-foreground no-drag">
            Your AI work companion
          </span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatWindow />
        </div>
      </main>

      {/* Settings Dialog */}
      <SettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setSettingsOpen} 
      />

      {/* Permission Dialog */}
      <PermissionDialog
        request={pendingPermission}
        onApprove={handlePermissionApprove}
        onDeny={handlePermissionDeny}
        onClose={() => setPendingPermission(null)}
      />
    </div>
  );
}

export default App;
