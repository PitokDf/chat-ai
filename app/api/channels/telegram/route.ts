import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createOrbitTools } from "@/lib/agent/tools";
import { resolveLanguageModel } from "@/lib/providers/resolve";

const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  const maxLen = 4000;
  const truncated = text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
  try {
    await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch {}
}

async function sendTypingAction(botToken: string, chatId: number | string) {
  await fetch(`${TELEGRAM_API}${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const update = body as {
      message?: { chat: { id: number }; text?: string; from?: { is_bot?: boolean } };
      my_chat_member?: any;
    };

    const url = new URL(request.url);
    const botToken = url.searchParams.get("token");
    const providerId = url.searchParams.get("provider") || "openai";
    const modelId = url.searchParams.get("model") || "gpt-4o-mini";
    const apiKey = url.searchParams.get("key");

    if (!botToken) {
      return Response.json({ error: "Missing bot token" }, { status: 400 });
    }

    if (update.my_chat_member) {
      const chatId = update.my_chat_member.chat.id;
      await sendTelegramMessage(botToken, chatId,
        "Terhubung! Saya siap membantu. Kirim pesan kapan saja.",
      );
      return Response.json({ ok: true });
    }

    const message = update.message;
    if (!message?.text || message.from?.is_bot) {
      return Response.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    await sendTypingAction(botToken, chatId);

    if (apiKey) {
      try {
        const model = resolveLanguageModel({
          providerId: providerId as any,
          modelId,
          apiKey,
        });

        const orbitTools = await createOrbitTools({}, []);

        const result = streamText({
          model,
          system: AGENT_SYSTEM_PROMPT,
          messages: await convertToModelMessages([
            { role: "user", parts: [{ type: "text", text: userText }] },
          ]),
          tools: orbitTools,
          stopWhen: stepCountIs(6),
          temperature: 0.6,
        });

        let fullResponse = "";
        for await (const chunk of result.textStream) {
          fullResponse += chunk;
        }

        await sendTelegramMessage(botToken, chatId, fullResponse || "Maaf, saya tidak bisa memproses permintaan itu.");
      } catch (err) {
        await sendTelegramMessage(botToken, chatId,
          `Error: ${err instanceof Error ? err.message : "Internal error"}`,
        );
      }
    } else {
      await sendTelegramMessage(botToken, chatId,
        "Terima pesanmu! Untuk menggunakan AI, set webhook URL dengan parameter ?key=API_KEY (lihat docs).",
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
