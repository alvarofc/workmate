import { useState, useCallback, useEffect } from "react";
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
import { Loader } from "@/components/ai-elements/loader";
import { useAppStore } from "@/stores/appStore";
import { useOpenCode } from "@/hooks/useOpenCode";
import { 
  CopyIcon, 
  RefreshCcwIcon, 
  SparklesIcon, 
  FolderPlusIcon,
  WifiOffIcon,
  PlugIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ChatWindow() {
  const { 
    messages, 
    folders,
    inputValue,
    setInputValue,
    setSettingsOpen,
    isLoading,
  } = useAppStore();

  const {
    isConnected,
    isConnecting,
    isInstalled,
    error: openCodeError,
    connect,
    sendMessage,
  } = useOpenCode();

  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">("ready");

  // Auto-connect when folders are added
  useEffect(() => {
    if (folders.length > 0 && !isConnected && !isConnecting && isInstalled) {
      // Use the first folder as the project path
      connect(folders[0].path);
    }
  }, [folders, isConnected, isConnecting, isInstalled, connect]);

  // Update status based on loading state
  useEffect(() => {
    setStatus(isLoading ? "streaming" : "ready");
  }, [isLoading]);

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    setInputValue("");
    setStatus("submitted");

    try {
      // Convert FileUIPart to File if needed (for now we skip attachments)
      await sendMessage(message.text || "");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setStatus("ready");
    }
  }, [setInputValue, sendMessage]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleAddFolder = useCallback(() => {
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  const handleRetry = useCallback(() => {
    if (folders.length > 0) {
      connect(folders[0].path);
    }
  }, [folders, connect]);

  const isEmpty = messages.length === 0;
  const hasFolders = folders.length > 0;
  const canChat = hasFolders && isConnected;
  
  const lastMessage = messages[messages.length - 1];
  const isStreamingResponse = lastMessage?.role === "assistant" && lastMessage?.status === "streaming";
  // Only show bottom loader if we're waiting for a response but haven't started receiving it yet
  const showLoader = status === "submitted" || (status === "streaming" && !isStreamingResponse);

  return (
    <div className="flex flex-col h-full">
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

      <Conversation className="flex-1">
        <ConversationContent>
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
                              <MessageAction
                                onClick={() => {/* TODO: Regenerate */}}
                                label="Retry"
                                tooltip="Regenerate response"
                              >
                                <RefreshCcwIcon className="h-3 w-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case "tool_use":
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader 
                            title={part.toolName} 
                            type="tool-invocation"
                            state="input-available"
                          />
                          <ToolContent>
                            <ToolInput input={part.content} />
                          </ToolContent>
                        </Tool>
                      );
                    case "tool_result":
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader 
                            title={part.toolName} 
                            type="tool-invocation"
                            state="output-available"
                          />
                          <ToolContent>
                            <ToolOutput output={part.content} errorText={undefined} />
                          </ToolContent>
                        </Tool>
                      );
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
          {showLoader && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
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
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit 
              disabled={!inputValue.trim() || !canChat} 
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
