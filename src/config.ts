import { randomUUID } from "node:crypto";

const num = (raw: string | undefined, fallback: number): number =>
  raw === undefined || raw === "" ? fallback : Number(raw);

export const config = {
  port: num(process.env.MCP_HTTP_PORT, 3000),

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
