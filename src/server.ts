import { config } from "./config.ts";
import { createApp } from "./http.ts";

const app = createApp();

app.listen(config.port, () => {
  console.error(`[mcp] Browser MCP server listening on http://0.0.0.0:${config.port}/mcp`);
});
