"use client";

import { useState } from "react";
import { Download, Loader2, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HistoryMenu } from "@/components/workspace/history-menu";
import { ModelPicker } from "@/components/workspace/model-picker";
import { SettingsDialog } from "@/components/workspace/settings-dialog";
import { useProject } from "@/lib/store/project";
import { toast } from "@/lib/store/toast";
import { useWorkspace } from "@/lib/store/workspace";
import { writeFile } from "@/lib/webcontainer/boot";

export function AppHeader() {
  const newProject = useProject((s) => s.newProject);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as
        | { files: Array<{ path: string; content: string }> }
        | { error: string };
      if (!response.ok || "error" in payload) {
        const message = "error" in payload ? payload.error : "Import failed.";
        throw new Error(message);
      }
      useProject.getState().newProject();
      const projectId = await useProject.getState().ensureProject(url);
      const files = payload.files;
      for (const file of files) {
        await writeFile(file.path, file.content);
        useWorkspace.getState().upsertFile(file.path, file.content);
      }
      useWorkspace.getState().appendTerminal({
        stream: "system",
        text: `Imported ${files.length} files from ${url}`,
      });
      void projectId;
      toast.success("Repo imported", `${files.length} files loaded.`);
      setImportOpen(false);
      setImportUrl("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed.";
      setImportError(message);
      toast.error("Import failed", message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-2 py-2 sm:px-4">
      {/* Left cluster: logo + history dropdown + new-chat */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
          O
        </div>
        <HistoryMenu />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            newProject();
            toast.info("Started new chat");
          }}
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right cluster: model picker + actions. Model picker hides labels on
          small screens; icon-only fallbacks for import/settings. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <ModelPicker />
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Import git repo"
              title="Import git repo"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Import git</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import public GitHub repo</DialogTitle>
              <DialogDescription>
                Files will be loaded into the sandbox. Max 15MB, text files
                only.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repo"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleImport();
                }}
              />
              {importError ? (
                <p className="text-xs text-destructive">{importError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImportOpen(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importUrl.trim() || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" /> Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <SettingsDialog />
      </div>
    </header>
  );
}
