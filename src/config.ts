import { randomUUID } from "node:crypto";

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

  browserUse: {
    apiUrl: "https://api.browser-use.com/api/v3",
    apiKey: process.env.BROWSER_USE_API_KEY,
    profileId: process.env.BROWSER_USE_PROFILE_ID,
  },
};

export interface ModelConfig {
  modelName: string;
  apiKey: string;
  baseURL: string;
  headers: Record<string, string>;
}

export function stagehandModel(): ModelConfig {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY is not set");

  return {
    modelName: process.env.STAGEHAND_MODEL_NAME || "openai/deepseek-v4.1-flash",
    apiKey,
    baseURL: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1",
    // Go rejects requests without a stable per-conversation session id. One call per
    // browser session, so this id stays stable for the whole session and is fresh for new ones.
    headers: {
      "x-opencode-session": randomUUID(),
      "User-Agent": process.env.STAGEHAND_USER_AGENT || "stagehand-browser-mcp/1.0",
    },
  };
}
