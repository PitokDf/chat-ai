"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type CronJob = {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  providerId: string;
  modelId: string;
  lastRunAt: number | null;
  lastResult: string | null;
};

export type CronState = {
  jobs: CronJob[];
  addJob: (job: Omit<CronJob, "id" | "lastRunAt" | "lastResult">) => void;
  updateJob: (id: string, data: Partial<Omit<CronJob, "id">>) => void;
  removeJob: (id: string) => void;
  toggleJob: (id: string) => void;
  setJobResult: (id: string, result: string) => void;
  runNow: (id: string) => Promise<string | null>;
};

const impl = create<CronState>()(
  persist(
    (set, get) => ({
      jobs: [],
      addJob: (job) =>
        set((state) => ({
          jobs: [
            ...state.jobs,
            {
              ...job,
              id: nanoid(8),
              lastRunAt: null,
              lastResult: null,
            },
          ],
        })),
      updateJob: (id, data) =>
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...data } : j)),
        })),
      removeJob: (id) =>
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
        })),
      toggleJob: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, enabled: !j.enabled } : j,
          ),
        })),
      setJobResult: (id, result) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, lastResult: result, lastRunAt: Date.now() }
              : j,
          ),
        })),
      runNow: async (id) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return null;

        const { selectCurrentKey } = await import("@/lib/store/settings");
        const { useSettings } = await import("@/lib/store/settings");
        const { useSkills } = await import("@/lib/store/skills");
        const { useMemory } = await import("@/lib/store/memory");
        const settings = useSettings.getState();
        const apiKey = selectCurrentKey(settings);
        if (!apiKey) return null;

        try {
          const res = await fetch("/api/channels/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: job.prompt,
              providerId: job.providerId,
              modelId: job.modelId,
              apiKey,
              skills: useSkills.getState().skills ?? [],
              memories: useMemory.getState().memories ?? [],
            }),
          });
          if (!res.ok) return null;
          const data = (await res.json()) as { text?: string };
          const resultText = data.text ?? null;
          set((state) => ({
            jobs: state.jobs.map((j) =>
              j.id === id
                ? { ...j, lastResult: resultText, lastRunAt: Date.now() }
                : j,
            ),
          }));
          return resultText;
        } catch {
          return null;
        }
      },
    }),
    {
      name: "orbit-cron",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const useCron = impl;
