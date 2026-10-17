import { config } from "./config.ts";
import { createApp } from "./http.ts";
import { beginShutdown, wait } from "./runtime.ts";
import { closeAllSessions } from "./sessions.ts";

const app = createApp();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[mcp] ${signal}, shutting down`);

  // Fail in-flight tool calls now. `node --watch` restarts on every edit, and a
  // request severed without a response leaves the client waiting forever.
  beginShutdown(`Server is restarting (${signal}); the tool call was cancelled, re-run it.`);
  await wait(500); // let the error responses flush
  await Promise.race([closeAllSessions(), wait(3_000)]);
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}

app.listen(config.port, () => {
  console.error(`[mcp] Browser MCP server listening on http://0.0.0.0:${config.port}/mcp`);
});
