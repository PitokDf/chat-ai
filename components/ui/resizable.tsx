"use client";

import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { GripVertical, GripHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

type GroupProps = React.ComponentProps<typeof Group>;

function ResizableGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      data-slot="resizable-group"
      className={cn("h-full w-full gap-0", className)}
      {...props}
    />
  );
}

type PanelProps = React.ComponentProps<typeof Panel>;

function ResizablePanel({ className, ...props }: PanelProps) {
  return <Panel className={cn("overflow-hidden", className)} {...props} />;
}

type SeparatorProps = React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
  orientation?: "horizontal" | "vertical";
};

/**
 * Visible drag handle. Defaults to a vertical bar (for horizontal groups);
 * pass orientation="vertical" for horizontal bars (vertical groups).
 */
function ResizableHandle({
  className,
  withHandle = true,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  const vertical = orientation === "vertical";
  return (
    <Separator
      data-slot="resizable-handle"
      data-orientation={orientation}
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-transparent transition-colors",
        // The handle itself is a few px thick and turns into a highlighted
        // divider while dragging. We keep a generous hit area with padding.
        vertical
          ? "h-1.5 w-full cursor-row-resize"
          : "h-full w-1.5 cursor-col-resize",
        "hover:bg-primary/30",
        "data-[resize-handle-state=drag]:bg-primary/60",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <span
          className={cn(
            "pointer-events-none z-10 flex items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-sm",
            vertical ? "h-3 w-8" : "h-8 w-3",
          )}
        >
          {vertical ? (
            <GripHorizontal className="h-2.5 w-2.5" />
          ) : (
            <GripVertical className="h-2.5 w-2.5" />
          )}
        </span>
      ) : null}
    </Separator>
  );
}

export { ResizableGroup, ResizablePanel, ResizableHandle };
