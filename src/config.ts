import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const num = (raw: string | undefined, fallback: number): number =>
  raw === undefined || raw === "" ? fallback : Number(raw);

// Stagehand bounds its `extract` model call with this env var but gives `act` and
// `observe` none; the per-call deadline in runtime.ts is what really guards every
// call. Set it anyway so extract fails with a clear model error first.
process.env.LLM_MAX_MS ??= String(num(process.env.LLM_MAX_MS, 90_000));

export const config = {
  port: num(process.env.MCP_HTTP_PORT, 3000),

  // Hard ceiling for a single tool call (model round trip + browser work). Without
  // it a stalled model response hangs the call — and the client — indefinitely.
  callTimeoutMs: num(process.env.MCP_CALL_TIMEOUT_MS, 120_000),

  // Upload root for upload_file. Resolved against the working dir, so the default
  // is ./files on the host and /app/files in Docker.
  filesDir: resolve(process.env.FILES_DIR || "files"),

  browserUse: {
    apiUrl: "https://api.browser-use.com/api/v3",
    apiKey: process.env.BROWSER_USE_API_KEY,
    profileId: process.env.BROWSER_USE_PROFILE_ID,
  },
};

export interface ModelConfig {
  modelName: string;
  apiKey: string;
  baseURL?: string;
  headers: Record<string, string>;
}

// Providers Stagehand can drive through its AI SDK integration, each with the
// env vars it conventionally reads its key from. STAGEHAND_API_KEY overrides any
// of them, so custom OpenAI-compatible endpoints work without a provider entry.
const providers: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  groq: ["GROQ_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  xai: ["XAI_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  togetherai: ["TOGETHER_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
};

function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function splitModelName(modelName: string): { provider: string; model: string } {
  const slash = modelName.indexOf("/");
  if (slash <= 0 || slash === modelName.length - 1) {
    throw new Error(`STAGEHAND_MODEL_NAME must be "<provider>/<model>", got: ${modelName}`);
  }
  return { provider: modelName.slice(0, slash), model: modelName.slice(slash + 1) };
}

/**
 * Extra headers from STAGEHAND_HEADERS (JSON object). `{{sessionId}}` is replaced
 * with a fresh UUID per session — OpenCode Go wants one in `x-opencode-session`.
 */
function modelHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": process.env.STAGEHAND_USER_AGENT || "stagehand-browser-mcp/1.0",
  };
  const raw = process.env.STAGEHAND_HEADERS;
  if (!raw) return headers;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("STAGEHAND_HEADERS must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("STAGEHAND_HEADERS must be a JSON object");
  }

  let sessionId: string | undefined;
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value !== "string") throw new Error(`STAGEHAND_HEADERS.${name} must be a string`);
    headers[name] = value.replaceAll("{{sessionId}}", (sessionId ??= randomUUID()));
  }
  return headers;
}

export function stagehandModel(): ModelConfig {
  const modelName = process.env.STAGEHAND_MODEL_NAME;
  if (!modelName) throw new Error("STAGEHAND_MODEL_NAME is not set");

  const { provider } = splitModelName(modelName);
  const keyNames = providers[provider] || [];
  const apiKey = process.env.STAGEHAND_API_KEY || env(...keyNames);
  if (!apiKey) {
    const hint = keyNames.length ? ` or ${keyNames.join(" or ")}` : "";
    throw new Error(`No API key for "${provider}". Set STAGEHAND_API_KEY${hint}`);
  }

  return {
    modelName,
    apiKey,
    baseURL: process.env.STAGEHAND_BASE_URL || undefined,
    headers: modelHeaders(),
  };
}
