"use client";

import { useState } from "react";
import { Code2, Eye } from "lucide-react";

import { CodeEditor } from "@/components/workspace/code-editor";
import { FileTree } from "@/components/workspace/file-tree";
import { PreviewPane } from "@/components/workspace/preview-pane";
import { TerminalHeader } from "@/components/workspace/terminal-header";
import { TerminalView } from "@/components/workspace/terminal-view";
import { BrowserConsoleView } from "@/components/workspace/browser-console";
import { useWorkspace } from "@/lib/store/workspace";

type View = "code" | "preview";

export function WorkspacePane() {
  const [view, setView] = useState<View>("preview");
  const openFile = useWorkspace((s) => s.openFile);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("code")}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 ${
              view === "code"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
          <button
            type="button"
            onClick={() => setView("preview")}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 ${
              view === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
        {view === "code" && openFile ? (
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {openFile}
            </span>
            {openFile.endsWith(".html") && (
              <button
                type="button"
                onClick={() => {
                  const state = useWorkspace.getState();
                  const content = state.files[openFile];
                  if (!content) return;
                  if (state.previewBlobUrl) {
                    URL.revokeObjectURL(state.previewBlobUrl);
                  }
                  const scriptToInject = `<script>
                    ['log','info','warn','error'].forEach(m => {
                      const orig = console[m];
                      console[m] = function(...args) {
                        window.parent.postMessage({ type: 'BROWSER_CONSOLE', level: m, args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) }, '*');
                        orig.apply(console, args);
                      };
                    });
                    window.onerror = function(msg, url, line, col, error) {
                      window.parent.postMessage({ type: 'BROWSER_CONSOLE', level: 'error', args: [msg] }, '*');
                    };
                  </script>`;
                  const htmlWithConsole = content.includes("<head>")
                    ? content.replace("<head>", "<head>" + scriptToInject)
                    : scriptToInject + content;
                  const blob = new Blob([htmlWithConsole], {
                    type: "text/html",
                  });
                  const url = URL.createObjectURL(blob);
                  state.setPreview(url);
                  state.setPreviewBlobUrl(url);
                  setView("preview");
                }}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
              >
                <Eye className="h-3 w-3" /> Preview HTML
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {view === "code" ? (
          <div className="flex w-full">
            <div className="w-52 border-r border-border">
              <FileTree />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex-1 min-h-0">
                <CodeEditor />
              </div>
              <div className="h-44 shrink-0 border-t border-border">
                <TerminalHeader />
                <div className="h-[calc(100%-26px)]">
                  <TerminalView />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col">
            <div className="flex-1 min-h-0">
              <PreviewPane />
            </div>
            <div className="h-44 shrink-0 border-t border-border">
              <BrowserConsoleView />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
