import { config } from "./config.ts";
import { createApp } from "./http.ts";
import { closeAllSessions } from "./sessions.ts";

const app = createApp();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.error(`[mcp] ${signal}, shutting down`);
    await closeAllSessions();
    process.exit(0);
  });
}

app.listen(config.port, () => {
  console.error(`[mcp] Stagehand MCP server listening on http://0.0.0.0:${config.port}/mcp`);
});
