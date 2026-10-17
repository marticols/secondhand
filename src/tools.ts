import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { closeSession, getSession, lastPage, startSession } from "./sessions.ts";

const asText = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

const sessionId = z.string().describe("Session ID returned by start_session");

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "browser-mcp", version: "0.1.0" });

  server.tool(
    "start_session",
    "",
    {},
    async () => {
      const session = await startSession();
      return asText({ sessionId: session.id, liveUrl: session.liveUrl });
    },
  );

  server.tool(
    "close_session",
    "Always close the session when you are done with it.",
    { sessionId },
    async ({ sessionId }) => asText({ closed: await closeSession(sessionId) }),
  );

  server.tool(
    "navigate",
    "",
    { sessionId, url: z.string().describe("Absolute URL to open, e.g. https://example.com") },
    async ({ sessionId, url }) => {
      const page = lastPage(getSession(sessionId).stagehand);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return asText({ title: await page.title(), url: page.url() });
    },
  );

  server.tool(
    "act",
    "Perform a single action on the page described in natural language.",
    { sessionId, action: z.string().describe('e.g. "click the Sign in button"') },
    async ({ sessionId, action }) => asText(await getSession(sessionId).stagehand.act(action)),
  );

  server.tool(
    "observe",
    "List actionable elements on the page, optionally filtered by an instruction.",
    { sessionId, instruction: z.string().optional().describe("Optional natural language filter") },
    async ({ sessionId, instruction }) => {
      const { stagehand } = getSession(sessionId);
      return asText(instruction ? await stagehand.observe(instruction) : await stagehand.observe());
    },
  );

  server.tool(
    "extract",
    "Extract data from the page. Without an instruction returns the full page text.",
    { sessionId, instruction: z.string().optional().describe("Optional extraction instruction") },
    async ({ sessionId, instruction }) => {
      const { stagehand } = getSession(sessionId);
      return asText(instruction ? await stagehand.extract(instruction) : await stagehand.extract());
    },
  );

  return server;
}
