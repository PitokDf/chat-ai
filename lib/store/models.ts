"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  getProvider,
  type ProviderId,
  type ProviderModel,
} from "@/lib/providers";

export type ModelListStatus =
  | "idle"
  | "loading"
  | "live"
  | "fallback"
  | "error";

export type ModelListEntry = {
  models: ProviderModel[];
  status: ModelListStatus;
  error?: string;
  /** Timestamp of last successful fetch, used to avoid refetching too often. */
  lastFetched?: number;
  /** Fingerprint of the api key used when the list was fetched. */
  keyFingerprint?: string;
};

type ModelsState = {
  byProvider: Partial<Record<ProviderId, ModelListEntry>>;
  /** Track an in-flight promise so concurrent callers share the work. */
  pending: Partial<Record<ProviderId, Promise<void>>>;
  fetchModels: (providerId: ProviderId, apiKey: string) => Promise<void>;
  getEntry: (providerId: ProviderId) => ModelListEntry;
};

const STALE_MS = 1000 * 60 * 10; // 10 minutes

const fingerprint = (apiKey: string) =>
  apiKey ? `${apiKey.slice(0, 4)}:${apiKey.length}` : "";

export const useModels = create<ModelsState>()(
  persist(
    (set, get) => ({
      byProvider: {},
      pending: {},

      getEntry: (providerId) => {
        const cached = get().byProvider[providerId];
        if (cached) return cached;
        const definition = getProvider(providerId);
        return {
          models: definition?.models ?? [],
          status: "fallback",
        };
      },

      fetchModels: async (providerId, apiKey) => {
        const key = fingerprint(apiKey);
        const existing = get().byProvider[providerId];
        const isFresh =
          existing?.lastFetched &&
          Date.now() - existing.lastFetched < STALE_MS &&
          existing.keyFingerprint === key &&
          existing.status === "live";
        if (isFresh) return;

        const inflight = get().pending[providerId];
        if (inflight) return inflight;

        const definition = getProvider(providerId);
        const fallbackModels = definition?.models ?? [];

        set((state) => ({
          byProvider: {
            ...state.byProvider,
            [providerId]: {
              models: existing?.models?.length
                ? existing.models
                : fallbackModels,
              status: "loading",
              keyFingerprint: key,
            },
          },
        }));

        const task = (async () => {
          try {
            const res = await fetch("/api/providers/models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ providerId, apiKey }),
            });
            const payload = (await res.json()) as
              | {
                  models: ProviderModel[];
                  source: "live" | "fallback";
                  reason?: string;
                }
              | { error: string };
            if (!res.ok || "error" in payload) {
              const message =
                "error" in payload
                  ? payload.error
                  : `Request failed ${res.status}`;
              set((state) => ({
                byProvider: {
                  ...state.byProvider,
                  [providerId]: {
                    models: fallbackModels,
                    status: "error",
                    error: message,
                    keyFingerprint: key,
                  },
                },
              }));
              return;
            }
            set((state) => ({
              byProvider: {
                ...state.byProvider,
                [providerId]: {
                  models: payload.models,
                  status: payload.source === "live" ? "live" : "fallback",
                  error: payload.source === "live" ? undefined : payload.reason,
                  lastFetched:
                    payload.source === "live" ? Date.now() : undefined,
                  keyFingerprint: key,
                },
              },
            }));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Network error";
            set((state) => ({
              byProvider: {
                ...state.byProvider,
                [providerId]: {
                  models: fallbackModels,
                  status: "error",
                  error: message,
                  keyFingerprint: key,
                },
              },
            }));
          } finally {
            set((state) => ({
              pending: { ...state.pending, [providerId]: undefined },
            }));
          }
        })();

        set((state) => ({ pending: { ...state.pending, [providerId]: task } }));
        await task;
      },
    }),
    {
      name: "orbit-models",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Don't persist in-flight promises.
      partialize: (state) => ({ byProvider: state.byProvider }),
    },
  ),
);
