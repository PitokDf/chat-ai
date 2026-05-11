"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type MemoryRecord = {
  id: string;
  fact: string;
  createdAt: number;
};

export type MemoryState = {
  memories: MemoryRecord[];
  addMemory: (fact: string) => void;
  updateMemory: (id: string, fact: string) => void;
  deleteMemory: (id: string) => void;
  clearMemories: () => void;
};

export const useMemory = create<MemoryState>()(
  persist(
    (set) => ({
      memories: [],
      addMemory: (fact) =>
        set((state) => ({
          memories: [...state.memories, { id: nanoid(8), fact, createdAt: Date.now() }],
        })),
      updateMemory: (id, fact) =>
        set((state) => ({
          memories: state.memories.map((m) => (m.id === id ? { ...m, fact } : m)),
        })),
      deleteMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
      clearMemories: () => set({ memories: [] }),
    }),
    {
      name: "orbit-memory",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
