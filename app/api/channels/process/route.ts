import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createOrbitTools } from "@/lib/agent/tools";
import { resolveLanguageModel } from "@/lib/providers/resolve";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message: string;
      providerId: string;
      modelId: string;
      apiKey: string;
      skills?: Array<{
        id: string;
        name: string;
        description: string;
        content: string;
      }>;
      memories?: Array<{ id: string; fact: string; createdAt: number }>;
      history?: Array<{ role: "user" | "assistant"; text: string }>;
    };

    if (!body.message || !body.apiKey) {
      return Response.json(
        { error: "message and apiKey required" },
        { status: 400 },
      );
    }

    const model = resolveLanguageModel({
      providerId: body.providerId as any,
      modelId: body.modelId,
      apiKey: body.apiKey,
    });

    let systemPrompt = AGENT_SYSTEM_PROMPT;

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "long",
    });
    systemPrompt += `\n\n<current_time>\nWaktu sistem saat ini adalah: ${timeFormatter.format(now)}\n</current_time>`;

    if (body.memories && body.memories.length > 0) {
      const memoryList = body.memories.map((m) => `- ${m.fact}`).join("\n");
      systemPrompt += `\n\n<user_memory>\n${memoryList}\n</user_memory>`;
    }

    if (body.skills && body.skills.length > 0) {
      const skillsToc = body.skills
        .map((s) => `- ${s.name}: ${s.description}`)
        .join("\n");
      systemPrompt += `\n\n<available_skills>\n${skillsToc}\nGunakan tool readSkill untuk membaca skill.\n</available_skills>`;
    }

    const orbitTools = await createOrbitTools({}, []);

    const messages: UIMessage[] = [];

    if (body.history && body.history.length > 0) {
      for (let i = 0; i < body.history.length; i++) {
        const msg = body.history[i];
        messages.push({
          id: `h-${i}`,
          role: msg.role,
          parts: [{ type: "text", text: msg.text }],
        });
      }
    }

    messages.push({
      id: "current",
      role: "user",
      parts: [{ type: "text", text: body.message }],
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: orbitTools,
      stopWhen: stepCountIs(6),
      temperature: 0.6,
    });

    let fullResponse = "";
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    return Response.json({
      text: fullResponse || "Maaf, saya tidak bisa memproses permintaan itu.",
    });
  } catch (error) {
    console.error("Channel process error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
