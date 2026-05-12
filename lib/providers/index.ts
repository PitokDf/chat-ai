export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "nvidia"
  | "openrouter"
  | "xiaomimimo";

export type ProviderModel = {
  id: string;
  label: string;
  contextWindow?: number;
  supportsTools?: boolean;
};

/**
 * Models listing protocol. Used server-side by /api/providers/models.
 *
 * - openai-compat: OpenAI-style GET {baseURL}/models with Bearer token.
 *   Matches OpenAI, Groq, Mistral, NVIDIA, OpenRouter.
 * - anthropic:     GET https://api.anthropic.com/v1/models with x-api-key.
 * - google:        GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 */
export type ProviderKind = "openai-compat" | "anthropic" | "google";

export type ProviderDefinition = {
  id: ProviderId;
  name: string;
  description: string;
  /** Base URL used both for AI SDK model calls and model listing. */
  baseURL: string;
  /** Where users get their API key. */
  keyUrl: string;
  kind: ProviderKind;
  /** Static fallback used until the live list loads or when the API fails. */
  models: ProviderModel[];
};

const OPENAI_BASE = "https://api.openai.com/v1";

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT family via api.openai.com",
    baseURL: OPENAI_BASE,
    kind: "openai-compat",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5", label: "GPT-5", supportsTools: true },
      { id: "gpt-5-mini", label: "GPT-5 mini", supportsTools: true },
      { id: "gpt-4.1", label: "GPT-4.1", supportsTools: true },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", supportsTools: true },
      { id: "gpt-4o", label: "GPT-4o", supportsTools: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini", supportsTools: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude family via api.anthropic.com",
    baseURL: "https://api.anthropic.com/v1",
    kind: "anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-4-5", label: "Claude Opus 4.5", supportsTools: true },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        supportsTools: true,
      },
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        supportsTools: true,
      },
      {
        id: "claude-3-7-sonnet-latest",
        label: "Claude 3.7 Sonnet",
        supportsTools: true,
      },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini via generativelanguage.googleapis.com",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    kind: "google",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", supportsTools: true },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        supportsTools: true,
      },
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        supportsTools: true,
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra fast inference via api.groq.com",
    baseURL: "https://api.groq.com/openai/v1",
    kind: "openai-compat",
    keyUrl: "https://console.groq.com/keys",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        supportsTools: true,
      },
      {
        id: "llama-3.1-8b-instant",
        label: "Llama 3.1 8B",
        supportsTools: true,
      },
      {
        id: "deepseek-r1-distill-llama-70b",
        label: "DeepSeek R1 Distill 70B",
        supportsTools: true,
      },
      { id: "qwen/qwen3-32b", label: "Qwen 3 32B", supportsTools: true },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral AI via api.mistral.ai",
    baseURL: "https://api.mistral.ai/v1",
    kind: "openai-compat",
    keyUrl: "https://console.mistral.ai/api-keys",
    models: [
      {
        id: "mistral-large-latest",
        label: "Mistral Large",
        supportsTools: true,
      },
      {
        id: "mistral-medium-latest",
        label: "Mistral Medium",
        supportsTools: true,
      },
      { id: "codestral-latest", label: "Codestral", supportsTools: true },
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    description: "OpenAI-compatible endpoint at integrate.api.nvidia.com",
    baseURL: "https://integrate.api.nvidia.com/v1",
    kind: "openai-compat",
    keyUrl: "https://build.nvidia.com/",
    models: [
      {
        id: "deepseek-ai/deepseek-v4-pro",
        label: "DeepSeek V4 Pro",
        supportsTools: true,
      },
      {
        id: "deepseek-ai/deepseek-r1",
        label: "DeepSeek R1",
        supportsTools: true,
      },
      {
        id: "meta/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B Instruct",
        supportsTools: true,
      },
      {
        id: "qwen/qwen3-coder-480b-a35b-instruct",
        label: "Qwen3 Coder 480B",
        supportsTools: true,
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Aggregator via openrouter.ai (OpenAI-compatible)",
    baseURL: "https://openrouter.ai/api/v1",
    kind: "openai-compat",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      {
        id: "anthropic/claude-sonnet-4.5",
        label: "Claude Sonnet 4.5",
        supportsTools: true,
      },
      { id: "openai/gpt-5", label: "GPT-5", supportsTools: true },
      {
        id: "google/gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        supportsTools: true,
      },
      { id: "x-ai/grok-4", label: "Grok 4", supportsTools: true },
      {
        id: "deepseek/deepseek-chat-v3.1",
        label: "DeepSeek V3.1",
        supportsTools: true,
      },
    ],
  },
  {
    id: "xiaomimimo",
    name: "Xiaomi Mimo",
    description: "Xiaomi Mimo Platform (OpenAI-compatible)",
    baseURL: "https://api.xiaomimimo.com/v1",
    kind: "openai-compat",
    keyUrl: "https://platform.xiaomimimo.com/console/api-keys",
    models: [
      { id: "gpt-4o", label: "GPT-4o", supportsTools: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini", supportsTools: true },
      {
        id: "claude-3-5-sonnet-20240620",
        label: "Claude 3.5 Sonnet",
        supportsTools: true,
      },
      { id: "deepseek-chat", label: "DeepSeek Chat", supportsTools: true },
    ],
  },
];

export const getProvider = (id: ProviderId) =>
  PROVIDERS.find((provider) => provider.id === id);

export type ModelSelection = {
  providerId: ProviderId;
  modelId: string;
};

export const findDefaultModel = (): ModelSelection => ({
  providerId: "anthropic",
  modelId: "claude-sonnet-4-5",
});
