import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "./config.ts";
import { withDeadline } from "./runtime.ts";
import { closeSession, getSession, lastPage, runExclusive, startSession } from "./sessions.ts";

const asText = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

const failure = (label: string, err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[mcp] ${label} failed: ${message}`);
  return {
    content: [{ type: "text" as const, text: `${label} failed: ${message}` }],
    isError: true,
  };
};

// Every tool call is bounded. Stagehand gives its `act`/`observe` model calls no
// timeout of their own, so a stalled model response would otherwise hang the tool
// call — and the client — forever. The extra margin lets stagehand's own (nicer)
// timeout error win when it has one.
const guard = async <T>(label: string, fn: () => Promise<T>) => {
  try {
    return asText(await withDeadline(fn, label, config.callTimeoutMs + 10_000));
  } catch (err) {
    return failure(label, err);
  }
};

const sessionId = z.string().describe("Session ID returned by start_session");

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "secondhand", version: "0.1.0" });

  server.tool("start_session", "", {}, async () =>
    guard("start_session", async () => {
      const session = await startSession();
      return { sessionId: session.id, liveUrl: session.liveUrl };
    }),
  );

  server.tool(
    "close_session",
    "Always close the session when you are done with it.",
    { sessionId },
    async ({ sessionId }) => guard("close_session", async () => ({ closed: await closeSession(sessionId) })),
  );

  server.tool(
    "navigate",
    "",
    { sessionId, url: z.string().describe("Absolute URL to open, e.g. https://example.com") },
    async ({ sessionId, url }) =>
      guard("navigate", () =>
        runExclusive(getSession(sessionId), async (session) => {
          const page = lastPage(session.stagehand);
          await page.goto(url, { waitUntil: "domcontentloaded", timeoutMs: config.callTimeoutMs });
          return { title: await page.title(), url: page.url() };
        }),
      ),
  );

  server.tool(
    "act",
    "Perform a single action on the page described in natural language.",
    { sessionId, action: z.string().describe('e.g. "click the Sign in button"') },
    async ({ sessionId, action }) =>
      guard("act", () =>
        runExclusive(getSession(sessionId), ({ stagehand }) =>
          stagehand.act(action, { timeout: config.callTimeoutMs }),
        ),
      ),
  );

  server.tool(
    "upload_file",
    {
      sessionId,
      selector: z.string(),
      path: z
        .string()
        .describe("File name to upload, relative to the files folder (FILES_DIR)"),
    },
    async ({ sessionId, selector, path }) =>
      guard("upload_file", async () => {
        const target = isAbsolute(path) ? path : join(config.filesDir, path);
        const outside = relative(config.filesDir, target);
        if (outside.startsWith("..") || isAbsolute(outside)) {
          throw new Error(`File must be inside ${config.filesDir}, got: ${path}`);
        }
        let base64: string;
        try {
          base64 = (await readFile(target)).toString("base64");
        } catch {
          throw new Error(`Cannot read ${target}. Put the file in ${config.filesDir} first.`);
        }
        const name = basename(target);
        // The browser runs remotely (browser-use), so it cannot read our local paths;
        // build the File in the page and assign it to the input.
        const files = await runExclusive(getSession(sessionId), ({ stagehand }) =>
          lastPage(stagehand).evaluate(
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
          ),
        );
        return { uploaded: name, files };
      }),
  );

  server.tool(
    "observe",
    "Observe actionable elements on the page",
    { sessionId, instruction: z.string().describe("Optional natural language filter") },
    async ({ sessionId, instruction }) =>
      guard("observe", () =>
        runExclusive(getSession(sessionId), ({ stagehand }) =>
          instruction
            ? stagehand.observe(instruction, { timeout: config.callTimeoutMs })
            : stagehand.observe({ timeout: config.callTimeoutMs }),
        ),
      ),
  );

  server.tool(
    "extract",
    "Extract data from the page. Without an instruction returns the full page text.",
    { sessionId, instruction: z.string().optional() },
    async ({ sessionId, instruction }) =>
      guard("extract", () =>
        runExclusive(getSession(sessionId), ({ stagehand }): Promise<unknown> =>
          instruction
            ? stagehand.extract(instruction, { timeout: config.callTimeoutMs })
            : stagehand.extract({ timeout: config.callTimeoutMs }),
        ),
      ),
  );

  return server;
}
