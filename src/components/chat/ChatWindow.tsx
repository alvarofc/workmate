import { useCallback, useEffect, useMemo } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import { cn } from "@/lib/utils";
import { 
  CopyIcon, 
  RefreshCcwIcon, 
  SparklesIcon, 
  FolderPlusIcon,
  WifiOffIcon,
  PlugIcon,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelPicker } from "./ModelPicker";

export function ChatWindow() {
  const { 
    messages, 
    folders,
    inputValue,
    setInputValue,
    setSettingsOpen,
    isLoading,
    config,
    updateConfig
  } = useAppStore();

  const {
    isConnected,
    isConnecting,
    isInstalled,
    error: openCodeError,
    connect,
    sendMessage,
    regenerateLastMessage,
    abortSession,
  } = useOpenCode();

  // Auto-connect when folders are added
  useEffect(() => {
    if (folders.length > 0 && !isConnected && !isConnecting && isInstalled) {
      // Use the first folder as the project path
      connect(folders[0].path);
    }
  }, [folders, isConnected, isConnecting, isInstalled, connect]);

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    if (isLoading) {
      try {
        await abortSession();
      } catch (err) {
        console.error("Failed to abort session:", err);
      }
      return;
    }

    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    setInputValue("");
    // Don't set status here - let isLoading drive it

    try {
      // Convert FileUIPart to File if needed (for now we skip attachments)
      await sendMessage(message.text || "");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
    // Don't reset status here - isLoading will handle it
  }, [setInputValue, sendMessage, isLoading, abortSession]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const handleRetry = useCallback(() => {
    if (folders.length > 0) {
      connect(folders[0].path);
    }
  }, [folders, connect]);

  const handleAddFolder = useCallback(() => {
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  const handleRegenerate = useCallback(async () => {
    try {
      await regenerateLastMessage();
    } catch (err) {
      console.error("Failed to regenerate:", err);
    }
  }, [regenerateLastMessage]);

  const isEmpty = messages.length === 0;
  const hasFolders = folders.length > 0;
  const canChat = hasFolders && isConnected;
  
  // Show loader whenever we are loading, even if content is streaming
  // This ensures we always have an indicator that work is in progress
  const showLoader = isLoading;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Connection Status Banner */}
      {hasFolders && !isConnected && !isConnecting && (
        <Alert variant="destructive" className="m-4 mb-0">
          <WifiOffIcon className="h-4 w-4" />
          <AlertTitle>Not Connected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {!isInstalled 
                ? "OpenCode is not installed. Please install it first."
                : openCodeError || "Unable to connect to OpenCode server."
              }
            </span>
            {isInstalled && (
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <PlugIcon className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isConnecting && (
        <Alert className="m-4 mb-0">
          <Loader />
          <AlertTitle>Connecting...</AlertTitle>
          <AlertDescription>
            Starting OpenCode server for your project...
          </AlertDescription>
        </Alert>
      )}

      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="max-w-4xl mx-auto w-full">
          {isEmpty ? (
            <ConversationEmptyState
              icon={<SparklesIcon className="h-12 w-12" />}
              title="Welcome to Workmate"
              description={
                !hasFolders
                  ? "Add a folder to get started, then I can help you work with your files"
                  : !isInstalled
                  ? "OpenCode needs to be installed to use Workmate. Run: curl -fsSL https://opencode.ai/install | bash"
                  : isConnecting
                  ? "Connecting to OpenCode..."
                  : isConnected
                  ? "Start a conversation to work with your files"
                  : "Click retry to connect to OpenCode"
              }
            >
              {!hasFolders && (
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2"
                  onClick={handleAddFolder}
                >
                  <FolderPlusIcon className="h-4 w-4" />
                  Add a folder
                </Button>
              )}
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <div key={message.id}>
                {message.parts?.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>
                              {part.content}
                            </MessageResponse>
                          </MessageContent>
                          {message.role === "assistant" && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => handleCopy(part.content)}
                                label="Copy"
                                tooltip="Copy to clipboard"
                              >
                                <CopyIcon className="h-3 w-3" />
                              </MessageAction>
                              {message.id === lastAssistantId && (
                                <MessageAction
                                  onClick={handleRegenerate}
                                  label="Retry"
                                  tooltip="Regenerate response"
                                  disabled={isLoading}
                                >
                                  <RefreshCcwIcon className="h-3 w-3" />
                                </MessageAction>
                              )}
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case "reasoning":
                      return (
                        <Reasoning key={`${message.id}-${i}`} isStreaming={message.status === "streaming"}>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.content}</ReasoningContent>
                        </Reasoning>
                      );
                    case "tool_use": {
                      // Map our status to ToolUIPart state
                      const toolState = part.status === "running" 
                        ? "input-available" as const
                        : part.status === "pending"
                        ? "input-streaming" as const
                        : "input-available" as const;
                      
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader 
                            title={part.toolName} 
                            type="tool-invocation"
                            state={toolState}
                          />
                          <ToolContent>
                            <ToolInput input={part.toolInput || part.content} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    case "tool_result": {
                      // Map our status to ToolUIPart state
                      const toolState = part.status === "error"
                        ? "output-error" as const
                        : "output-available" as const;
                      
                      return (
                        <Tool key={`${message.id}-${i}`} defaultOpen={part.status === "error"}>
                          <ToolHeader 
                            title={part.toolName} 
                            type="tool-invocation"
                            state={toolState}
                          />
                          <ToolContent>
                            {part.toolInput && (
                              <ToolInput input={part.toolInput} />
                            )}
                            <ToolOutput 
                              output={part.toolOutput || part.content} 
                              errorText={part.toolError} 
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    default:
                      return null;
                  }
                }) ?? (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <MessageResponse>
                        {message.content}
                      </MessageResponse>
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))
          )}
          {showLoader && (
            <div className="flex items-center gap-2 p-4 text-muted-foreground">
              <Loader size={20} />
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <PromptInput onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={
                !hasFolders
                  ? "Add a folder first..."
                  : !isConnected
                  ? "Waiting for connection..."
                  : "Ask me anything about your files..."
              }
              onChange={(e) => setInputValue(e.target.value)}
              value={inputValue}
              disabled={!canChat}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelPicker />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 px-2.5 h-8 text-sm font-medium rounded-sm ml-1",
                  config.isWebBrowsingEnabled 
                    ? "bg-primary/10 text-primary hover:bg-primary/20" 
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                )}
                onClick={() => updateConfig({ isWebBrowsingEnabled: !config.isWebBrowsingEnabled })}
                title={config.isWebBrowsingEnabled ? "Web browsing enabled" : "Enable web browsing"}
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="sr-only">Web Browsing</span>
              </Button>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit 
              disabled={(!inputValue.trim() && !isLoading) || !canChat} 
              status={isLoading ? "streaming" : "ready"}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
