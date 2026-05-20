"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  FileCode,
  FileText,
  Paperclip,
  Send,
  Terminal,
  X,
  Zap,
  Eye,
  Brain,
  Square,
  RotateCcw,
} from "lucide-react";

import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { sendChatMessage, abortChatMessage, retryChatMessage } from "@/lib/agent/controller";
import {
  useChat,
  type ChatArtifactAction,
  type ChatMessage,
} from "@/lib/store/chat";
import { useProject } from "@/lib/store/project";
import { usePreferences } from "@/lib/store/preferences";
import { selectCurrentKey, useSettings } from "@/lib/store/settings";
import { toast } from "@/lib/store/toast";
import { ToolCallView } from "@/components/workspace/tool-cards";
import { useWorkspace } from "@/lib/store/workspace";

const TEMPLATES = [
  "Build a landing page for a productivity app with Tailwind.",
  "Create a todo list app with add, toggle, and delete.",
  "Make a pomodoro timer with pause/reset and desktop notifications.",
  "Scaffold a Vite React app that fetches GitHub user info.",
];

const AKINATOR_QUICK_ANSWERS = [
  "Ya",
  "Tidak",
  "Tidak tahu",
  "Mungkin",
  "Tergantung",
] as const;

const AKINATOR_STOP_RE = /\b(stop|selesai|berhenti|sudah dulu)\b/i;

const isLikelyAkinatorQuestion = (assistantText: string) => {
  const text = assistantText.trim();
  if (!text) return false;
  const hasQuestion = text.includes("?");
  const asksAnswerFormat =
    /jawab( dengan)?\s*(ya|tidak)|ya\s*\/\s*tidak|tidak tahu|mungkin|tergantung/i.test(
      text,
    );
  const guessingContext = /\btebakan\b|\bpetunjuk\b|aku menebak|yang kamu pikirkan/i.test(
    text,
  );
  const numberedQuestion = /pertanyaan\s*\d+\s*:/i.test(text);
  const hasBinaryOptions =
    /(^|\n)\s*[-*•]\s*ya\b/i.test(text) &&
    /(^|\n)\s*[-*•]\s*tidak\b/i.test(text);
  return (
    hasQuestion &&
    (asksAnswerFormat || guessingContext || numberedQuestion || hasBinaryOptions)
  );
};

const ActionIcon = ({ action }: { action: ChatArtifactAction }) => {
  const base = "h-3.5 w-3.5";
  if (action.status === "running" || action.status === "streaming") {
    return <Loader2 className={`${base} animate-spin text-amber-400`} />;
  }
  if (action.status === "error") {
    return <CircleDashed className={`${base} text-destructive`} />;
  }
  if (action.status === "done") {
    return <CheckCircle2 className={`${base} text-emerald-400`} />;
  }
  return <CircleDashed className={base} />;
};

const ActionLabel = ({ action }: { action: ChatArtifactAction }) => {
  if (action.type === "file") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <FileCode className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px]">{action.filePath}</span>
      </span>
    );
  }
  if (action.type === "shell") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Terminal className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px]">
          {action.content.trim().split("\n")[0] || "shell"}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Zap className="h-3.5 w-3.5" />
      <span className="font-mono text-[11px]">
        start: {action.content.trim().split("\n")[0]}
      </span>
    </span>
  );
};

const MessageBlockInner = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === "user";
  const telegramBotToken = usePreferences((s) => s.telegramBotToken);
  const telegramChatId = usePreferences((s) => s.telegramChatId);
  const canShare = !isUser && message.status === "done" && !!message.text;

  const handleShareTelegram = async () => {
    const text = message.text.trim();
    if (!text) return;
    if (!telegramBotToken || !telegramChatId) {
      toast.info(
        "Set Telegram in Settings",
        "Configure Bot Token and Chat ID first.",
      );
      return;
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
            parse_mode: "Markdown",
          }),
        },
      );
      if (!res.ok) {
        const err = (await res.json()) as { description?: string };
        throw new Error(err.description ?? `HTTP ${res.status}`);
      }
      toast.success("Sent to Telegram");
    } catch (err) {
      toast.error(
        "Telegram failed",
        err instanceof Error ? err.message : "Network error",
      );
    }
  };

  const handleActionClick = (action: ChatArtifactAction) => {
    const ws = useWorkspace.getState();
    if (action.type === "file" && action.filePath) {
      ws.setOpenFile(action.filePath);
      toast.info(`Opened ${action.filePath}`);
    } else if (action.type === "preview") {
      const content = action.content;
      const scriptToInject = `<script>
        ['log','info','warn','error'].forEach(m => {
          const orig = console[m];
          console[m] = function(...args) {
            window.parent.postMessage({ type: 'BROWSER_CONSOLE', level: m, args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) }, '*');
            orig.apply(console, args);
          };
        });
        window.onerror = function(msg, url, line, col, error) {
          window.parent.postMessage({ type: 'BROWSER_CONSOLE', level: 'error', args: [msg] }, '*');
        };
      </script>`;
      const htmlWithConsole = content.includes("<head>")
        ? content.replace("<head>", "<head>" + scriptToInject)
        : scriptToInject + content;

      if (ws.previewBlobUrl) {
        URL.revokeObjectURL(ws.previewBlobUrl);
      }
      const blob = new Blob([htmlWithConsole], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      ws.setPreview(url);
      ws.setPreviewBlobUrl(url);
      ws.setOpenFile("index.html");
      toast.info("Preview regenerated");
    }
  };

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-foreground"
        }`}
      >
        {isUser ? (
          <div className="space-y-2">
            {(message.attachments ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {message.attachments!.map((att) =>
                  att.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={att.id}
                      src={att.dataUrl}
                      alt={att.name}
                      className="max-h-48 max-w-[220px] rounded-md border border-primary/20 object-cover"
                    />
                  ) : (
                    <a
                      key={att.id}
                      href={att.dataUrl}
                      download={att.name}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/20 px-2 py-1 text-[11px]"
                    >
                      📎 {att.name}
                    </a>
                  ),
                )}
              </div>
            ) : null}
            {message.text ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </div>
        ) : message.role === "assistant" ? (
          <div className="space-y-3">
            {(() => {
              const parts = message.text.split(/(:::tool-call\{id=".*?"\})/g);
              return parts.map((part, i) => {
                const match = part.match(/:::tool-call\{id="(.*?)"\}/);
                if (match) {
                  const id = match[1];
                  const call = (message.toolCalls ?? []).find(
                    (c) => c.id === id,
                  );
                  if (call) {
                    return (
                      <div key={id} className="my-2">
                        <ToolCallView call={call} />
                      </div>
                    );
                  }
                  return null;
                }
                if (!part.trim() && i < parts.length - 1) return null;
                const isLastPart = i === parts.length - 1;
                return (
                  <Markdown
                    key={i}
                    content={part}
                    compact
                    allowHtml
                    streaming={message.status === "streaming" && isLastPart}
                  />
                );
              });
            })()}
          </div>
        ) : null}

        {message.thought && (
          <div className="mt-3">
            <details className="group overflow-hidden rounded-lg border border-border/50 bg-muted/20" open={message.status === "streaming" && !message.text}>
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  {message.status === "streaming" && !message.text ? (
                    <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                  ) : (
                    <Brain className="h-3 w-3 text-sky-400/70" />
                  )}
                  <span>
                    {message.status === "streaming" && !message.text
                      ? "Thinking..."
                      : "Thought Process"}
                  </span>
                </div>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                  {message.status === "streaming" && !message.text ? "View steps" : "Click to expand"}
                </span>
              </summary>
              <div className="border-t border-border/40 px-3 py-2.5 bg-background/30">
                <Markdown 
                  content={message.thought.trim()} 
                  compact 
                  streaming={message.status === "streaming" && !message.text}
                />
              </div>
            </details>
          </div>
        )}

        {/* Fallback for tool calls that aren't interleaved in text (legacy messages) */}
        {(message.toolCalls ?? []).length > 0 &&
        !(message.text ?? "").includes(":::tool-call") ? (
          <div className="mt-3 w-full space-y-2">
            {(message.toolCalls ?? []).map((call) => (
              <ToolCallView key={call.id} call={call} />
            ))}
          </div>
        ) : null}
      </div>
      {canShare && (telegramBotToken || telegramChatId) ? (
        <button
          type="button"
          onClick={() => void handleShareTelegram()}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-sky-400"
        >
          <Send className="h-3 w-3" />
          Send to Telegram
        </button>
      ) : null}
      {message.artifacts.length > 0 ? (
        <div className="w-full max-w-[92%] space-y-1.5">
          {message.artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="rounded-lg border border-border bg-card/80 p-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {artifact.title}
              </p>
              <ul className="mt-1.5 space-y-1">
                {artifact.actions.map((action) => (
                  <li
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1 text-[11px] text-foreground/80 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <ActionLabel action={action} />
                    <div className="flex items-center gap-1.5">
                      {action.note ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                            action.note === "cached" ||
                            action.note === "restored"
                              ? "bg-sky-500/15 text-sky-300"
                              : action.note === "reinstalled"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {action.note}
                        </span>
                      ) : null}
                      <summary className="text-[10px] text-muted-foreground mr-1 hidden sm:inline-block">
                        See in Workspace
                      </summary>
                      <ActionIcon action={action} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Memoize on identity of the message object — chat store replaces it only
 * when fields actually change, so this prevents non-streaming messages from
 * re-rendering when other siblings update.
 */
const MessageBlock = memo(
  MessageBlockInner,
  (prev, next) => prev.message === next.message,
);

export function ChatPanel() {
  const messages = useChat((s) => s.messages);
  const currentProjectId = useProject((s) => s.currentProjectId);
  const sendOnEnter = usePreferences((s) => s.sendOnEnter);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<
    Array<{
      id: string;
      name: string;
      mimeType: string;
      kind: "image" | "file";
      dataUrl: string;
      size: number;
    }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const [atBottom, setAtBottom] = useState(true);

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const akinatorSessionActive = useMemo(() => {
    let active = false;
    for (const message of messages) {
      const combinedText = `${message.text}\n${message.thought ?? ""}`;
      if (!combinedText) continue;
      if (message.role === "assistant" && isLikelyAkinatorQuestion(combinedText)) {
        active = true;
      }
      if (message.role === "user" && AKINATOR_STOP_RE.test(combinedText)) {
        active = false;
      }
    }
    return active;
  }, [messages]);

  const showAkinatorQuickReply =
    akinatorSessionActive &&
    !!lastAssistantMessage &&
    lastAssistantMessage.status === "done" &&
    isLikelyAkinatorQuestion(lastAssistantMessage.text) &&
    !sending &&
    pending.length === 0;

  useEffect(() => {
    if (!atBottom || messages.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: "end",
      behavior: "auto",
    });
  }, [messages, atBottom]);

  const canSend = (input.trim().length > 0 || pending.length > 0) && !sending;

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Read failed."));
      reader.readAsDataURL(file);
    });

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const MAX_SIZE = 8 * 1024 * 1024;
    const accepted: typeof pending = [];
    for (const file of arr) {
      if (file.size > MAX_SIZE) {
        toast.error("File too large", `${file.name} exceeds 8MB`);
        continue;
      }
      try {
        const dataUrl = await readFile(file);
        accepted.push({
          id: crypto.randomUUID().slice(0, 8),
          name: file.name || "pasted",
          mimeType: file.type || "application/octet-stream",
          kind: file.type.startsWith("image/") ? "image" : "file",
          dataUrl,
          size: file.size,
        });
      } catch (err) {
        toast.error(
          "Could not read file",
          err instanceof Error ? err.message : "Unknown error",
        );
      }
    }
    if (accepted.length > 0) {
      setPending((prev) => [...prev, ...accepted]);
    }
  };

  const removePending = (id: string) =>
    setPending((prev) => prev.filter((item) => item.id !== id));

  const sendMessage = async (text: string, attachments = pending) => {
    if (text.trim().length === 0 && attachments.length === 0) return;
    const currentKey = selectCurrentKey(useSettings.getState());
    if (!currentKey) {
      const message =
        "Add an API key for the selected provider in Settings first.";
      setError(message);
      toast.error("No API key", message);
      return;
    }
    setError(null);
    setInput("");
    setPending([]);
    setSending(true);
    try {
      await sendChatMessage({
        text,
        attachments: attachments.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          kind: a.kind,
          dataUrl: a.dataUrl,
          size: a.size,
        })),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error("Send failed", message);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    await sendMessage(input);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items ?? [];
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) void addFiles(files);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 px-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold">
              O
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                What do you want to build today?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Orbit writes and runs the project in an in-browser Node.js
                sandbox.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setInput(template)}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Virtuoso
            key={currentProjectId ?? "fresh"}
            ref={virtuosoRef}
            data={messages}
            totalCount={messages.length}
            computeItemKey={(index, m) => m?.id ?? String(index)}
            initialTopMostItemIndex={Math.max(0, messages.length - 1)}
            followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
            atBottomStateChange={setAtBottom}
            className="h-full"
            increaseViewportBy={{ top: 300, bottom: 600 }}
            itemContent={(_index, message) => (
              <div className="px-3 pt-2 pb-4">
                <MessageBlock message={message} />
              </div>
            )}
          />
        )}
      </div>

      <form
        className="border-t border-border px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {error ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setSending(true);
                try {
                  await retryChatMessage();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Retry failed");
                } finally {
                  setSending(false);
                }
              }}
              className="flex items-center gap-1 rounded bg-destructive/20 px-1.5 py-0.5 font-medium transition hover:bg-destructive/30"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : null}
        {pending.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 pr-7 text-[11px]"
              >
                {att.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="max-w-[180px] truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removePending(att.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {showAkinatorQuickReply ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {AKINATOR_QUICK_ANSWERS.map((answer) => (
              <button
                key={answer}
                type="button"
                onClick={() => void sendMessage(answer, [])}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition hover:bg-muted"
              >
                {answer}
              </button>
            ))}
          </div>
        ) : null}
        <div className="relative rounded-xl border border-border bg-muted/30 focus-within:border-ring">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (!sendOnEnter) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            onPaste={handlePaste}
            placeholder="Describe what you want to build, or drop / paste a file..."
            className="min-h-[76px] resize-none border-0 bg-transparent pl-10 pr-11 text-sm shadow-none focus-visible:ring-0"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) {
                void addFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-2 left-2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSend && !sending}
            className="absolute bottom-2 right-2"
            aria-label={sending ? "Stop" : "Send"}
            title={sending ? "Stop generation" : "Send message"}
            onClick={(e) => {
              if (sending) {
                e.preventDefault();
                const lastAssistant = [...messages]
                  .reverse()
                  .find((m) => m.role === "assistant");
                if (lastAssistant) {
                  abortChatMessage(lastAssistant.id);
                  setSending(false);
                }
              }
            }}
          >
            {sending ? (
              <Square className="h-3 w-3 fill-current text-amber-500" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          {sendOnEnter
            ? "Enter to send, Shift+Enter for a new line. Drop or paste files."
            : "Click send. Shift+Enter = newline. Drop or paste files."}
        </p>
      </form>
    </div>
  );
}
