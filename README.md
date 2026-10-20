# SecondHand

**Stagehand, pre-owned.**  
Your agent gets a real browser. You keep the change.

![Node 24+](https://img.shields.io/badge/node-24%2B-3c873a?style=flat-square)
![MCP server](https://img.shields.io/badge/MCP-server-6b46c1?style=flat-square)
![MIT](https://img.shields.io/badge/license-MIT-black?style=flat-square)

A small MCP server that gives any MCP client a remote Chrome and seven browser tools. The browser is [Browser Use](https://browser-use.com), the actions are [Stagehand](https://stagehand.dev), and the model runs through any provider Stagehand supports.

No local Chrome. No Playwright grid. No per-seat SaaS.

## Up in five minutes

You need Docker, a Browser Use API key and profile ID, and a model key: OpenAI, Anthropic, Google, Groq, Cerebras, xAI, Mistral, DeepSeek, Together AI, Perplexity, or any OpenAI-compatible endpoint such as OpenCode Go.

```bash
git clone https://github.com/marticols/secondhand.git
cd secondhand
cp .env.example .env   # fill in the keys
docker compose up -d --build
docker compose logs -f # wait for: listening on http://0.0.0.0:3900/mcp
```

Endpoint: `http://localhost:3900/mcp`

```bash
curl -s http://localhost:3900/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

The `initialize` result should name `secondhand`.

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

Anything that reads `mcpServers` (Cursor, Windsurf):

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

## Models

`STAGEHAND_MODEL_NAME` takes Stagehand's `<provider>/<model>` form. The provider picks the key:

| Provider | Env var | Example model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-5` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-6` |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` | `google/gemini-2.5-flash` |
| Groq | `GROQ_API_KEY` | `groq/llama-3.3-70b-versatile` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras/llama-3.3-70b` |
| xAI | `XAI_API_KEY` | `xai/grok-4` |
| Mistral | `MISTRAL_API_KEY` | `mistral/mistral-large-latest` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/deepseek-chat` |
| Together AI | `TOGETHER_API_KEY` | `togetherai/meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Perplexity | `PERPLEXITY_API_KEY` | `perplexity/sonar` |

`STAGEHAND_API_KEY` overrides the provider key, and `STAGEHAND_BASE_URL` points any OpenAI-compatible provider at a custom endpoint. `STAGEHAND_HEADERS` takes a JSON object of extra headers; `{{sessionId}}` becomes a fresh UUID per browser session.

OpenCode Go is configured like any other OpenAI-compatible endpoint:

```bash
STAGEHAND_MODEL_NAME=openai/deepseek-v4.1-flash
STAGEHAND_API_KEY=oc_your-key-here
STAGEHAND_BASE_URL=https://opencode.ai/zen/go/v1
STAGEHAND_HEADERS={"x-opencode-session":"{{sessionId}}"}
```

## Configuration

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `STAGEHAND_MODEL_NAME` | yes | — | Provider/model Stagehand calls. |
| `STAGEHAND_API_KEY` | one key | — | Key for any provider; overrides the provider-specific vars below. |
| `STAGEHAND_BASE_URL` | no | provider default | Custom endpoint for an OpenAI-compatible provider. |
| `STAGEHAND_HEADERS` | no | — | JSON object of extra headers; `{{sessionId}}` becomes a per-session UUID. |
| `OPENAI_API_KEY` | OpenAI | — | OpenAI key. |
| `ANTHROPIC_API_KEY` | Anthropic | — | Anthropic key. |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` | Google | — | Google key. |
| `GROQ_API_KEY` | Groq | — | Groq key. |
| `CEREBRAS_API_KEY` | Cerebras | — | Cerebras key. |
| `XAI_API_KEY` | xAI | — | xAI key. |
| `MISTRAL_API_KEY` | Mistral | — | Mistral key. |
| `DEEPSEEK_API_KEY` | DeepSeek | — | DeepSeek key. |
| `TOGETHER_API_KEY` | Together AI | — | Together AI key. |
| `PERPLEXITY_API_KEY` | Perplexity | — | Perplexity key. |
| `BROWSER_USE_API_KEY` | yes | — | Browser Use API key. |
| `BROWSER_USE_PROFILE_ID` | yes | — | Browser Use profile. Keeps cookies and logins. |
| `MCP_HTTP_PORT` | no | `3000` | HTTP port. The example `.env` uses `3900`. |
| `MCP_CALL_TIMEOUT_MS` | no | `120000` | Hard deadline per tool call. |
| `FILES_DIR` | no | `./files` | Upload root for `upload_file`. Docker mounts it at `/app/files`. |
| `LLM_MAX_MS` | no | `90000` | Stagehand's own extract deadline. |

## Limits

- One operation per session at a time. Calls are queued, not parallel.
- Sessions live in memory. Restarting the server drops them.
- Browser Use bills by session. Call `close_session`.
- `/mcp` has no authentication. Keep it on localhost or put it behind a proxy.

## Extending it

Every capability is one `server.tool(...)` call in `src/tools.ts`; every setting is in `src/config.ts`. Fork the repo, ask your coding agent for a tool ("add a `screenshot` tool that saves a PNG under `files/`"), then run `npm run typecheck`. The dev container watches `src/` and reloads on save. No test suite: typecheck is the gate.

`FILES_DIR` sets the upload root (default `./files`). In Docker the host folder is mounted at `/app/files`; `upload_file` base64-encodes files into the remote page's file input, so the remote browser never needs your disk. The `stagehand-cache` volume keeps Stagehand's cache warm across restarts.

Without Docker:

```bash
npm install
cp .env.example .env
npm run dev
```

## License

MIT. Not affiliated with Browserbase or Browser Use.
