"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type McpServerConfig = {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  active: boolean;
};

export type McpState = {
  servers: McpServerConfig[];
  addServer: (server: Omit<McpServerConfig, "id">) => void;
  updateServer: (id: string, server: Partial<McpServerConfig>) => void;
  deleteServer: (id: string) => void;
  toggleServer: (id: string, active: boolean) => void;
};

export const useMcp = create<McpState>()(
  persist(
    (set) => ({
      servers: [],
      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers, { ...server, id: nanoid(8) }],
        })),
      updateServer: (id, updated) =>
        set((state) => ({
          servers: state.servers.map((s) => (s.id === id ? { ...s, ...updated } : s)),
        })),
      deleteServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
        })),
      toggleServer: (id, active) =>
        set((state) => ({
          servers: state.servers.map((s) => (s.id === id ? { ...s, active } : s)),
        })),
    }),
    {
      name: "orbit-mcp",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
