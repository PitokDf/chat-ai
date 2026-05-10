"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { ProviderId } from "@/lib/providers";
import { findDefaultModel } from "@/lib/providers";

type ApiKeys = Partial<Record<ProviderId, string>>;

export type SettingsState = {
  apiKeys: ApiKeys;
  providerId: ProviderId;
  modelId: string;
  setKey: (provider: ProviderId, key: string) => void;
  clearKey: (provider: ProviderId) => void;
  setModel: (providerId: ProviderId, modelId: string) => void;
};

const defaultSelection = findDefaultModel();

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {},
      providerId: defaultSelection.providerId,
      modelId: defaultSelection.modelId,
      setKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key.trim() },
        })),
      clearKey: (provider) =>
        set((state) => {
          const next = { ...state.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        }),
      setModel: (providerId, modelId) => set({ providerId, modelId }),
    }),
    {
      name: "orbit-settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export const selectCurrentKey = (state: SettingsState) =>
  state.apiKeys[state.providerId] ?? "";
