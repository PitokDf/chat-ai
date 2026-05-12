import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createOrbitTools } from "@/lib/agent/tools";
import type { ProviderId } from "@/lib/providers";
import { resolveLanguageModel } from "@/lib/providers/resolve";

export const runtime = "nodejs";

type ChatRequest = {
  messages: UIMessage[];
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  braveSearchKey?: string;
  searchProvider?: string;
  serperApiKey?: string;
  tavilyApiKey?: string;
  skills?: Array<{
    id: string;
    name: string;
    description: string;
    content: string;
  }>;
  memories?: Array<{ id: string; fact: string; createdAt: number }>;
  mcpServers?: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
  }>;
};

const isValidMessage = (value: unknown): value is UIMessage => {
  if (!value || typeof value !== "object") return false;
  const m = value as { role?: unknown; parts?: unknown };
  if (m.role !== "user" && m.role !== "assistant" && m.role !== "system") {
    return false;
  }
  if (!Array.isArray(m.parts)) return false;
  return m.parts.every((part) => {
    if (!part || typeof part !== "object") return false;
    const type = (part as { type?: unknown }).type;
    return typeof type === "string";
  });
};

export async function POST(request: Request) {
  let payload: Partial<ChatRequest>;
  try {
    payload = (await request.json()) as Partial<ChatRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    messages,
    providerId,
    modelId,
    apiKey,
    braveSearchKey,
    searchProvider,
    serperApiKey,
    tavilyApiKey,
    skills,
    memories,
    mcpServers,
  } = payload;

  if (!Array.isArray(messages) || !messages.every(isValidMessage)) {
    return Response.json(
      { error: "messages must be an array of UIMessage objects." },
      { status: 400 },
    );
  }
  if (!providerId || !modelId) {
    return Response.json(
      { error: "providerId and modelId are required." },
      { status: 400 },
    );
  }
  if (!apiKey || typeof apiKey !== "string") {
    return Response.json(
      { error: `Missing API key for ${providerId}. Add it in Settings.` },
      { status: 400 },
    );
  }

  try {
    const model = resolveLanguageModel({ providerId, modelId, apiKey });

    // Connect to MCP servers
    const { getMcpClients } = await import("@/lib/agent/mcp");
    const mcpClients = mcpServers ? await getMcpClients(mcpServers) : [];

    let dynamicSystemPrompt = AGENT_SYSTEM_PROMPT;

    // Inject system runtime date to prevent AI time hallucinations
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", // Set the primary relative timezone (WIB)
      dateStyle: "full",
      timeStyle: "long",
    });
    dynamicSystemPrompt += `\n\n<current_time>\nWaktu sistem saat ini adalah: ${timeFormatter.format(now)}. Gunakan ini sebagai referensi mutlak hari ini, minggu ini, atau bulan ini. Jangan berhalusinasi soal tanggal.\n</current_time>`;

    if (memories && memories.length > 0) {
      const memoryList = memories.map((m) => `- ${m.fact}`).join("\n");
      dynamicSystemPrompt += `\n\n<user_memory>\nKamu mengingat beberapa fakta tentang user ini secara permanen dari chat sebelumnya:\n${memoryList}\nGunakan informasi di atas untuk melakukan personalisasi jawabanmu. Jangan beri tahu user bahwa kamu "mengingat dari memori", cukup langsung gunakan faktanya secara natural.\n</user_memory>`;
    }

    if (skills && skills.length > 0) {
      const skillsToc = skills
        .map((s) => `- ${s.name}: ${s.description}`)
        .join("\n");
      dynamicSystemPrompt += `\n\n<available_skills>\nKamu memiliki koleksi "Skills" (instruksi/konteks khusus) yang dibuat oleh user. Berikut adalah daftarnya:\n${skillsToc}\nJika user meminta sesuatu yang berkaitan dengan skill di atas, gunakan tool \`readSkill\` untuk membaca instruksi lengkapnya SEBELUM kamu memberikan jawaban akhir atau menulis kode.\n</available_skills>`;
    }

    const orbitTools = await createOrbitTools(
      {
        searchProvider: searchProvider as any,
        braveSearchKey,
        serperApiKey,
        tavilyApiKey,
        skills,
      },
      mcpClients,
    );

    const result = streamText({
      model,
      system: dynamicSystemPrompt,
      messages: await convertToModelMessages(messages),
      tools: orbitTools,
      stopWhen: stepCountIs(6),
      temperature: 0.6,
    });

    // Emit newline-delimited JSON events so the client can distinguish between
    // text deltas, tool calls, and tool results without needing the SDK on
    // the client side.
    const encoder = new TextEncoder();
    const writeEvent = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      payload: Record<string, unknown>,
    ) => {
      controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case "reasoning-delta":
                if (part.text) {
                  writeEvent(controller, { kind: "thought", text: part.text });
                }
                break;
              case "text-delta":
                if (part.text) {
                  writeEvent(controller, { kind: "text", text: part.text });
                }
                break;
              case "tool-input-start":
                writeEvent(controller, {
                  kind: "tool-start",
                  id: part.id,
                  toolName: part.toolName,
                });
                break;
              case "tool-call":
                writeEvent(controller, {
                  kind: "tool-call",
                  id: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                });
                break;
              case "tool-result":
                writeEvent(controller, {
                  kind: "tool-result",
                  id: part.toolCallId,
                  toolName: part.toolName,
                  output: part.output,
                });
                break;
              case "tool-error":
                writeEvent(controller, {
                  kind: "tool-error",
                  id: part.toolCallId,
                  toolName: part.toolName,
                  error:
                    part.error instanceof Error
                      ? part.error.message
                      : String(part.error),
                });
                break;
              case "error": {
                const message =
                  part.error instanceof Error
                    ? part.error.message
                    : String(part.error);
                writeEvent(controller, { kind: "error", error: message });
                break;
              }
              default:
                break;
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream error.";
          writeEvent(controller, { kind: "error", error: message });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Hint to proxies (nginx, Cloudflare, etc.) not to buffer the stream.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
