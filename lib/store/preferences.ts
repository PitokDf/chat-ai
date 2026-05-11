"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "system" | "dark" | "light";
export type AccentColor = "default" | "sky" | "emerald" | "violet" | "amber";
export type FontSize = "sm" | "md" | "lg";
export type SearchProvider = "none" | "duckduckgo" | "brave" | "serper" | "tavily";

export type PreferencesState = {
  theme: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  compactMode: boolean;
  sendOnEnter: boolean;
  reduceMotion: boolean;
  
  // Search Settings
  searchProvider: SearchProvider;
  braveSearchKey: string;
  serperApiKey: string;
  tavilyApiKey: string;

  // Telegram integration
  telegramBotToken: string;
  telegramChatId: string;

  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setFontSize: (fontSize: FontSize) => void;
  setCompactMode: (compact: boolean) => void;
  setSendOnEnter: (send: boolean) => void;
  setReduceMotion: (reduce: boolean) => void;
  
  setSearchProvider: (provider: SearchProvider) => void;
  setBraveSearchKey: (value: string) => void;
  setSerperApiKey: (value: string) => void;
  setTavilyApiKey: (value: string) => void;
  
  setTelegramBotToken: (value: string) => void;
  setTelegramChatId: (value: string) => void;
  reset: () => void;
};

const DEFAULTS = {
  theme: "dark" as ThemeMode,
  accent: "default" as AccentColor,
  fontSize: "md" as FontSize,
  compactMode: false,
  sendOnEnter: true,
  reduceMotion: false,
  
  searchProvider: "duckduckgo" as SearchProvider,
  braveSearchKey: "",
  serperApiKey: "",
  tavilyApiKey: "",
  
  telegramBotToken: "",
  telegramChatId: "",
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setFontSize: (fontSize) => set({ fontSize }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setSendOnEnter: (sendOnEnter) => set({ sendOnEnter }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      
      setSearchProvider: (searchProvider) => set({ searchProvider }),
      setBraveSearchKey: (braveSearchKey) => set({ braveSearchKey }),
      setSerperApiKey: (serperApiKey) => set({ serperApiKey }),
      setTavilyApiKey: (tavilyApiKey) => set({ tavilyApiKey }),
      
      setTelegramBotToken: (telegramBotToken) => set({ telegramBotToken }),
      setTelegramChatId: (telegramChatId) => set({ telegramChatId }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "orbit-preferences-v5", // Change name to force a clean slate if migration fails
      storage: createJSONStorage(() => localStorage),
      version: 5,
      migrate: (persistedState: any, version: number) => {
        if (version === 5) return persistedState as PreferencesState;
        
        // Manual merge to ensure no fields are missing
        const state = { ...DEFAULTS };
        if (persistedState && typeof persistedState === "object") {
          Object.assign(state, persistedState);
        }
        return state as PreferencesState;
      },
    },
  ),
);

export const ACCENT_COLORS: Array<{
  value: AccentColor;
  label: string;
  swatch: string;
}> = [
  { value: "default", label: "Default", swatch: "oklch(0.922 0 0)" },
  { value: "sky", label: "Sky", swatch: "oklch(0.685 0.164 237)" },
  { value: "emerald", label: "Emerald", swatch: "oklch(0.724 0.151 162)" },
  { value: "violet", label: "Violet", swatch: "oklch(0.645 0.216 303)" },
  { value: "amber", label: "Amber", swatch: "oklch(0.774 0.150 70)" },
];
