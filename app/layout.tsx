import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import Script from "next/script";
import { PreferencesApplier } from "@/components/preferences-applier";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Orbit — AI build agent",
  description:
    "Describe what you want, Orbit writes the code and runs it in a browser sandbox.",
};

/**
 * Runs before React hydrates to set theme/accent/etc from localStorage so the
 * page doesn't flash with default styles while the store loads.
 */
const PREFS_BOOTSTRAP = `
(function () {
  try {
    var raw = localStorage.getItem("orbit-preferences");
    var prefs = raw ? (JSON.parse(raw).state || {}) : {};
    var theme = prefs.theme || "dark";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var effective = theme === "system" ? (systemDark ? "dark" : "light") : theme;
    var el = document.documentElement;
    el.classList.toggle("dark", effective === "dark");
    el.dataset.theme = effective;
    el.dataset.accent = prefs.accent || "default";
    el.dataset.fontSize = prefs.fontSize || "md";
    el.dataset.compact = prefs.compactMode ? "true" : "false";
    el.dataset.reduceMotion = prefs.reduceMotion ? "true" : "false";
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        sans.variable,
        mono.variable,
        "font-sans",
      )}
    >
      <head>
        <Script
          id="prefs-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: PREFS_BOOTSTRAP }}
        />
      </head>
      <body
        className="h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <PreferencesApplier />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
