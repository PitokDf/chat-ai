"use client";

import React, { useState, useRef } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Send,
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
            <TabsTrigger value="integrations" className="gap-1.5">
              <Send className="h-3 w-3" /> Integrations
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
    const id = Date.now().toString(); // temporary ID just for state
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

      // Coba parse YAML Frontmatter (--- ... ---)
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
        // Fallback: split by headings jika tidak ada frontmatter
        const sections = text.split(/(?:^|\n)##? /);
        for (const section of sections) {
          if (!section.trim()) continue;
          const lines = section.split("\n");
          const name = lines[0].trim();
          const content = lines.slice(1).join("\n").trim();

          if (name && content) {
            addSkill({
              name,
              description: "Diimpor dari file SKILL.md",
              content,
            });
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        toast.success(`Berhasil mengimpor ${importedCount} skill!`);
      } else {
        toast.error("Gagal mendeteksi skill. Pastikan format SKILL.md benar (menggunakan frontmatter).");
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Your Skills Library</p>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-[-8px]">
        Create custom instructions or persona rules. The AI will automatically search and read these skills when your prompt requires them. Format import SKILL.md: Gunakan heading (# Nama Skill) lalu konten di bawahnya.
      </p>

      {editingId !== null && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-name" className="text-xs">Skill Name</Label>
            <Input id="skill-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. React Best Practices" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-desc" className="text-xs">Short Description (for AI to know when to use it)</Label>
            <Input id="skill-desc" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="e.g. Rules for writing React components" className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-content" className="text-xs">Full Instructions / Content</Label>
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
          No skills defined yet.
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
