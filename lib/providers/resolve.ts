import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import type { ProviderId } from "./index";
import { getProvider } from "./index";

export type ResolveOptions = {
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
};

/**
 * Build a Vercel AI SDK LanguageModel for the given provider + model,
 * using a user-supplied API key. Accepts NVIDIA and OpenRouter via the
 * OpenAI-compatible base URL.
 */
export function resolveLanguageModel({
  providerId,
  modelId,
  apiKey,
}: ResolveOptions): LanguageModel {
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${providerId}".`);
  }

  const definition = getProvider(providerId);
  if (!definition) {
    throw new Error(`Unknown provider "${providerId}".`);
  }

  switch (providerId) {
    case "openai":
      return createOpenAI({ apiKey }).chat(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "nvidia":
      return createOpenAI({
        apiKey,
        baseURL: definition.baseURL,
        name: "nvidia",
      }).chat(modelId);
    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: definition.baseURL,
        name: "openrouter",
      }).chat(modelId);
    case "xiaomimimo":
      return createOpenAI({
        apiKey,
        baseURL: definition.baseURL,
        name: "xiaomimimo",
      }).chat(modelId);
    default: {
      const exhaustive: never = providerId;
      throw new Error(`Unhandled provider ${exhaustive as string}`);
    }
  }
}
