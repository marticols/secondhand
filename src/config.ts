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
}

export function stagehandModel(): ModelConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  return {
    modelName: process.env.STAGEHAND_MODEL_NAME || "openai/openai/gpt-4o-mini",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  };
}
