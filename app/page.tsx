"use client";

import { useEffect, useRef } from "react";

import { AppHeader } from "@/components/workspace/app-header";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { MobileTabs } from "@/components/workspace/mobile-tabs";
import { MusicPlayer } from "@/components/workspace/music-player";
import { WorkspacePane } from "@/components/workspace/workspace-pane";
import {
  ResizableGroup,
  ResizableHandle,
  ResizablePanel,
} from "@/components/ui/resizable";
import { restoreProjectToContainer } from "@/lib/agent/executor";
import { useChat } from "@/lib/store/chat";
import { loadMessages, useProject } from "@/lib/store/project";
import { toast } from "@/lib/store/toast";
import type { ChatMessage, ChatToolCall } from "@/lib/store/chat";

const parseToolCalls = (raw: string | undefined): ChatToolCall[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatToolCall =>
        !!item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { toolName?: unknown }).toolName === "string",
    );
  } catch {
    return [];
  }
};

/**
 * Parse any orbitArtifact blocks stored inside a historical assistant
 * message so the UI can re-render them without re-running actions.
 */
const rehydrateAssistantMessage = (
  id: string,
  raw: string,
  createdAt: number,
  toolCallsRaw?: string,
): ChatMessage => {
  const message: ChatMessage = {
    id,
    role: "assistant",
    text: raw,
    artifacts: [],
    toolCalls: parseToolCalls(toolCallsRaw),
    status: "done",
    createdAt,
  };
  const artifactRegex =
    /<orbitArtifact\s+id="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/orbitArtifact>/g;
  const actionRegex =
    /<orbitAction\s+type="([^"]+)"(?:\s+filePath="([^"]+)")?>([\s\S]*?)<\/orbitAction>/g;
  let firstArtifactIndex = -1;
  let match: RegExpExecArray | null;
  let actionCounter = 0;
  while ((match = artifactRegex.exec(raw)) !== null) {
    if (firstArtifactIndex === -1) firstArtifactIndex = match.index;
    const [, aid, title, body] = match;
    const actions = [];
    let am: RegExpExecArray | null;
    const subRegex = new RegExp(actionRegex.source, "g");
    while ((am = subRegex.exec(body)) !== null) {
      const [, type, filePath, content] = am;
      actions.push({
        id: actionCounter++,
        type: type as "file" | "shell" | "start",
        filePath,
        content: content.replace(/^\r?\n/, "").replace(/\r?\n\s*$/, ""),
        status: "done" as const,
      });
    }
    message.artifacts.push({ id: aid, title, actions });
  }
  if (firstArtifactIndex >= 0) {
    message.text = raw.slice(0, firstArtifactIndex).trim();
  }
  return message;
};

export default function Page() {
  const currentProjectId = useProject((s) => s.currentProjectId);
  // Track the project whose messages we've already hydrated into the store
  // so we don't re-run the load when the store itself is the source of truth
  // (e.g. after a brand-new project is created by sending a message).
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) {
      loadedRef.current = null;
      return;
    }

    // Same project we already loaded? Nothing to do.
    if (loadedRef.current === currentProjectId) return;

    // If the chat store already has messages tagged to this project
    // (e.g. we just created it via sendChatMessage), keep those.
    const memory = useChat.getState().messages;
    if (memory.length > 0) {
      loadedRef.current = currentProjectId;
      return;
    }

    let cancelled = false;
    loadedRef.current = currentProjectId;

    (async () => {
      const rows = await loadMessages(currentProjectId);
      if (cancelled) return;

      // Another send may have enqueued messages while the DB was being read.
      // Only hydrate when the store is still empty to avoid clobbering them.
      if (useChat.getState().messages.length > 0) return;

      const restored: ChatMessage[] = rows.map((row) =>
        row.role === "assistant"
          ? rehydrateAssistantMessage(
              row.id,
              row.content,
              row.createdAt,
              row.toolCalls,
            )
          : {
              id: row.id,
              role: "user",
              text: row.content,
              artifacts: [],
              toolCalls: [],
              status: "done",
              createdAt: row.createdAt,
            },
      );
      useChat.getState().setMessages(restored);

      // Nothing historical to restore for brand-new empty projects.
      if (restored.length === 0) return;

      // Rebuild the WebContainer FS from the snapshot so follow-up prompts
      // (or manual terminal commands) can run against a valid project.
      // This also auto-installs deps and starts the dev server if there's
      // a package.json with a "dev" script, matching the original session.
      try {
        await restoreProjectToContainer(currentProjectId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Could not restore sandbox", message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentProjectId]);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <MusicPlayer />
      <main className="flex min-h-0 flex-1 overflow-hidden p-3">
        <div className="hidden h-full w-full md:block">
          <ResizableGroup orientation="horizontal" id="orbit-layout-v2">
            <ResizablePanel
              id="chat"
              defaultSize={400}
              minSize={200}
              maxSize={560}
            >
              <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                <ChatPanel />
              </section>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="workspace" minSize={30}>
              <section className="h-full overflow-hidden">
                <WorkspacePane />
              </section>
            </ResizablePanel>
          </ResizableGroup>
        </div>
        <div className="h-full w-full md:hidden">
          <MobileTabs />
        </div>
      </main>
    </div>
  );
}
