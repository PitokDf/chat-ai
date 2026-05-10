"use client";

import { useEffect, useRef } from "react";

import { useWorkspace } from "@/lib/store/workspace";

// Remove common ANSI escape sequences so logs stay readable.
const stripAnsi = (input: string) =>
  input.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");

export function TerminalView() {
  const terminal = useWorkspace((s) => s.terminal);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminal]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-[#0b0d10] px-3 py-2 font-mono text-[11.5px] leading-5 text-foreground/90"
    >
      {terminal.length === 0 ? (
        <p className="text-muted-foreground">
          Terminal output from the WebContainer will appear here.
        </p>
      ) : (
        terminal.map((line) => (
          <pre
            key={line.id}
            className={
              line.stream === "stderr"
                ? "whitespace-pre-wrap text-red-300"
                : line.stream === "system"
                  ? "whitespace-pre-wrap text-emerald-300"
                  : "whitespace-pre-wrap text-foreground/85"
            }
          >
            {stripAnsi(line.text)}
          </pre>
        ))
      )}
    </div>
  );
}
