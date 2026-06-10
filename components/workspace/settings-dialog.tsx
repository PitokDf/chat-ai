"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Bot,
  Check,
  ExternalLink,
  KeyRound,
  Monitor,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  MessageCircle,
  Settings as SettingsIcon,
  Sun,
  Trash2,
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
  type SearchProvider,
} from "@/lib/store/preferences";
import { useSettings } from "@/lib/store/settings";
import { useSkills } from "@/lib/store/skills";
import { STORE_SKILLS } from "@/lib/skills/store";
import { useChannels, CHANNEL_TYPES, CHANNEL_LABELS, CHANNEL_CONFIG_FIELDS } from "@/lib/store/channels";
import { useCron } from "@/lib/store/cron";
import { useAgents } from "@/lib/store/agents";
import { useMemory } from "@/lib/store/memory";
import { useMcp } from "@/lib/store/mcp";
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Everything stays in your browser. Nothing is sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="keys" className="gap-4">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="keys" className="gap-1.5">
              <KeyRound className="h-3 w-3" /> API keys
            </TabsTrigger>
            <TabsTrigger value="prefs" className="gap-1.5">
              <SettingsIcon className="h-3 w-3" /> Preferences
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5">
              <Search className="h-3 w-3" /> Search
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5">
              <SettingsIcon className="h-3 w-3" /> Skills Library
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-1.5">
              <Monitor className="h-3 w-3" /> Memory
            </TabsTrigger>
            <TabsTrigger value="mcp" className="gap-1.5">
              <ExternalLink className="h-3 w-3" /> MCP Servers
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5">
              <Bot className="h-3 w-3" /> Agents
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <Send className="h-3 w-3" /> Integrations
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-1.5">
              <MessageCircle className="h-3 w-3" /> Channels
            </TabsTrigger>
            <TabsTrigger value="cron" className="gap-1.5">
              <RotateCcw className="h-3 w-3" /> Cron Jobs
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

          <TabsContent value="search" className="outline-none">
            <SearchPanel />
          </TabsContent>

          <TabsContent value="skills" className="outline-none">
            <SkillsPanel />
          </TabsContent>

          <TabsContent value="memory" className="outline-none">
            <MemoryPanel />
          </TabsContent>

          <TabsContent value="mcp" className="outline-none">
            <McpPanel />
          </TabsContent>

          <TabsContent value="agents" className="outline-none">
            <AgentsPanel />
          </TabsContent>

          <TabsContent value="integrations" className="outline-none">
            <IntegrationsPanel />
          </TabsContent>
          <TabsContent value="channels" className="outline-none">
            <ChannelsPanel />
          </TabsContent>
          <TabsContent value="cron" className="outline-none">
            <CronPanel />
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

function SearchPanel() {
  const {
    searchProvider,
    setSearchProvider,
    braveSearchKey,
    setBraveSearchKey,
    serperApiKey,
    setSerperApiKey,
    tavilyApiKey,
    setTavilyApiKey,
  } = usePreferences();

  return (
    <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1">
      <div className="flex flex-col gap-2">
        <Label>Search Provider</Label>
        <select
          value={searchProvider}
          onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="none">None (disabled)</option>
          <option value="duckduckgo">DuckDuckGo — Free, no key</option>
          <option value="brave">Brave Search — 2,000 req/mo free</option>
          <option value="serper">Serper (Google) — 2,500 req free</option>
          <option value="tavily">Tavily — 1,000 req/mo free</option>
        </select>
      </div>

      <div className="flex flex-col gap-4">
        {searchProvider === "brave" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="brave-key">Brave API Key</Label>
              <a href="https://api.search.brave.com/" target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:underline">Get Key</a>
            </div>
            <Input
              id="brave-key"
              type="password"
              className="mt-2"
              placeholder="BSA..."
              value={braveSearchKey}
              onChange={(e) => setBraveSearchKey(e.target.value)}
            />
          </div>
        )}

        {searchProvider === "serper" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="serper-key">Serper (Google) API Key</Label>
              <a href="https://serper.dev/" target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:underline">Get Key</a>
            </div>
            <Input
              id="serper-key"
              type="password"
              className="mt-2"
              placeholder="API Key..."
              value={serperApiKey}
              onChange={(e) => setSerperApiKey(e.target.value)}
            />
          </div>
        )}

        {searchProvider === "tavily" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="tavily-key">Tavily API Key</Label>
              <a href="https://tavily.com/" target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:underline">Get Key</a>
            </div>
            <Input
              id="tavily-key"
              type="password"
              className="mt-2"
              placeholder="tvly-..."
              value={tavilyApiKey}
              onChange={(e) => setTavilyApiKey(e.target.value)}
            />
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        * DuckDuckGo uses a robust parallel fallback system (SearXNG + Marginalia) and requires no configuration.
      </p>
    </div>
  );
}

function IntegrationsPanel() {
  const telegramBotToken = usePreferences((s) => s.telegramBotToken);
  const telegramChatId = usePreferences((s) => s.telegramChatId);
  const setTelegramBotToken = usePreferences((s) => s.setTelegramBotToken);
  const setTelegramChatId = usePreferences((s) => s.setTelegramChatId);

  const testLink =
    telegramBotToken && telegramChatId
      ? `https://api.telegram.org/bot${telegramBotToken}/getChat?chat_id=${telegramChatId}`
      : "";

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-sky-400" />
          <p className="text-sm font-medium text-foreground">Telegram</p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Forward assistant replies to a Telegram chat. Create a bot with
          @BotFather, add it to your group or DM it,kemudian masukkan credential di bawah.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="tg-token">Bot Token</Label>
            <Input
              id="tg-token"
              type="password"
              placeholder="123456:ABC-DEF..."
              value={telegramBotToken}
              onChange={(event) => setTelegramBotToken(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tg-chat">Chat ID</Label>
            <Input
              id="tg-chat"
              placeholder="e.g. 12345678"
              value={telegramChatId}
              onChange={(event) => setTelegramChatId(event.target.value)}
            />
          </div>
          {testLink && (
            <a
              href={testLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Test connection <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillsPanel() {
  const skills = useSkills((s) => s.skills);
  const addSkill = useSkills((s) => s.addSkill);
  const updateSkill = useSkills((s) => s.updateSkill);
  const deleteSkill = useSkills((s) => s.deleteSkill);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [showStore, setShowStore] = useState(false);
  const [storeCategory, setStoreCategory] = useState<string>("All");

  const addAkinatorTemplate = () => {
    const exists = skills.some((s) => s.name.trim().toLowerCase() === "akinator mode");
    if (exists) {
      toast.error("Skill 'Akinator Mode' sudah ada.");
      return;
    }

    addSkill({
      name: "Akinator Mode",
      description:
        "Main tebak-tebakan ala Akinator: AI bertanya ya/tidak lalu menebak.",
      content: [
        "# Akinator Mode",
        "",
        "Kamu berperan sebagai 'Akinator' (permainan tebak-tebakan). Tujuanmu adalah menebak apa/siapa yang sedang dipikirkan user dengan mengajukan pertanyaan ya/tidak.",
        "",
        "## Aturan permainan",
        "- Pertama, minta user memilih 1 kategori: **Karakter**, **Orang nyata**, **Objek**, atau **Tempat** (kalau user sudah menyebut, lewati).",
        "- Instruksikan user untuk menjawab dengan salah satu dari: **Ya / Tidak / Tidak tahu / Mungkin / Tergantung**.",
        "- Ajukan 1 pertanyaan per giliran. Pertanyaan harus spesifik dan memperkecil ruang kemungkinan.",
        "- Simpan progres internal: ringkas hipotesis & ciri-ciri yang sudah pasti sebelum bertanya lagi (jangan tampilkan rantai pikiran panjang).",
        "",
        "## Strategi bertanya",
        "- Mulai dari pertanyaan broad (fiksi vs nyata, manusia vs non-manusia, era, medium: anime/film/game/buku), lalu mengerucut (asal negara, profesi, kekuatan, relasi).",
        "- Jika user sering menjawab 'Tidak tahu', ubah ke pertanyaan yang lebih mudah dijawab (mis. 'apakah terkenal di Indonesia?' atau 'apakah dari anime?').",
        "- Maksimalkan informasi: hindari pertanyaan yang redundant atau bisa dijawab dari pertanyaan sebelumnya.",
        "",
        "## Menebak",
        "- Setelah kamu cukup yakin (≈70%+), lakukan **tebakan**: \"Aku menebak kamu memikirkan: X. Benar?\"",
        "- Jika salah, minta 1 petunjuk singkat (mis. 'karakter dari mana? ciri paling menonjol?') lalu lanjutkan 2–4 pertanyaan lagi sebelum menebak ulang.",
        "- Jika benar, ucapkan selamat dan tawarkan main lagi.",
        "",
        "## Batasan",
        "- Jangan meminta data sensitif pribadi. Untuk 'Orang nyata', fokus ke figur publik.",
        "- Jangan browsing web kecuali user memintanya.",
        "",
        "Mulai game saat user bilang 'mulai' atau mengajak bermain.",
      ].join("\n"),
    });
    toast.success("Template 'Akinator Mode' ditambahkan.");
  };

  const handleAddNew = () => {
    setEditingId("new");
    setDraftName("");
    setDraftDesc("");
    setDraftContent("");
  };

  const handleEdit = (skill: any) => {
    setEditingId(skill.id);
    setDraftName(skill.name);
    setDraftDesc(skill.description);
    setDraftContent(skill.content);
  };

  const handleSave = () => {
    if (!draftName.trim() || !draftContent.trim()) {
      toast.error("Name and Content are required.");
      return;
    }

    if (editingId === "new") {
      addSkill({ name: draftName, description: draftDesc, content: draftContent });
      toast.success("Skill added.");
    } else if (editingId) {
      updateSkill(editingId, { name: draftName, description: draftDesc, content: draftContent });
      toast.success("Skill updated.");
    }

    setEditingId(null);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportMarkdown = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const yamlMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);
      let importedCount = 0;

      if (yamlMatch) {
        const frontmatter = yamlMatch[1];
        const content = yamlMatch[2].trim();
        let name = "Skill Baru";
        let description = "Skill diimpor dari markdown";
        const nameMatch = frontmatter.match(/^name:\s*(.+)/m);
        if (nameMatch) name = nameMatch[1].trim();
        const descMatch = frontmatter.match(/^description:\s*(.+)/m);
        if (descMatch) description = descMatch[1].trim();
        if (name && content) {
          addSkill({ name, description, content });
          importedCount++;
        }
      } else {
        const sections = text.split(/(?:^|\n)##? /);
        for (const section of sections) {
          if (!section.trim()) continue;
          const lines = section.split("\n");
          const name = lines[0].trim();
          const content = lines.slice(1).join("\n").trim();
          if (name && content) {
            addSkill({ name, description: "Diimpor dari file SKILL.md", content });
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        toast.success(`Berhasil mengimpor ${importedCount} skill!`);
      } else {
        toast.error("Gagal mendeteksi skill. Pastikan format SKILL.md benar (menggunakan frontmatter).");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const CATEGORIES = ["All", "Development", "Content", "Analysis", "Design", "AI", "Business"];

  const filteredStore = storeCategory === "All"
    ? STORE_SKILLS
    : STORE_SKILLS.filter((s) => s.category === storeCategory);

  const installedStoreIds = new Set(
    skills.filter((s) => s.fromStore).map((s) => s.fromStore),
  );

  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {showStore ? "Skill Store" : "Your Skills Library"}
        </p>
        <div className="flex items-center gap-2">
          {!showStore ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowStore(true)} className="h-7 text-xs gap-1.5">
                <Search className="h-3 w-3" /> Browse Store
              </Button>
              <input
                type="file"
                accept=".md, .txt"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImportMarkdown}
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5 h-7 text-xs">
                Import .md
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={addAkinatorTemplate}
                disabled={editingId !== null}
                className="h-7 text-xs"
              >
                Add Akinator
              </Button>
              <Button size="sm" onClick={handleAddNew} disabled={editingId !== null} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Skill
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowStore(false)} className="h-7 text-xs gap-1.5">
              ← Back to My Skills
            </Button>
          )}
        </div>
      </div>

      {showStore ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStoreCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                  storeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredStore.map((skill) => {
              const installed = installedStoreIds.has(skill.id);
              return (
                <div key={skill.id} className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{skill.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{skill.description}</p>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground uppercase">
                      {skill.category}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={installed ? "outline" : "default"}
                    disabled={installed}
                    onClick={() => {
                      if (installed) return;
                      addSkill({
                        name: skill.name,
                        description: skill.description,
                        content: skill.content,
                        fromStore: skill.id,
                      });
                      toast.success(`"${skill.name}" added!`);
                    }}
                    className="h-7 text-[10px] gap-1"
                  >
                    {installed ? (
                      <><Check className="h-3 w-3" /> Installed</>
                    ) : (
                      <><Plus className="h-3 w-3" /> Add to Library</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground mt-[-4px]">
            Create custom instructions or persona rules. The AI will automatically search and read these skills when your prompt requires them.
          </p>

          {editingId !== null && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="skill-name" className="text-xs">Skill Name</Label>
                <Input id="skill-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. React Best Practices" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="skill-desc" className="text-xs">Short Description</Label>
                <Input id="skill-desc" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="e.g. Rules for writing React components" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="skill-content" className="text-xs">Full Instructions</Label>
                <textarea id="skill-content" value={draftContent} onChange={(e) => setDraftContent(e.target.value)} placeholder="Type your detailed instructions here..." className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save Skill</Button>
              </div>
            </div>
          )}

          {editingId === null && skills.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No skills defined yet. Browse the Skill Store or create one!
            </div>
          )}

          {editingId === null && skills.length > 0 && (
            <div className="flex flex-col gap-2">
              {skills.map((skill) => (
                <div key={skill.id} className="group relative rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-foreground/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{skill.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{skill.description}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(skill)}>
                        <SettingsIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("Delete this skill?")) deleteSkill(skill.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemoryPanel() {
  const memories = useMemory((s) => s.memories);
  const addMemory = useMemory((s) => s.addMemory);
  const updateMemory = useMemory((s) => s.updateMemory);
  const deleteMemory = useMemory((s) => s.deleteMemory);
  const clearMemories = useMemory((s) => s.clearMemories);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftFact, setDraftFact] = useState("");

  const handleAddNew = () => {
    setEditingId("new");
    setDraftFact("");
  };

  const handleEdit = (memory: any) => {
    setEditingId(memory.id);
    setDraftFact(memory.fact);
  };

  const handleSave = () => {
    if (!draftFact.trim()) {
      toast.error("Fact is required.");
      return;
    }

    if (editingId === "new") {
      addMemory(draftFact);
      toast.success("Memory added.");
    } else if (editingId) {
      updateMemory(editingId, draftFact);
      toast.success("Memory updated.");
    }

    setEditingId(null);
  };

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">AI Memory</p>
        <div className="flex gap-2">
          {memories.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("Hapus semua memori? AI tidak akan mengingat apapun lagi.")) clearMemories(); }}>
              Clear All
            </Button>
          )}
          <Button size="sm" onClick={handleAddNew} disabled={editingId !== null} className="gap-1.5 h-7 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Memory
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-[-8px]">
        AI secara otomatis menyimpan fakta penting tentang Anda dari percakapan untuk memberi jawaban yang lebih personal. Anda bisa mengedit atau menghapusnya di sini.
      </p>

      {editingId !== null && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memory-fact" className="text-xs">Fakta / Preferensi</Label>
            <Input id="memory-fact" value={draftFact} onChange={(e) => setDraftFact(e.target.value)} placeholder="e.g. Nama saya adalah Budi..." className="h-8 text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}

      {editingId === null && memories.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada memori. AI akan menambahkannya otomatis dari percakapan.
        </div>
      )}

      {editingId === null && memories.length > 0 && (
        <div className="flex flex-col gap-2">
          {memories.slice().sort((a, b) => b.createdAt - a.createdAt).map((memory) => (
            <div key={memory.id} className="group relative rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-foreground/20">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-foreground">{memory.fact}</p>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(memory)}>
                    <SettingsIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("Hapus memori ini?")) deleteMemory(memory.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentsPanel() {
  const agents = useAgents((s) => s.agents);
  const addAgent = useAgents((s) => s.addAgent);
  const updateAgent = useAgents((s) => s.updateAgent);
  const removeAgent = useAgents((s) => s.removeAgent);
  const currentSettingsProviderId = useSettings((s) => s.providerId);
  const currentSettingsModelId = useSettings((s) => s.modelId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftProvider, setDraftProvider] = useState<ProviderId>(currentSettingsProviderId);
  const [draftModel, setDraftModel] = useState(currentSettingsModelId);

  const modelsEntry = useModels((s) => s.byProvider[draftProvider]);
  const getEntry = useModels((s) => s.getEntry);
  const activeEntry = modelsEntry ?? getEntry(draftProvider);
  const agentModels = activeEntry.models;

  const handleAdd = () => {
    setEditingId("new");
    setDraftName("");
    setDraftDesc("");
    setDraftPrompt("Kamu adalah asisten AI yang membantu dan ramah.");
    setDraftProvider(currentSettingsProviderId);
    setDraftModel(currentSettingsModelId);
  };

  const handleEdit = (agent: any) => {
    setEditingId(agent.id);
    setDraftName(agent.name);
    setDraftDesc(agent.description);
    setDraftPrompt(agent.systemPrompt);
    setDraftProvider(agent.providerId);
    setDraftModel(agent.modelId);
  };

  const handleSave = () => {
    if (!draftName.trim() || !draftPrompt.trim() || !draftModel.trim()) {
      toast.error("Name, Prompt, and Model are required.");
      return;
    }
    if (editingId === "new") {
      addAgent({
        name: draftName,
        description: draftDesc,
        systemPrompt: draftPrompt,
        providerId: draftProvider,
        modelId: draftModel,
        enabled: true,
      });
      toast.success("Agent created.");
    } else if (editingId) {
      updateAgent(editingId, {
        name: draftName,
        description: draftDesc,
        systemPrompt: draftPrompt,
        providerId: draftProvider,
        modelId: draftModel,
      });
      toast.success("Agent updated.");
    }
    setEditingId(null);
  };

  const activeAgent = agents.find((a) => a.enabled);

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Custom Agents</p>
        <Button size="sm" onClick={handleAdd} disabled={editingId !== null} className="gap-1.5 h-7 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Agent
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-[-8px]">
        Create specialized AI agents with custom prompts and models. Select an agent from the chat panel to use it.
      </p>

      {editingId !== null && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Code Reviewer" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="e.g. Specializes in code review" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">System Prompt</Label>
            <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Provider</Label>
            <select
              value={draftProvider}
              onChange={(e) => {
                const pid = e.target.value as ProviderId;
                setDraftProvider(pid);
                const entry = useModels.getState().getEntry(pid);
                const firstModel = entry.models?.[0]?.id ?? "";
                if (firstModel) setDraftModel(firstModel);
              }}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Model</Label>
            <select
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              {agentModels.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}

      {editingId === null && agents.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No custom agents yet. Create one to get started.
        </div>
      )}

      {editingId === null && agents.length > 0 && (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${agent.enabled ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {agent.description || "No description"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {getProvider(agent.providerId)?.name ?? agent.providerId} · {agent.modelId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateAgent(agent.id, { enabled: !agent.enabled })}>
                    {agent.enabled ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(agent)}>
                    <SettingsIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAgent(agent.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CronPanel() {
  const jobs = useCron((s) => s.jobs);
  const addJob = useCron((s) => s.addJob);
  const updateJob = useCron((s) => s.updateJob);
  const removeJob = useCron((s) => s.removeJob);
  const toggleJob = useCron((s) => s.toggleJob);
  const runNowAction = useCron((s) => s.runNow);
  const currentSettingsProviderId = useSettings((s) => s.providerId);
  const currentSettingsModelId = useSettings((s) => s.modelId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftCron, setDraftCron] = useState("0 9 * * *");
  const [draftProvider, setDraftProvider] = useState(currentSettingsProviderId);
  const [draftModel, setDraftModel] = useState(currentSettingsModelId);
  const [runningId, setRunningId] = useState<string | null>(null);

  const modelsEntry = useModels((s) => s.byProvider[draftProvider]);
  const getEntry = useModels((s) => s.getEntry);
  const activeEntry = modelsEntry ?? getEntry(draftProvider);
  const cronModels = activeEntry.models;

  const PRESETS = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
    { label: "Daily at 6 AM", value: "0 6 * * *" },
    { label: "Daily at 9 AM", value: "0 9 * * *" },
    { label: "Daily at 12 PM", value: "0 12 * * *" },
    { label: "Daily at 6 PM", value: "0 18 * * *" },
    { label: "Daily at 12 AM", value: "0 0 * * *" },
    { label: "Every Monday 9 AM", value: "0 9 * * 1" },
    { label: "Weekdays 9 AM", value: "0 9 * * 1-5" },
    { label: "Weekends 9 AM", value: "0 9 * * 0,6" },
    { label: "Every 5 minutes", value: "*/5 * * * *" },
    { label: "Every 15 minutes", value: "*/15 * * * *" },
    { label: "Every 30 minutes", value: "*/30 * * * *" },
    { label: "Every minute", value: "* * * * *" },
  ];

  const [cronError, setCronError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftCron.trim()) {
      setCronError("Cron expression is required");
      return;
    }
    let cancelled = false;
    import("cron-parser")
      .then((mod) => {
        if (cancelled) return;
        try {
          mod.CronExpressionParser.parse(draftCron.trim());
          setCronError(null);
        } catch {
          setCronError("Invalid cron expression");
        }
      })
      .catch(() => setCronError(null));
    return () => { cancelled = true; };
  }, [draftCron]);

  const handleAdd = () => {
    setEditingId("new");
    setDraftName("");
    setDraftPrompt("");
    setDraftCron("0 9 * * *");
    setDraftProvider(currentSettingsProviderId);
    setDraftModel(currentSettingsModelId);
  };

  const handleEdit = (job: any) => {
    setEditingId(job.id);
    setDraftName(job.name);
    setDraftPrompt(job.prompt);
    setDraftCron(job.cronExpression || "0 9 * * *");
    setDraftProvider(job.providerId || currentSettingsProviderId);
    setDraftModel(job.modelId || currentSettingsModelId);
  };

  const handleSave = () => {
    if (!draftName.trim() || !draftPrompt.trim()) {
      toast.error("Name and Prompt are required.");
      return;
    }
    if (cronError) {
      toast.error(cronError);
      return;
    }
    if (editingId === "new") {
      addJob({ name: draftName, prompt: draftPrompt, cronExpression: draftCron.trim(), providerId: draftProvider, modelId: draftModel, enabled: true });
      toast.success("Cron job added.");
    } else if (editingId) {
      updateJob(editingId, { name: draftName, prompt: draftPrompt, cronExpression: draftCron.trim(), providerId: draftProvider, modelId: draftModel });
      toast.success("Cron job updated.");
    }
    setEditingId(null);
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      const result = await runNowAction(id);
      if (result) {
        toast.success("Task executed");
      } else {
        toast.error("Task execution failed");
      }
    } catch {
      toast.error("Task execution failed");
    } finally {
      setRunningId(null);
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleString("id-ID", {
      dateStyle: "short", timeStyle: "short",
    });
  };

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Scheduled Tasks</p>
        <Button size="sm" onClick={handleAdd} disabled={editingId !== null} className="gap-1.5 h-7 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-[-8px]">
        Run AI prompts on a schedule. Each task uses its own provider and model.
      </p>

      {editingId !== null && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Task Name</Label>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Daily Market Summary" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">AI Prompt</Label>
            <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} placeholder="e.g. Summarize today's top financial news..." className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Schedule (cron expression)</Label>
            <Input value={draftCron} onChange={(e) => setDraftCron(e.target.value)} placeholder="e.g. 0 9 * * *" className="h-8 text-sm font-mono" />
            {cronError ? (
              <p className="text-[10px] text-destructive">{cronError}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                min hour dom mon dow — <span className="text-[10px] text-muted-foreground">* = every, */5 = every 5, 1-5 = range, 0,6 = multiple</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p.value} type="button" onClick={() => setDraftCron(p.value)} className={`rounded px-2 py-0.5 text-[10px] border transition-colors ${draftCron === p.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Provider</Label>
            <select value={draftProvider} onChange={(e) => { const v = e.target.value as ProviderId; setDraftProvider(v); const entry = useModels.getState().getEntry(v); if (entry.models?.[0]) setDraftModel(entry.models[0].id); }} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Model</Label>
            <select value={draftModel} onChange={(e) => setDraftModel(e.target.value)} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
              {cronModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}

      {editingId === null && jobs.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No scheduled tasks yet.
        </div>
      )}

      {editingId === null && jobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${job.enabled ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      <code className="text-[10px] bg-muted/30 px-1 rounded">{job.cronExpression}</code> · Last: {formatTime(job.lastRunAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {(getProvider(job.providerId as any)?.name) ?? job.providerId} · {job.modelId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRunNow(job.id)} disabled={runningId === job.id} title="Run now">
                    <Play className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleJob(job.id)}>
                    {job.enabled ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(job)}>
                    <SettingsIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeJob(job.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {job.lastResult && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
                    Last result
                  </summary>
                  <p className="mt-1 text-[11px] text-foreground/80 whitespace-pre-wrap line-clamp-4">
                    {job.lastResult}
                  </p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelsPanel() {
  const channels = useChannels((s) => s.channels);
  const addChannel = useChannels((s) => s.addChannel);
  const updateChannel = useChannels((s) => s.updateChannel);
  const removeChannel = useChannels((s) => s.removeChannel);
  const toggleChannel = useChannels((s) => s.toggleChannel);

  const [adding, setAdding] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});

  const startAdd = (type: string) => {
    setAdding(type);
    setDraftConfig({});
  };

  const handleSave = () => {
    if (!adding) return;
    const fields = CHANNEL_CONFIG_FIELDS[adding] ?? [];
    const requiredFields = fields.filter((f) => f.placeholder && f.key !== "chatId" && !f.key.includes("optional"));
    const missing = requiredFields.find((f) => !draftConfig[f.key]);
    if (missing) {
      toast.error(`${missing.label} is required`);
      return;
    }
    addChannel({
      name: CHANNEL_LABELS[adding] ?? adding,
      type: adding as any,
      enabled: true,
      config: { ...draftConfig },
    });
    setAdding(null);
    toast.success(`${CHANNEL_LABELS[adding]} channel added`);
  };

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <p className="text-sm font-medium text-foreground">Messaging Channels</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Connect messaging platforms so the AI can receive and respond to messages directly.
        </p>
      </div>

      {channels.length > 0 && (
        <div className="flex flex-col gap-2">
          {channels.map((ch) => (
            <div key={ch.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${ch.enabled ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  <p className="text-sm font-medium text-foreground">{ch.name}</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                    {ch.type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleChannel(ch.id)}>
                    {ch.enabled ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeChannel(ch.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {Object.entries(ch.config).map(([key, val]) => (
                  <div key={key} className="text-[10px] text-muted-foreground">
                    <span className="font-medium">{key}: </span>
                    {val.length > 20 ? `${val.slice(0, 20)}...` : val}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {channels.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No channels configured yet.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CHANNEL_TYPES.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="outline"
            disabled={adding !== null}
            onClick={() => startAdd(type)}
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="h-3 w-3" />
            {CHANNEL_LABELS[type]}
          </Button>
        ))}
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-foreground">
            Configure {CHANNEL_LABELS[adding]}
          </p>
          {CHANNEL_CONFIG_FIELDS[adding]?.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label htmlFor={`ch-${field.key}`} className="text-xs">{field.label}</Label>
              <Input
                id={`ch-${field.key}`}
                type={field.secret ? "password" : "text"}
                placeholder={field.placeholder}
                value={draftConfig[field.key] ?? ""}
                onChange={(e) => setDraftConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Channel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function McpPanel() {
  const servers = useMcp((s) => s.servers);
  const addServer = useMcp((s) => s.addServer);
  const updateServer = useMcp((s) => s.updateServer);
  const deleteServer = useMcp((s) => s.deleteServer);
  const toggleServer = useMcp((s) => s.toggleServer);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCommand, setDraftCommand] = useState("");
  const [draftArgs, setDraftArgs] = useState("");

  const handleAddNew = () => {
    setEditingId("new");
    setDraftName("");
    setDraftCommand("npx");
    setDraftArgs("-y @modelcontextprotocol/server-postgres postgresql://localhost/mydb");
  };

  const handleEdit = (server: any) => {
    setEditingId(server.id);
    setDraftName(server.name);
    setDraftCommand(server.command);
    setDraftArgs(server.args.join(" "));
  };

  const handleSave = () => {
    if (!draftName.trim() || !draftCommand.trim()) {
      toast.error("Name and Command are required.");
      return;
    }

    // Parse args simply by splitting by space (doesn't handle quotes yet)
    const argsArray = draftArgs.split(" ").map(s => s.trim()).filter(s => s.length > 0);

    if (editingId === "new") {
      addServer({ name: draftName, command: draftCommand, args: argsArray, env: {}, active: true });
      toast.success("MCP Server added.");
    } else if (editingId) {
      updateServer(editingId, { name: draftName, command: draftCommand, args: argsArray });
      toast.success("MCP Server updated.");
    }

    setEditingId(null);
  };

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">MCP Servers</p>
        <Button size="sm" onClick={handleAddNew} disabled={editingId !== null} className="gap-1.5 h-7 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Server
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-[-8px]">
        Model Context Protocol (MCP) allows AI to securely access local tools and data via stdio servers.
      </p>

      {editingId !== null && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-name" className="text-xs">Server Name</Label>
            <Input id="mcp-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Postgres DB" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-command" className="text-xs">Command</Label>
            <Input id="mcp-command" value={draftCommand} onChange={(e) => setDraftCommand(e.target.value)} placeholder="e.g. npx" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-args" className="text-xs">Arguments (space separated)</Label>
            <Input id="mcp-args" value={draftArgs} onChange={(e) => setDraftArgs(e.target.value)} placeholder="e.g. -y @modelcontextprotocol/server-postgres" className="h-8 text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}

      {editingId === null && servers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No MCP servers added yet.
        </div>
      )}

      {editingId === null && servers.length > 0 && (
        <div className="flex flex-col gap-2">
          {servers.map((server) => (
            <div key={server.id} className="group relative rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-foreground/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{server.name}</p>
                    <Switch checked={server.active} onCheckedChange={(checked) => toggleServer(server.id, checked)} className="scale-75 origin-left" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground font-mono bg-muted/50 p-1 rounded inline-block">
                    {server.command} {server.args.join(" ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(server)}>
                    <SettingsIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("Delete this MCP server?")) deleteServer(server.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
