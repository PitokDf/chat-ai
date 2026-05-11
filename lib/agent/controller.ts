"use client";

import { nanoid } from "nanoid";

import { executeAction } from "@/lib/agent/executor";
import { ArtifactStreamParser, type ParsedAction } from "@/lib/agent/parser";
import { useChat, type ChatMessage } from "@/lib/store/chat";
import { saveMessage, useProject } from "@/lib/store/project";
import { selectCurrentKey, useSettings } from "@/lib/store/settings";
import { usePreferences } from "@/lib/store/preferences";
import type { ProviderId } from "@/lib/providers";

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; url: string };

const toUIMessages = (messages: ChatMessage[]) =>
  messages
    .filter((m) => m.status !== "error")
    .map((m) => {
      const parts: UIMessagePart[] = [];
      if (m.role === "user") {
        const attachments = m.attachments ?? [];
        for (const attachment of attachments) {
          parts.push({
            type: "file",
            mediaType: attachment.mimeType,
            url: attachment.dataUrl,
          });
        }
        parts.push({ type: "text", text: m.text });
      } else {
        parts.push({ type: "text", text: toRawContent(m) });
      }
      return { id: m.id, role: m.role, parts };
    });

/** Re-serialize assistant messages including artifacts so subsequent turns
 *  let the model see what it already wrote. Tool calls are summarized as
 *  short markers because the full payload is often huge. */
const toRawContent = (m: ChatMessage) => {
  if (m.role === "user") return m.text;
  let body = m.text;
  for (const artifact of m.artifacts) {
    body += `\n<orbitArtifact id="${artifact.id}" title="${artifact.title}">`;
    for (const action of artifact.actions) {
      const attrs =
        action.type === "file"
          ? ` type="file" filePath="${action.filePath ?? ""}"`
          : ` type="${action.type}"`;
      body += `\n<orbitAction${attrs}>\n${action.content}\n</orbitAction>`;
    }
    body += `\n</orbitArtifact>`;
  }
  return body;
};

export type SendOptions = {
  text: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    kind: "image" | "file";
    dataUrl: string;
    size: number;
  }>;
};

const summarizeForTitle = (text: string) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 48) return cleaned;
  return `${cleaned.slice(0, 45)}...`;
};

type StreamEvent =
  | { kind: "text"; text: string }
  | { kind: "tool-start"; id: string; toolName: string }
  | { kind: "tool-call"; id: string; toolName: string; input?: unknown }
  | {
      kind: "tool-result";
      id: string;
      toolName: string;
      output: unknown;
    }
  | {
      kind: "tool-error";
      id: string;
      toolName: string;
      error: string;
    }
  | { kind: "error"; error: string };

const isStreamEvent = (value: unknown): value is StreamEvent => {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string";
};

/**
 * Send a user message, stream the reply, and execute any artifact actions.
 */
export const sendChatMessage = async ({ text, attachments }: SendOptions) => {
  const trimmed = text.trim();
  if (!trimmed && (!attachments || attachments.length === 0)) return;

  const { providerId, modelId } = useSettings.getState();
  const apiKey = selectCurrentKey(useSettings.getState());
  if (!apiKey) {
    throw new Error(
      `Add your API key for ${providerId} in Settings before sending.`,
    );
  }

  const projectId = await useProject
    .getState()
    .ensureProject(trimmed.length > 0 ? summarizeForTitle(trimmed) : undefined);

  const userMessage: ChatMessage = {
    id: nanoid(10),
    role: "user",
    text: trimmed,
    artifacts: [],
    toolCalls: [],
    attachments: attachments?.map((a) => ({ id: nanoid(8), ...a })),
    status: "done",
    createdAt: Date.now(),
  };
  useChat.getState().appendMessage(userMessage);
  await saveMessage({
    id: userMessage.id,
    projectId,
    role: "user",
    content: trimmed,
    createdAt: userMessage.createdAt,
  });

  const assistantId = nanoid(10);
  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: "assistant",
    text: "",
    artifacts: [],
    toolCalls: [],
    providerId,
    modelId,
    status: "streaming",
    createdAt: Date.now(),
  };
  useChat.getState().appendMessage(assistantMessage);

  const historyForModel = toUIMessages([
    ...useChat.getState().messages.filter((m) => m.id !== assistantId),
  ]);

  let response: Response;
  try {
      const prefs = usePreferences.getState();
      const { skills } = await import("@/lib/store/skills").then((m) => m.useSkills.getState());
      const { memories } = await import("@/lib/store/memory").then((m) => m.useMemory.getState());
      const { servers } = await import("@/lib/store/mcp").then((m) => m.useMcp.getState());
      response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          modelId,
          apiKey,
          searchProvider: prefs.searchProvider,
          braveSearchKey: prefs.braveSearchKey || undefined,
          serperApiKey: prefs.serperApiKey || undefined,
          tavilyApiKey: prefs.tavilyApiKey || undefined,
          skills: skills || [],
          memories: memories || [],
          mcpServers: servers?.filter((s) => s.active) || [],
          messages: historyForModel,
        }),
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error.";
    useChat.getState().updateMessage(assistantId, (m) => ({
      ...m,
      status: "error",
      text: message,
    }));
    throw error;
  }

  if (!response.ok || !response.body) {
    const payload = await response
      .json()
      .catch(() => ({}) as { error?: string });
    const message = payload?.error ?? `Request failed with ${response.status}.`;
    useChat.getState().updateMessage(assistantId, (m) => ({
      ...m,
      status: "error",
      text: message,
    }));
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new ArtifactStreamParser();
  const actionQueue: ParsedAction[] = [];
  let executing = Promise.resolve();
  let buffer = "";

  const scheduleExecute = (action: ParsedAction) => {
    actionQueue.push(action);
    executing = executing.then(async () => {
      const next = actionQueue.shift();
      if (!next) return;
      try {
        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          artifacts: m.artifacts.map((artifact) => ({
            ...artifact,
            actions: artifact.actions.map((a) =>
              a.id === next.id ? { ...a, status: "running" } : a,
            ),
          })),
        }));
        const result = await executeAction(next, { projectId });
        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          artifacts: m.artifacts.map((artifact) => ({
            ...artifact,
            actions: artifact.actions.map((a) =>
              a.id === next.id
                ? { ...a, status: "done", note: result?.note }
                : a,
            ),
          })),
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Action failed.";
        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          artifacts: m.artifacts.map((artifact) => ({
            ...artifact,
            actions: artifact.actions.map((a) =>
              a.id === next.id ? { ...a, status: "error", error: message } : a,
            ),
          })),
        }));
      }
    });
  };

  const applyArtifactEvents = (
    events: ReturnType<ArtifactStreamParser["push"]>,
  ) => {
    for (const event of events) {
      switch (event.kind) {
        case "text":
          useChat.getState().updateMessage(assistantId, (m) => ({
            ...m,
            text: m.text + event.text,
          }));
          break;
        case "artifact-open":
          useChat.getState().updateMessage(assistantId, (m) => ({
            ...m,
            artifacts: [
              ...m.artifacts,
              { id: event.id, title: event.title, actions: [] },
            ],
          }));
          break;
        case "artifact-close":
          break;
        case "action-open": {
          const action = event.action;
          useChat.getState().updateMessage(assistantId, (m) => {
            const artifacts = [...m.artifacts];
            const last = artifacts[artifacts.length - 1];
            if (last) {
              last.actions = [
                ...last.actions,
                {
                  id: action.id,
                  type: action.type,
                  filePath: action.filePath,
                  content: "",
                  status: "streaming",
                },
              ];
            }
            return { ...m, artifacts };
          });
          break;
        }
        case "action-delta":
          useChat.getState().updateMessage(assistantId, (m) => ({
            ...m,
            artifacts: m.artifacts.map((artifact) => ({
              ...artifact,
              actions: artifact.actions.map((a) =>
                a.id === event.actionId
                  ? { ...a, content: a.content + event.chunk }
                  : a,
              ),
            })),
          }));
          break;
        case "action-close": {
          const message = useChat
            .getState()
            .messages.find((m) => m.id === assistantId);
          if (!message) break;
          for (const artifact of message.artifacts) {
            const action = artifact.actions.find(
              (a) => a.id === event.actionId,
            );
            if (action) {
              scheduleExecute({
                id: action.id,
                type: action.type,
                filePath: action.filePath,
                content: action.content,
              });
              break;
            }
          }
          break;
        }
      }
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.kind) {
      case "text":
        applyArtifactEvents(parser.push(event.text));
        break;
      case "tool-start":
        useChat.getState().updateMessage(assistantId, (m) => {
          if (m.toolCalls.some((t) => t.id === event.id)) return m;
          return {
            ...m,
            toolCalls: [
              ...m.toolCalls,
              {
                id: event.id,
                toolName: event.toolName,
                status: "pending",
              },
            ],
          };
        });
        break;
      case "tool-call":
        useChat.getState().updateMessage(assistantId, (m) => {
          const existing = m.toolCalls.find((t) => t.id === event.id);
          if (existing) {
            return {
              ...m,
              toolCalls: m.toolCalls.map((t) =>
                t.id === event.id
                  ? { ...t, input: event.input, status: "running" }
                  : t,
              ),
            };
          }
          return {
            ...m,
            toolCalls: [
              ...m.toolCalls,
              {
                id: event.id,
                toolName: event.toolName,
                input: event.input,
                status: "running",
              },
            ],
          };
        });
        break;
      case "tool-result": {
        const output = event.output as { error?: string } | unknown;
        const hasError =
          output && typeof output === "object" && "error" in output;
          
        // INTERCEPTOR: Jika AI berhasil memanggil saveMemory, simpan ke lokal
        if (event.toolName === "saveMemory" && !hasError) {
          const resultObj = output as { savedFact?: string };
          if (resultObj?.savedFact) {
            import("@/lib/store/memory").then((m) => {
              m.useMemory.getState().addMemory(resultObj.savedFact as string);
            });
          }
        }

        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          toolCalls: m.toolCalls.map((t) =>
            t.id === event.id
              ? {
                  ...t,
                  output: event.output,
                  status: hasError ? "error" : "done",
                  error: hasError
                    ? (output as { error: string }).error
                    : undefined,
                }
              : t,
          ),
        }));
        break;
      }
      case "tool-error":
        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          toolCalls: m.toolCalls.map((t) =>
            t.id === event.id
              ? { ...t, status: "error", error: event.error }
              : t,
          ),
        }));
        break;
      case "error":
        useChat.getState().updateMessage(assistantId, (m) => ({
          ...m,
          status: "error",
          text: m.text + `\n\n[error] ${event.error}`,
        }));
        break;
    }
  };

  const processBuffer = (flush = false) => {
    let newlineIndex: number;
    // eslint-disable-next-line no-cond-assign
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line) as unknown;
        if (isStreamEvent(event)) handleStreamEvent(event);
      } catch {
        // Ignore malformed lines.
      }
    }
    if (flush && buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim()) as unknown;
        if (isStreamEvent(event)) handleStreamEvent(event);
      } catch {
        // ignore
      }
      buffer = "";
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      processBuffer();
    }
    processBuffer(true);
    applyArtifactEvents(parser.finish());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream failed.";
    useChat.getState().updateMessage(assistantId, (m) => ({
      ...m,
      status: "error",
      text: `${m.text}\n\n${message}`,
    }));
    throw error;
  }

  await executing;

  useChat.getState().updateMessage(assistantId, (m) => ({
    ...m,
    status: "done",
  }));

  const finalMessage = useChat
    .getState()
    .messages.find((m) => m.id === assistantId);
  if (finalMessage) {
    await saveMessage({
      id: finalMessage.id,
      projectId,
      role: "assistant",
      content: toRawContent(finalMessage),
      createdAt: finalMessage.createdAt,
      providerId: finalMessage.providerId as ProviderId | undefined,
      modelId: finalMessage.modelId,
      toolCalls:
        finalMessage.toolCalls.length > 0
          ? JSON.stringify(finalMessage.toolCalls)
          : undefined,
    });
  }
};
