"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { writeFile } from "@/lib/webcontainer/boot";
import { useWorkspace } from "@/lib/store/workspace";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const detectLanguage = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "plaintext";
  }
};

export function CodeEditor() {
  const files = useWorkspace((s) => s.files);
  const openFile = useWorkspace((s) => s.openFile);
  const upsertFile = useWorkspace((s) => s.upsertFile);

  const content = openFile ? (files[openFile] ?? "") : "";
  const language = useMemo(
    () => (openFile ? detectLanguage(openFile) : "plaintext"),
    [openFile],
  );

  if (!openFile) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Select a file to view its contents.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Monaco
        height="100%"
        theme="vs-dark"
        language={language}
        path={openFile}
        value={content}
        options={{
          fontSize: 12.5,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
        }}
        onChange={(value) => {
          const next = value ?? "";
          upsertFile(openFile, next);
          void writeFile(openFile, next);
        }}
      />
    </div>
  );
}
