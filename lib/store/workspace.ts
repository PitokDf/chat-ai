"use client";

import type { WebContainerProcess } from "@webcontainer/api";
import { create } from "zustand";

export type WorkspaceFile = {
  path: string;
  content: string;
};

export type WorkspaceStatus =
  | "idle"
  | "booting"
  | "ready"
  | "installing"
  | "running"
  | "error";

export type TerminalLine = {
  id: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
  at: number;
};

export type BrowserLog = {
  id: string;
  level: "log" | "info" | "warn" | "error";
  args: string[];
  at: number;
};

type WorkspaceState = {
  status: WorkspaceStatus;
  previewUrl: string | null;
  /** Object URL created by the "preview" action, tracked so we can revoke. */
  previewBlobUrl: string | null;
  files: Record<string, string>;
  openFile: string | null;
  terminal: TerminalLine[];
  browserLogs: BrowserLog[];
  devProcess: WebContainerProcess | null;
  currentStart: string | null;
  setStatus: (status: WorkspaceStatus) => void;
  setPreview: (url: string | null) => void;
  setPreviewBlobUrl: (url: string | null) => void;
  upsertFile: (path: string, content: string) => void;
  setOpenFile: (path: string | null) => void;
  appendTerminal: (line: Omit<TerminalLine, "id" | "at">) => void;
  clearTerminal: () => void;
  appendBrowserLog: (log: Omit<BrowserLog, "id" | "at">) => void;
  clearBrowserLogs: () => void;
  setDevProcess: (
    process: WebContainerProcess | null,
    command?: string | null,
  ) => void;
  reset: () => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  status: "idle",
  previewUrl: null,
  previewBlobUrl: null,
  files: {},
  openFile: null,
  terminal: [],
  browserLogs: [],
  devProcess: null,
  currentStart: null,
  setStatus: (status) => set({ status }),
  setPreview: (previewUrl) => set({ previewUrl }),
  setPreviewBlobUrl: (previewBlobUrl) => set({ previewBlobUrl }),
  upsertFile: (path, content) =>
    set((state) => ({
      files: { ...state.files, [path]: content },
      openFile: state.openFile ?? path,
    })),
  setOpenFile: (openFile) => set({ openFile }),
  appendTerminal: (line) =>
    set((state) => ({
      terminal: [
        ...state.terminal,
        {
          ...line,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
        },
      ].slice(-500),
    })),
  clearTerminal: () => set({ terminal: [] }),
  appendBrowserLog: (log) =>
    set((state) => ({
      browserLogs: [
        ...state.browserLogs,
        {
          ...log,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
        },
      ].slice(-500),
    })),
  clearBrowserLogs: () => set({ browserLogs: [] }),
  setDevProcess: (process, command) =>
    set({ devProcess: process, currentStart: command ?? null }),
  reset: () =>
    set((state) => {
      if (state.previewBlobUrl) URL.revokeObjectURL(state.previewBlobUrl);
      return {
        status: "idle",
        previewUrl: null,
        previewBlobUrl: null,
        files: {},
        openFile: null,
        terminal: [],
        browserLogs: [],
        devProcess: null,
        currentStart: null,
      };
    }),
}));
