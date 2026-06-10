"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { ProviderId } from "@/lib/providers";

export type AgentRecord = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: ProviderId;
  modelId: string;
  enabled: boolean;
};

export type AgentsState = {
  agents: AgentRecord[];
  activeAgentId: string | null;
  addAgent: (agent: Omit<AgentRecord, "id">) => void;
  updateAgent: (id: string, agent: Partial<Omit<AgentRecord, "id">>) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
};

export const useAgents = create<AgentsState>()(
  persist(
    (set) => ({
      agents: [],
      activeAgentId: null,

      addAgent: (agent) =>
        set((state) => ({
          agents: [...state.agents, { ...agent, id: nanoid(8) }],
        })),

      updateAgent: (id, updated) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updated } : a)),
        })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
        })),

      setActiveAgent: (id) => set({ activeAgentId: id }),
    }),
    {
      name: "orbit-agents",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
