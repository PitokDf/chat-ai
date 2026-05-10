"use client";

import { useState } from "react";
import { MessageSquare, Layers } from "lucide-react";

import { ChatPanel } from "@/components/workspace/chat-panel";
import { WorkspacePane } from "@/components/workspace/workspace-pane";
import { cn } from "@/lib/utils";

type Tab = "chat" | "workspace";

/**
 * Mobile layout: chat and workspace share a single viewport via a bottom
 * tab bar. Prevents the resize handle from being useless on small screens.
 */
export function MobileTabs() {
  const [tab, setTab] = useState<Tab>("chat");
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex-1 min-h-0">
        {tab === "chat" ? (
          <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
            <ChatPanel />
          </section>
        ) : (
          <section className="h-full overflow-hidden">
            <WorkspacePane />
          </section>
        )}
      </div>
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs transition",
            tab === "chat"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <MessageSquare className="mr-1 inline h-3.5 w-3.5" /> Chat
        </button>
        <button
          type="button"
          onClick={() => setTab("workspace")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs transition",
            tab === "workspace"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Layers className="mr-1 inline h-3.5 w-3.5" /> Workspace
        </button>
      </div>
    </div>
  );
}
