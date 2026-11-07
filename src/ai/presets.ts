import type { AdapterKind, ModelApi, PresetId } from "@/shared/types";

export interface Preset {
  id: PresetId;
  label: string;
  adapter: AdapterKind;
  defaultBaseUrl: string;
  /** Users may edit the base URL (gateways, remote Ollama, self-hosted servers). */
  editableBaseUrl: boolean;
  needsKey: boolean;
  modelPlaceholder: string;
  keyUrl?: string;
  /** Shown under the form; for provider quirks the user has to know about. */
  note?: string;
  headers?: Record<string, string>;
  /** Header carrying a stable per-conversation id; OpenCode Go rejects requests without one. */
  sessionHeader?: string;
  /** Gateways that serve models on several APIs; the profile picks one per model. */
  apis?: ModelApi[];
}

export const API_LABELS: Record<ModelApi, string> = {
  chat: "OpenAI Chat Completions",
  messages: "Anthropic Messages",
  responses: "OpenAI Responses",
};

const API_ADAPTERS: Record<ModelApi, AdapterKind> = {
  chat: "openai-compatible",
  messages: "anthropic",
  responses: "openai-responses",
};

/** The wire protocol a profile uses: the preset's, unless the profile picked another API the preset allows. */
export function adapterFor(
  preset: Preset,
  api: ModelApi | undefined,
): AdapterKind {
  return api && preset.apis?.includes(api) ? API_ADAPTERS[api] : preset.adapter;
}

export const PRESETS: Record<PresetId, Preset> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    adapter: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "gpt-5-mini",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    adapter: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "claude-haiku-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    adapter: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "deepseek-flash",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "mistral-medium-latest",
    keyUrl: "https://console.mistral.ai/api-keys",
    note: "Mistral also hosts third-party models such as DeepSeek; use Load models to see the IDs your key can call.",
  },
  "opencode-go": {
    id: "opencode-go",
    label: "OpenCode Go",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://opencode.ai/zen/go/v1",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "deepseek-v4.1-flash",
    keyUrl: "https://opencode.ai/console",
    note: "Uses your OpenCode Go subscription. Pick a model from Load models and the right API is chosen for you: Chat Completions for DeepSeek, GLM and Kimi, Anthropic Messages for Claude and Qwen, OpenAI Responses for GPT and Grok. Gemini models in Go are not supported yet.",
    sessionHeader: "x-opencode-session",
    apis: ["chat", "messages", "responses"],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    editableBaseUrl: false,
    needsKey: true,
    modelPlaceholder: "deepseek/deepseek-chat",
    keyUrl: "https://openrouter.ai/keys",
    headers: { "x-title": "Blimp" },
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    adapter: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    editableBaseUrl: true,
    needsKey: false,
    modelPlaceholder: "llama3.2",
    note: 'Start Ollama with OLLAMA_ORIGINS="chrome-extension://*" so it accepts requests from the extension.',
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    adapter: "openai-compatible",
    defaultBaseUrl: "",
    editableBaseUrl: true,
    needsKey: false,
    modelPlaceholder: "model-id",
    note: "Any server that speaks the OpenAI Chat Completions, OpenAI Responses or Anthropic Messages API. Enter the base URL up to /v1.",
    apis: ["chat", "messages", "responses"],
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** Profiles created on first run, so the common providers only need a key. */
export const SEEDED_PRESETS: PresetId[] = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "mistral",
  "opencode-go",
];

/** Ollama and loopback custom endpoints stay on this machine; anything else is hosted. */
export function isHostedEndpoint(preset: PresetId, baseUrl: string): boolean {
  if (preset === "ollama") return false;
  if (preset !== "custom") return true;
  try {
    const host = new URL(baseUrl).hostname;
    return !(host === "localhost" || host === "127.0.0.1" || host === "[::1]");
  } catch {
    return true;
  }
}
