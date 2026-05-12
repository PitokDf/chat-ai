"use client";

import { useState, useEffect } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store/workspace";

export function PreviewPane() {
  const previewUrl = useWorkspace((s) => s.previewUrl);
  const status = useWorkspace((s) => s.status);
  const appendBrowserLog = useWorkspace((s) => s.appendBrowserLog);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "BROWSER_CONSOLE") {
        appendBrowserLog({
          level: e.data.level,
          args: e.data.args,
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [appendBrowserLog]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "running"
                ? "bg-emerald-400"
                : status === "installing"
                  ? "bg-amber-400"
                  : status === "error"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
            }`}
          />
          {status === "running" && previewUrl
            ? previewUrl
            : status === "installing"
              ? "Installing dependencies..."
              : status === "ready"
                ? "Ready"
                : status === "booting"
                  ? "Booting runtime..."
                  : status === "error"
                    ? "Runtime error"
                    : "Idle"}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={!previewUrl}
            onClick={() => setNonce((n) => n + 1)}
            aria-label="Reload preview"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={!previewUrl}
            onClick={() => previewUrl && window.open(previewUrl, "_blank")}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1">
        {previewUrl ? (
          <iframe
            key={`${previewUrl}-${nonce}`}
            src={previewUrl}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
            title="Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/20 text-center text-xs text-muted-foreground">
            <div className="max-w-xs">
              <p className="font-medium text-foreground">Preview is offline</p>
              <p className="mt-1">
                Ask the agent to build something to boot the sandbox and start a
                dev server here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
