"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store/workspace";

export function BrowserConsoleView() {
  const browserLogs = useWorkspace((s) => s.browserLogs);
  const clearBrowserLogs = useWorkspace((s) => s.clearBrowserLogs);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [browserLogs]);

  return (
    <div className="flex h-full flex-col bg-[#0b0d10]">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-[#0b0d10] px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Browser Console
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={clearBrowserLogs}
          className="h-6 w-6"
          title="Clear console"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-5 text-foreground/90"
      >
        {browserLogs.length === 0 ? (
          <p className="text-muted-foreground">
            Logs from the HTML preview will appear here.
          </p>
        ) : (
          browserLogs.map((log) => (
            <div
              key={log.id}
              className={`mb-1 flex gap-2 border-b border-border/5 pb-1 ${
                log.level === "error"
                  ? "text-red-400"
                  : log.level === "warn"
                    ? "text-amber-400"
                    : "text-blue-200"
              }`}
            >
              <span className="shrink-0 text-muted-foreground/50 select-none">
                {new Date(log.at).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="whitespace-pre-wrap break-words">
                {log.args.join(" ")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
