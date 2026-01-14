import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileEditIcon, 
  FilePlusIcon, 
  Trash2Icon, 
  TerminalIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  EyeIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PermissionRequest } from "@/types";

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onApprove: (remember?: boolean) => void;
  onDeny: (remember?: boolean) => void;
  onClose: () => void;
}

const PERMISSION_CONFIG: Record<string, {
  icon: typeof FileEditIcon;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  dangerous?: boolean;
}> = {
  file_edit: {
    icon: FileEditIcon,
    title: "Edit File",
    description: "The assistant wants to modify a file",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  file_create: {
    icon: FilePlusIcon,
    title: "Create File",
    description: "The assistant wants to create a new file",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  file_delete: {
    icon: Trash2Icon,
    title: "Delete File",
    description: "The assistant wants to delete a file",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    dangerous: true,
  },
  shell_command: {
    icon: TerminalIcon,
    title: "Run Command",
    description: "The assistant wants to run a terminal command",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    dangerous: true,
  },
};

export function PermissionDialog({
  request,
  onApprove,
  onDeny,
  onClose,
}: PermissionDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  if (!request) return null;

  const config = PERMISSION_CONFIG[request.type];
  const Icon = config.icon;
  const isDangerous = config.dangerous;

  const handleApprove = () => {
    onApprove(rememberChoice);
    onClose();
  };

  const handleDeny = () => {
    onDeny(rememberChoice);
    onClose();
  };

  return (
    <Dialog open={!!request} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {config.title}
                {isDangerous && (
                  <Badge variant="destructive" className="text-xs">
                    <ShieldAlertIcon className="h-3 w-3 mr-1" />
                    Requires Attention
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* What the assistant wants to do */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              What the assistant wants to do:
            </h4>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {request.description}
            </p>
          </div>

          {/* File path if applicable */}
          {request.details.path && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">File:</h4>
              <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                {request.details.path}
              </code>
            </div>
          )}

          {/* Command if applicable */}
          {request.details.command && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                Command:
                <Badge variant="outline" className="text-xs">
                  <TerminalIcon className="h-3 w-3 mr-1" />
                  Shell
                </Badge>
              </h4>
              <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto font-mono">
                {request.details.command}
              </code>
            </div>
          )}

          {/* Diff preview if available */}
          {request.details.diff && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Changes:</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  className="text-xs"
                >
                  <EyeIcon className="h-3 w-3 mr-1" />
                  {showDiff ? "Hide" : "Show"} Diff
                </Button>
              </div>
              {showDiff && (
                <ScrollArea className="h-48 rounded-lg border">
                  <pre className="p-3 text-xs font-mono">
                    {request.details.diff.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          line.startsWith("+") && !line.startsWith("+++")
                            ? "bg-green-500/20 text-green-400"
                            : line.startsWith("-") && !line.startsWith("---")
                            ? "bg-red-500/20 text-red-400"
                            : line.startsWith("@@")
                            ? "text-blue-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                </ScrollArea>
              )}
            </div>
          )}

          <Separator />

          {/* Remember choice option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">
              Remember my choice for similar actions in this session
            </span>
          </label>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleDeny}
            className="flex-1 sm:flex-none"
          >
            <XIcon className="h-4 w-4 mr-1" />
            Deny
          </Button>
          <Button
            variant={isDangerous ? "destructive" : "default"}
            onClick={handleApprove}
            className="flex-1 sm:flex-none"
          >
            <CheckIcon className="h-4 w-4 mr-1" />
            {isDangerous ? "Allow Anyway" : "Allow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for showing inline permission requests in chat
interface InlinePermissionProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
  isPending?: boolean;
}

export function InlinePermission({
  request,
  onApprove,
  onDeny,
  isPending = true,
}: InlinePermissionProps) {
  const config = PERMISSION_CONFIG[request.type];
  const Icon = config.icon;

  if (!isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheckIcon className="h-4 w-4 text-green-500" />
        <span>Permission granted for: {request.description}</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4", config.bgColor)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg bg-background")}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h4 className="font-medium text-sm">{config.title}</h4>
            <p className="text-sm text-muted-foreground">{request.description}</p>
          </div>
          {request.details.path && (
            <code className="text-xs bg-background/50 px-2 py-1 rounded block">
              {request.details.path}
            </code>
          )}
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={onDeny}>
              <XIcon className="h-3 w-3 mr-1" />
              Deny
            </Button>
            <Button size="sm" onClick={onApprove}>
              <CheckIcon className="h-3 w-3 mr-1" />
              Allow
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
