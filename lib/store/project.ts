"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getDb, type MessageRecord, type ProjectRecord } from "@/lib/db";
import { clearCachedFingerprint } from "@/lib/agent/install-cache";
import { useChat } from "@/lib/store/chat";
import { useWorkspace } from "@/lib/store/workspace";

export type ProjectState = {
  currentProjectId: string | null;
  projects: ProjectRecord[];
  setCurrentProject: (id: string) => void;
  ensureProject: (name?: string) => Promise<string>;
  refreshProjects: () => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  newProject: () => void;
};

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProjectId: null,
      projects: [],

      setCurrentProject: (id) => {
        if (get().currentProjectId === id) return;
        set({ currentProjectId: id });
        // Switching projects wipes the live chat state so the hydration
        // effect in app/page.tsx reloads from IndexedDB.
        useChat.getState().reset();
        useWorkspace.getState().reset();
      },

      ensureProject: async (name?: string) => {
        const current = get().currentProjectId;
        if (current) {
          const existing = await getDb().projects.get(current);
          if (existing) return existing.id;
        }
        const id = nanoid(10);
        const now = Date.now();
        const record: ProjectRecord = {
          id,
          name: name ?? "Untitled project",
          createdAt: now,
          updatedAt: now,
        };
        await getDb().projects.put(record);
        set({
          currentProjectId: id,
          projects: [record, ...get().projects],
        });
        return id;
      },

      refreshProjects: async () => {
        const rows = await getDb()
          .projects.orderBy("updatedAt")
          .reverse()
          .toArray();
        set({ projects: rows });
      },

      renameProject: async (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        await getDb().projects.update(id, {
          name: trimmed,
          updatedAt: Date.now(),
        });
        await get().refreshProjects();
      },

      deleteProject: async (id) => {
        await getDb().projects.delete(id);
        await getDb().messages.where("projectId").equals(id).delete();
        await getDb().files.where("projectId").equals(id).delete();
        await getDb().nodeModules.delete(id);
        clearCachedFingerprint(id);
        const next = get().projects.filter((p) => p.id !== id);
        set({ projects: next });
        if (get().currentProjectId === id) {
          set({ currentProjectId: null });
          useChat.getState().reset();
          useWorkspace.getState().reset();
        }
      },

      newProject: () => {
        // Clear the current project so the next message creates a new one.
        set({ currentProjectId: null });
        useChat.getState().reset();
        useWorkspace.getState().reset();
      },
    }),
    {
      name: "orbit-project",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentProjectId: state.currentProjectId }),
    },
  ),
);

/** Save a message and refresh the project list so sort-by-recent works. */
export const saveMessage = async (record: MessageRecord) => {
  await getDb().messages.put(record);
  await getDb().projects.update(record.projectId, { updatedAt: Date.now() });
  await useProject.getState().refreshProjects();
};

export const loadMessages = async (projectId: string) => {
  return getDb()
    .messages.where("[projectId+createdAt]")
    .between([projectId, 0], [projectId, Infinity])
    .sortBy("createdAt");
};
