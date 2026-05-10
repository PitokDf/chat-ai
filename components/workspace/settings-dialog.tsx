"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  MessageCircle,
  Monitor,
  Moon,
  RotateCcw,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";
import { useModels } from "@/lib/store/models";
import {
  ACCENT_COLORS,
  usePreferences,
  type AccentColor,
  type FontSize,
  type ThemeMode,
} from "@/lib/store/preferences";
import { useSettings } from "@/lib/store/settings";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

const THEMES: Array<{
  value: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

const FONT_SIZES: Array<{ value: FontSize; label: string; sample: string }> = [
  { value: "sm", label: "Small", sample: "14 px" },
  { value: "md", label: "Medium", sample: "15 px" },
  { value: "lg", label: "Large", sample: "17 px" },
];

export function SettingsDialog() {
  const apiKeys = useSettings((state) => state.apiKeys);
  const setKey = useSettings((state) => state.setKey);
  const clearKey = useSettings((state) => state.clearKey);
  const fetchModels = useModels((state) => state.fetchModels);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});

  const preferences = usePreferences();

  const handleSave = (provider: ProviderId) => {
    const value = (drafts[provider] ?? "").trim();
    if (!value) return;
    setKey(provider, value);
    setDrafts((prev) => ({ ...prev, [provider]: "" }));
    toast.success(
      "API key saved",
      `${getProvider(provider)?.name ?? provider} will use this key.`,
    );
    void fetchModels(provider, value);
  };

  const handleClear = (provider: ProviderId) => {
    clearKey(provider);
    toast.info("API key removed", getProvider(provider)?.name ?? provider);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Everything stays in your browser. Nothing is sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="keys" className="gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="keys" className="gap-1.5">
              <KeyRound className="h-3 w-3" /> API keys
            </TabsTrigger>
            <TabsTrigger value="prefs" className="gap-1.5">
              <SettingsIcon className="h-3 w-3" /> Preferences
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <MessageCircle className="h-3 w-3" /> Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="outline-none">
            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
              {PROVIDERS.map((provider) => {
                const stored = apiKeys[provider.id];
                const draft = drafts[provider.id] ?? "";
                const masked = stored
                  ? `${stored.slice(0, 4)}...${stored.slice(-4)}`
                  : "Not set";
                return (
                  <div
                    key={provider.id}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {provider.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                      <a
                        href={provider.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Get key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Label htmlFor={`${provider.id}-key`} className="sr-only">
                        {provider.name} API key
                      </Label>
                      <Input
                        id={`${provider.id}-key`}
                        type="password"
                        placeholder={stored ? masked : "sk-..."}
                        value={draft}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [provider.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleSave(provider.id);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(provider.id)}
                        disabled={!draft.trim()}
                      >
                        Save
                      </Button>
                      {stored ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClear(provider.id)}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    {stored ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Current key: {masked}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="prefs" className="outline-none">
            <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
              <PreferenceRow
                label="Theme"
                description="How the interface looks."
              >
                <div className="flex flex-wrap gap-2">
                  {THEMES.map(({ value, label, icon: Icon }) => {
                    const active = preferences.theme === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => preferences.setTheme(value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </PreferenceRow>

              <PreferenceRow
                label="Accent color"
                description="Used for buttons, focus rings, and highlights."
              >
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map(({ value, label, swatch }) => {
                    const active = preferences.accent === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          preferences.setAccent(value as AccentColor)
                        }
                        title={label}
                        className={cn(
                          "relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
                          active
                            ? "border-foreground/70"
                            : "border-border hover:border-foreground/40",
                        )}
                        style={{ backgroundColor: swatch }}
                      >
                        {active ? (
                          <Check className="h-3.5 w-3.5 text-black/70 mix-blend-difference" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </PreferenceRow>

              <PreferenceRow
                label="Font size"
                description="Scales text across the whole app."
              >
                <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                  {FONT_SIZES.map(({ value, label, sample }) => {
                    const active = preferences.fontSize === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => preferences.setFontSize(value)}
                        className={cn(
                          "rounded px-2.5 py-1 text-xs transition",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                        <span className="ml-1 text-[9px] opacity-60">
                          {sample}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </PreferenceRow>

              <PreferenceRow
                label="Compact mode"
                description="Tighter spacing in chat messages."
              >
                <Switch
                  checked={preferences.compactMode}
                  onCheckedChange={preferences.setCompactMode}
                />
              </PreferenceRow>

              <PreferenceRow
                label="Send on Enter"
                description="Off to require the send button (Shift+Enter still inserts a newline)."
              >
                <Switch
                  checked={preferences.sendOnEnter}
                  onCheckedChange={preferences.setSendOnEnter}
                />
              </PreferenceRow>

              <PreferenceRow
                label="Reduce motion"
                description="Disable non-essential animations."
              >
                <Switch
                  checked={preferences.reduceMotion}
                  onCheckedChange={preferences.setReduceMotion}
                />
              </PreferenceRow>

              <div className="mt-1 flex justify-end border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => {
                    preferences.reset();
                    toast.info("Preferences reset");
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset preferences
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="outline-none">
            <IntegrationsPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function IntegrationsPanel() {
  const whatsappNumber = usePreferences((s) => s.whatsappNumber);
  const whatsappWebhookUrl = usePreferences((s) => s.whatsappWebhookUrl);
  const setWhatsappNumber = usePreferences((s) => s.setWhatsappNumber);
  const setWhatsappWebhookUrl = usePreferences((s) => s.setWhatsappWebhookUrl);

  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  const deepLink = cleanNumber ? `https://wa.me/${cleanNumber}` : "";

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">WhatsApp</p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Connect Orbit to WhatsApp. You can share chat replies as a WhatsApp
          message or forward them to a webhook (e.g. n8n, Zapier, Make) that
          posts to the WhatsApp Cloud API.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="wa-number">Your WhatsApp number</Label>
            <Input
              id="wa-number"
              placeholder="+62 812 3456 7890"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Include country code. Used to build wa.me deep-links.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wa-webhook">Webhook URL (optional)</Label>
            <Input
              id="wa-webhook"
              placeholder="https://n8n.example.com/webhook/orbit"
              value={whatsappWebhookUrl}
              onChange={(event) => setWhatsappWebhookUrl(event.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              The chat panel adds a &quot;Send to WhatsApp&quot; action on
              assistant messages. It POSTs JSON{" "}
              <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">
                {"{ to, message }"}
              </code>{" "}
              to your webhook. Point it at any WhatsApp integration service.
            </p>
          </div>
          {deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Test link: {deepLink} <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      <p className="text-[10.5px] leading-5 text-muted-foreground">
        Want a fully automated bot? Host a WhatsApp Business Cloud webhook,
        forward inbound messages to{" "}
        <code className="rounded bg-muted/60 px-1">/api/chat</code>, and post
        the reply back through Cloud API or a library like Baileys. That piece
        lives outside Orbit.
      </p>
    </div>
  );
}
