import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Message, Session, Folder, PermissionRequest, AppConfig } from "../types";

interface AppState {
  // Connection
  isConnected: boolean;
  serverPort: number | null;
  setConnected: (connected: boolean, port?: number) => void;

  // Sessions
  sessions: Session[];
  currentSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (id: string | null) => void;
  addSession: (session: Session) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;

  // Folders
  folders: Folder[];
  addFolder: (folder: Folder) => void;
  removeFolder: (path: string) => void;

  // UI State
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;

  // Permissions
  pendingPermission: PermissionRequest | null;
  setPendingPermission: (request: PermissionRequest | null) => void;

  // Config
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;

  // Input
  inputValue: string;
  setInputValue: (value: string) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const defaultConfig: AppConfig = {
  selectedProvider: "openrouter",
  selectedModel: "anthropic/claude-sonnet-4-20250514",
  apiKeys: {},
  theme: "dark",
  folders: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Connection
      isConnected: false,
      serverPort: null,
      setConnected: (connected, port) =>
        set({ isConnected: connected, serverPort: port ?? null }),

      // Sessions
      sessions: [],
      currentSessionId: null,
      setSessions: (sessions) => set({ sessions }),
      setCurrentSession: (id) => set({ currentSessionId: id }),
      addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),

      // Messages
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      // Folders
      folders: [],
      addFolder: (folder) =>
        set((state) => ({
          folders: [...state.folders.filter((f) => f.path !== folder.path), folder],
        })),
      removeFolder: (path) =>
        set((state) => ({
          folders: state.folders.filter((f) => f.path !== path),
        })),

      // UI State
      isSidebarOpen: true,
      isSettingsOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      // Permissions
      pendingPermission: null,
      setPendingPermission: (request) => set({ pendingPermission: request }),

      // Config
      config: defaultConfig,
      updateConfig: (updates) =>
        set((state) => ({ config: { ...state.config, ...updates } })),

      // Input
      inputValue: "",
      setInputValue: (value) => set({ inputValue: value }),

      // Loading
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "workmate-storage",
      partialize: (state) => ({
        config: state.config,
        folders: state.folders,
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
);
