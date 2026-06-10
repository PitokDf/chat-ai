"use client";

import { useEffect, useRef } from "react";
import { usePreferences } from "@/lib/store/preferences";
import { useChat } from "@/lib/store/chat";
import { useSettings, selectCurrentKey } from "@/lib/store/settings";
import { useSkills } from "@/lib/store/skills";
import { useMemory } from "@/lib/store/memory";

let globalOffset = 0;
let globalPolling = false;
const POLL_INTERVAL = 5000;
const MAX_HISTORY = 20;

const chatHistories = new Map<string, Array<{ role: "user" | "assistant"; text: string }>>();

function sanitizeForTelegram(text: string): string {
  // 1. Extract and protect code blocks + inline code
  const codeBlocks: string[] = [];
  let processed = text.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
  });
  const inlineCodes: string[] = [];
  processed = processed.replace(/`[^`]+`/g, (m) => {
    inlineCodes.push(m);
    return `\x00INLINECODE${inlineCodes.length - 1}\x00`;
  });

  // 2. Strip unsupported patterns
  const lines = processed.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    let cleaned = line;
    cleaned = cleaned.replace(/^#{1,6}\s+/, "");
    cleaned = cleaned.replace(/^>\s?/, "");
    cleaned = cleaned.replace(/^\s*[-*+]\s+/, "");
    cleaned = cleaned.replace(/^\s*\d+\.\s+/, "");
    if (/^\s*[-*_]{3,}\s*$/.test(cleaned)) continue;
    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");
    if (/^\|.*\|$/.test(cleaned) && /[-:]+/.test(cleaned)) continue;
    if (/^\|.+\|$/.test(cleaned)) {
      cleaned = cleaned.replace(/^\||\|$/g, "").trim();
    }
    // Convert **bold** to *bold* (MarkdownV1 only supports single *)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "*$1*");
    out.push(cleaned);
  }

  processed = out.join("\n").trim();

  // 3. Restore protected inline codes
  processed = processed.replace(/\x00INLINECODE(\d+)\x00/g, (_, i) => inlineCodes[Number(i)]);
  // Restore protected code blocks
  processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);

  // 4. Escape remaining special chars outside of code spans
  const parts = processed.split(/(```[\s\S]*?```|`[^`]+`)/g);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith("`")) {
      parts[i] = parts[i].replace(/([_*\[\]()~>#+\-=|{}!])/g, "\\$1");
    }
  }

  return parts.join("");
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  const maxLen = 4000;
  let sanitized = sanitizeForTelegram(text);
  if (sanitized.length > maxLen) {
    sanitized = sanitized.slice(0, maxLen - 3) + "...";
  }
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: sanitized,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch {}
}

export function TelegramPoller() {
  const botToken = usePreferences((s) => s.telegramBotToken);
  const chatId = usePreferences((s) => s.telegramChatId);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!botToken || !chatId) return;

    const poll = async () => {
      if (globalPolling) return;
      globalPolling = true;
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?offset=${globalOffset + 1}&timeout=10&allowed_updates=["message"]`,
        );
        const data = (await res.json()) as {
          ok: boolean;
          result?: Array<{
            update_id: number;
            message?: {
              message_id: number;
              chat: { id: number };
              text?: string;
              from?: { is_bot?: boolean };
            };
          }>;
        };

        if (!data.ok || !data.result) return;

        for (const update of data.result) {
          if (update.update_id >= globalOffset) {
            globalOffset = update.update_id;
          }

          const msg = update.message;
          if (!msg?.text || msg.from?.is_bot) continue;

          const msgChatId = String(msg.chat.id);
          if (msgChatId !== chatId) continue;

          if (processingRef.current) return;
          processingRef.current = true;

          try {
            useChat.getState().appendMessage({
              id: `tg-${Date.now()}`,
              role: "user",
              text: `[Telegram] ${msg.text}`,
              artifacts: [],
              toolCalls: [],
              status: "done",
              createdAt: Date.now(),
            });

            const settings = useSettings.getState();
            const apiKey = selectCurrentKey(settings);
            if (!apiKey || !settings.modelId) {
              processingRef.current = false;
              return;
            }

            const skills = useSkills.getState().skills;
            const memories = useMemory.getState().memories;

            const history = chatHistories.get(chatId) ?? [];

            const processRes = await fetch("/api/channels/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: msg.text,
                providerId: settings.providerId,
                modelId: settings.modelId,
                apiKey,
                skills: skills ?? [],
                memories: memories ?? [],
                history,
              }),
            });

            if (!processRes.ok) {
              processingRef.current = false;
              return;
            }

            const processData = (await processRes.json()) as { text?: string };
            if (processData.text) {
              history.push({ role: "user", text: msg.text });
              history.push({ role: "assistant", text: processData.text });
              if (history.length > MAX_HISTORY * 2) {
                history.splice(0, history.length - MAX_HISTORY * 2);
              }
              chatHistories.set(chatId, history);

              useChat.getState().appendMessage({
                id: `tg-resp-${Date.now()}`,
                role: "assistant",
                text: processData.text,
                artifacts: [],
                toolCalls: [],
                status: "done",
                createdAt: Date.now(),
              });

              await sendTelegramMessage(botToken, msg.chat.id, processData.text);
            }
          } finally {
            processingRef.current = false;
          }
        }
      } catch {
        // ignore poll errors
      } finally {
        globalPolling = false;
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL);
    poll();

    return () => {
      clearInterval(intervalId);
      globalPolling = false;
    };
  }, [botToken, chatId]);

  return null;
}
