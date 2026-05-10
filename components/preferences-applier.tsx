"use client";

import { useEffect } from "react";

import { usePreferences } from "@/lib/store/preferences";

/**
 * Sync the user's preferences to DOM attributes/CSS so the rest of the
 * stylesheet can react to them. The inline script in layout.tsx already
 * applies the correct classes during SSR to avoid flash.
 */
export function PreferencesApplier() {
  const theme = usePreferences((s) => s.theme);
  const accent = usePreferences((s) => s.accent);
  const fontSize = usePreferences((s) => s.fontSize);
  const compactMode = usePreferences((s) => s.compactMode);
  const reduceMotion = usePreferences((s) => s.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const effective =
        theme === "system" ? (systemDark ? "dark" : "light") : theme;
      root.classList.toggle("dark", effective === "dark");
      root.dataset.theme = effective;
    };
    apply();
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.dataset.compact = compactMode ? "true" : "false";
  }, [compactMode]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion
      ? "true"
      : "false";
  }, [reduceMotion]);

  return null;
}
