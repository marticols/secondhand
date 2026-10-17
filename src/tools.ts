import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { closeSession, getSession, lastPage, startSession } from "./sessions.ts";

// Host ./files is mounted here; see docker-compose.yml.
const filesDir = "/app/files";

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
    "upload_file",
    {
      sessionId,
      selector: z.string(),
      path: z
        .string()
        .describe(
          'File name to upload inside /Users/marti/Projects/browser/files',
        ),
    },
    async ({ sessionId, selector, path }) => {
      const page = lastPage(getSession(sessionId).stagehand);
      const target = isAbsolute(path) ? path : join(filesDir, path);
      const outside = relative(filesDir, target);
      if (outside.startsWith("..") || isAbsolute(outside)) {
        throw new Error(`File must be inside ${filesDir} (host ./files), got: ${path}`);
      }
      let base64: string;
      try {
        base64 = (await readFile(target)).toString("base64");
      } catch {
        throw new Error(`Cannot read ${target}. Put the file in the host ./files folder first.`);
      }
      const name = basename(target);
      // The browser runs remotely (browser-use), so it cannot read our local paths;
      // build the File in the page and assign it to the input.
      const files = await page.evaluate(
        ({ selector, name, base64 }) => {
          const el = document.querySelector(selector);
          if (!(el instanceof HTMLInputElement) || el.type !== "file") {
            throw new Error(`Not a file input: ${selector}`);
          }
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const dt = new DataTransfer();
          dt.items.add(new File([bytes], name));
          el.files = dt.files;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return el.files.length;
        },
        { selector, name, base64 },
      );
      return asText({ uploaded: name, files });
    },
  );

  server.tool(
    "observe",
    "Observe actionable elements on the page",
    { sessionId, instruction: z.string().describe("Optional natural language filter") },
    async ({ sessionId, instruction }) => {
      const { stagehand } = getSession(sessionId);
      return asText(instruction ? await stagehand.observe(instruction) : await stagehand.observe());
    },
  );

  server.tool(
    "extract",
    "Extract data from the page. Without an instruction returns the full page text.",
    { sessionId, instruction: z.string().optional() },
    async ({ sessionId, instruction }) => {
      const { stagehand } = getSession(sessionId);
      return asText(instruction ? await stagehand.extract(instruction) : await stagehand.extract());
    },
  );

  return server;
}
