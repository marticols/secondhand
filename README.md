# SecondHand

**Stagehand, pre-owned.**  
Your agent gets a real browser. You keep the change.

![Node 24+](https://img.shields.io/badge/node-24%2B-3c873a?style=flat-square)
![MCP server](https://img.shields.io/badge/MCP-server-6b46c1?style=flat-square)
![MIT](https://img.shields.io/badge/license-MIT-black?style=flat-square)

SecondHand is a small MCP server that gives any MCP client a remote Chrome and seven browser tools. The browser is [Browser Use](https://browser-use.com), the actions are [Stagehand](https://stagehand.dev), and the model runs through your [OpenCode Go](https://opencode.ai) subscription.

No local Chrome. No Playwright grid. No per-seat automation SaaS.

## Why this exists

Browser automation stacks are priced for teams with a procurement department. This one is priced for one person with an OpenCode Go subscription.

- **Remote browser** — Browser Use runs Chrome; your machine runs one Node process.
- **Subscription model** — Stagehand talks to OpenCode Go's OpenAI-compatible endpoint.
- **Warm cache** — Stagehand's cache survives restarts in a Docker volume.
- **Small surface** — one Express server, seven tools, no database.

## Up in five minutes

You need:

- Docker
- A Browser Use API key and profile ID
- An OpenCode Go API key

```bash
git clone https://github.com/marticols/secondhand.git
cd secondhand
cp .env.example .env   # fill in the keys
docker compose up -d --build
docker compose logs -f # wait for: listening on http://0.0.0.0:3900/mcp
```

MCP endpoint: `http://localhost:3900/mcp`

Smoke test:

```bash
curl -s http://localhost:3900/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

You should get an `initialize` result naming `secondhand`.

## Connect your client

OpenCode (`opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "secondhand": {
      "type": "remote",
      "url": "http://localhost:3900/mcp"
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http secondhand http://localhost:3900/mcp
```

Cursor, Windsurf, or anything that reads `mcpServers`:

```json
{
  "mcpServers": {
    "secondhand": { "url": "http://localhost:3900/mcp" }
  }
}
```

## The tools

| Tool | What it does |
| --- | --- |
| `start_session` | Starts a remote browser. Returns a `sessionId` and a `liveUrl` you can watch. |
| `navigate` | Opens a URL, waits for DOM content, returns the title and final URL. |
| `act` | Performs one action in plain English: "click the Sign in button". |
| `observe` | Lists actionable elements, optionally filtered by instruction. |
| `extract` | Pulls structured data. With no instruction, returns the page text. |
| `upload_file` | Attaches a file from `./files` to a file input. |
| `close_session` | Closes Stagehand and stops the Browser Use session. |

### Talk to it

> Start a session.  
> Go to news.ycombinator.com and extract the top 10 stories with points.  
> Click the first story.  
> Upload files/resume.pdf to the resume input.  
> Close the session.

## Different tools? Ask for them.

This repo is meant to be forked and prompted. Every capability is one `server.tool(...)` call in `src/tools.ts`; every setting is in `src/config.ts`.

Open your coding agent in the repo and say:

- "Add a `screenshot` tool that saves a PNG under `files/` and returns the path."
- "Add a `press_key` tool for Enter and Escape."
- "Add a `scroll` tool with pixel and page modes."
- "Add multi-tab support: open, list, switch, close."
- "Make `navigate` wait for network idle instead of DOM content."

Then:

```bash
npm run typecheck
```

The dev container watches `src/` and reloads on save. No test suite: typecheck is the gate.

## Configuration

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `OPENCODE_API_KEY` | yes | — | OpenCode Go key. |
| `OPENCODE_BASE_URL` | no | `https://opencode.ai/zen/go/v1` | OpenAI-compatible endpoint. |
| `STAGEHAND_MODEL_NAME` | no | `openai/deepseek-v4.1-flash` | Model Stagehand calls. |
| `BROWSER_USE_API_KEY` | yes | — | Browser Use API key. |
| `BROWSER_USE_PROFILE_ID` | yes | — | Browser Use profile. Keeps cookies and logins. |
| `MCP_HTTP_PORT` | no | `3000` | HTTP port. The example `.env` uses `3900`. |
| `MCP_CALL_TIMEOUT_MS` | no | `120000` | Hard deadline per tool call. |
| `LLM_MAX_MS` | no | `90000` | Stagehand's own extract deadline. |

## Uploading files

Put files in `./files`. Docker mounts that folder at `/app/files`, the default upload root. `upload_file` reads the file locally, base64-encodes it, and injects it into the remote page's file input. The remote browser never needs access to your disk.

```bash
cp ~/Documents/resume.pdf files/
```

## Limits

- One operation per session at a time. Calls are queued, not parallel.
- Hard per-call deadline: 120 seconds by default.
- Sessions live in memory. Restarting the server drops them.
- Browser Use bills by session. Call `close_session`.
- `/mcp` has no authentication. Keep it on localhost or put it behind a proxy.

## How it works

```
MCP client ── HTTP ──▶ SecondHand ── Stagehand ──▶ Browser Use
                          │                          (remote Chrome)
                          └──── OpenCode Go ────▶ model
```

Docker Compose mounts:

- `./files` → `/app/files` (uploads)
- `stagehand-cache` volume → `/app/.cache` (warm cache)

## Local development

Node 24+:

```bash
npm install
cp .env.example .env
npm run dev
npm run typecheck
```

`npm run dev` loads `.env` when present and restarts on change.

## License

MIT. Not affiliated with Browserbase or Browser Use.
