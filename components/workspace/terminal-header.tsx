"use client";

import { useState } from "react";
import {
  Loader2,
  RefreshCw,
  Terminal as TerminalIcon,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { forceReinstall } from "@/lib/agent/executor";
import { useProject } from "@/lib/store/project";
import { useWorkspace } from "@/lib/store/workspace";
import { toast } from "@/lib/store/toast";

export function TerminalHeader() {
  const projectId = useProject((s) => s.currentProjectId);
  const status = useWorkspace((s) => s.status);
  const clearTerminal = useWorkspace((s) => s.clearTerminal);
  const [reinstalling, setReinstalling] = useState(false);

  const handleReinstall = async () => {
    if (!projectId) {
      toast.error("No project", "Start a chat first.");
      return;
    }
    setReinstalling(true);
    try {
      await forceReinstall(projectId);
      toast.success("Reinstall complete");
    } catch (err) {
      toast.error(
        "Reinstall failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      setReinstalling(false);
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <TerminalIcon className="h-3 w-3" />
        Terminal
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Force reinstall"
          title="Clear node_modules and reinstall"
          onClick={() => void handleReinstall()}
          disabled={
            !projectId ||
            reinstalling ||
            status === "installing" ||
            status === "booting"
          }
        >
          {reinstalling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Clear terminal"
          title="Clear terminal"
          onClick={() => clearTerminal()}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
