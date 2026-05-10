/**
 * Proxies a "list models" request to the selected provider.
 *
 * Why server-side: Anthropic and some others don't allow browser CORS calls,
 * and we want to avoid exposing API keys in the response anyway.
 *
 * Request body: { providerId, apiKey }
 * Response:     { models: ProviderModel[], source: "live" | "fallback" }
 */
import {
  PROVIDERS,
  getProvider,
  type ProviderId,
  type ProviderModel,
} from "@/lib/providers";

export const runtime = "nodejs";

type RequestBody = {
  providerId?: ProviderId;
  apiKey?: string;
};

const humanizeId = (id: string) =>
  id
    .replace(/^models\//, "")
    .split(/[\/\-_.]/)
    .map((part) =>
      part.length <= 3
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");

type OpenAIModel = { id?: string; object?: string };
type AnthropicModel = { id?: string; display_name?: string; type?: string };
type GoogleModel = {
  name?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
};

const fetchOpenAICompat = async (
  baseURL: string,
  apiKey: string,
): Promise<ProviderModel[]> => {
  const res = await fetch(`${baseURL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: OpenAIModel[] };
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .filter(
      (row): row is Required<OpenAIModel> =>
        typeof row?.id === "string" && row.id.length > 0,
    )
    .map((row) => ({
      id: row.id,
      label: humanizeId(row.id) || row.id,
    }));
};

const fetchAnthropic = async (
  baseURL: string,
  apiKey: string,
): Promise<ProviderModel[]> => {
  const res = await fetch(`${baseURL}/models?limit=200`, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: AnthropicModel[] };
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .filter(
      (row): row is Required<AnthropicModel> =>
        typeof row?.id === "string" && row.id.length > 0,
    )
    .map((row) => ({
      id: row.id,
      label: row.display_name || humanizeId(row.id),
    }));
};

const fetchGoogle = async (
  baseURL: string,
  apiKey: string,
): Promise<ProviderModel[]> => {
  const res = await fetch(
    `${baseURL}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { models?: GoogleModel[] };
  const rows = Array.isArray(json?.models) ? json.models : [];
  return rows
    .filter((row) => {
      if (!row?.name) return false;
      const methods = row.supportedGenerationMethods ?? [];
      // Only show chat-capable models.
      return methods.length === 0 || methods.includes("generateContent");
    })
    .map((row) => {
      const id = row.name!.replace(/^models\//, "");
      return {
        id,
        label: row.displayName || humanizeId(id),
      };
    });
};

const sortAndDedupe = (models: ProviderModel[]): ProviderModel[] => {
  const seen = new Set<string>();
  const deduped: ProviderModel[] = [];
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    deduped.push(model);
  }
  deduped.sort((a, b) => a.id.localeCompare(b.id));
  return deduped;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const providerId = body.providerId;
  const apiKey = body.apiKey?.trim() ?? "";

  const definition = providerId ? getProvider(providerId) : undefined;
  if (!definition) {
    return Response.json({ error: "Unknown providerId." }, { status: 400 });
  }

  if (!apiKey) {
    return Response.json({
      models: definition.models,
      source: "fallback" as const,
      reason: "no-api-key",
    });
  }

  try {
    let live: ProviderModel[] = [];
    switch (definition.kind) {
      case "openai-compat":
        live = await fetchOpenAICompat(definition.baseURL, apiKey);
        break;
      case "anthropic":
        live = await fetchAnthropic(definition.baseURL, apiKey);
        break;
      case "google":
        live = await fetchGoogle(definition.baseURL, apiKey);
        break;
    }
    if (live.length === 0) {
      return Response.json({
        models: definition.models,
        source: "fallback" as const,
        reason: "empty-response",
      });
    }
    return Response.json({
      models: sortAndDedupe(live),
      source: "live" as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({
      models: definition.models,
      source: "fallback" as const,
      reason: message,
    });
  }
}

/** Also expose GET so we can prefetch default/fallback lists without a key. */
export async function GET() {
  const payload = PROVIDERS.map((provider) => ({
    id: provider.id,
    models: provider.models,
  }));
  return Response.json({ providers: payload });
}
