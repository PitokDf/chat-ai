"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspace } from "@/lib/store/workspace";
import { getWebContainer } from "@/lib/webcontainer/boot";

// Remove common ANSI escape sequences so logs stay readable.
const stripAnsi = (input: string) =>
  input.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");

export function TerminalView() {
  const terminal = useWorkspace((s) => s.terminal);
  const appendTerminal = useWorkspace((s) => s.appendTerminal);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [command, setCommand] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminal]);

  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && command.trim()) {
      const cmd = command.trim();
      setCommand("");
      appendTerminal({ stream: "system", text: `$ ${cmd}` });
      try {
        const wc = await getWebContainer();
        const process = await wc.spawn("jsh", ["-c", cmd]);
        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              appendTerminal({ stream: "stdout", text: stripAnsi(chunk) });
            },
          }),
        );
        const exitCode = await process.exit;
        if (exitCode !== 0) {
          appendTerminal({
            stream: "stderr",
            text: `Command failed with exit code ${exitCode}`,
          });
        }
      } catch (err) {
        appendTerminal({
          stream: "stderr",
          text: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0b0d10]">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-5 text-foreground/90"
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
      <div className="shrink-0 border-t border-border/10 bg-[#0b0d10] px-3 py-1.5 font-mono text-[11.5px]">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">❯</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleCommand}
            placeholder="Type a command and press Enter..."
            className="flex-1 bg-transparent text-foreground/90 focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  );
}
