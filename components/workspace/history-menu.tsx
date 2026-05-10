"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckIndicator,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/lib/store/project";
import { toast } from "@/lib/store/toast";

const formatRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString();
};

export function HistoryMenu() {
  const projects = useProject((s) => s.projects);
  const currentProjectId = useProject((s) => s.currentProjectId);
  const refreshProjects = useProject((s) => s.refreshProjects);
  const setCurrentProject = useProject((s) => s.setCurrentProject);
  const deleteProject = useProject((s) => s.deleteProject);
  const newProject = useProject((s) => s.newProject);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (open) void refreshProjects();
  }, [open, refreshProjects]);

  const current = useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId],
  );

  const label = current?.name ?? "New chat";

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProject(pendingDelete.id);
      toast.success("Chat deleted", pendingDelete.name);
    } catch (err) {
      toast.error(
        "Could not delete chat",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 max-w-[50px] md:max-w-[200px]"
          >
            <History className="h-3.5 w-3.5" />
            <span className="truncate text-xs">{label}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-w-[50px] md:w-[280px]"
        >
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              newProject();
              setOpen(false);
              toast.info("Started new chat");
            }}
            className="font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
          {projects.length === 0 ? (
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              No chats yet. Start a new one above.
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {projects.map((project) => {
                const active = project.id === currentProjectId;
                return (
                  <DropdownMenuItem
                    key={project.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      setCurrentProject(project.id);
                      setOpen(false);
                    }}
                    className="group items-start gap-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs font-medium text-foreground">
                        {project.name || "Untitled"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelative(project.updatedAt)}
                      </span>
                    </div>
                    <DropdownMenuCheckIndicator active={active} />
                    <button
                      type="button"
                      aria-label={`Delete ${project.name}`}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPendingDelete({
                          id: project.id,
                          name: project.name,
                        });
                        setOpen(false);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  &ldquo;{pendingDelete.name}&rdquo; and its files will be
                  removed from this browser. This can&rsquo;t be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" size="sm" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="sm"
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmDelete();
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
