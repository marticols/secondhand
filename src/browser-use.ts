import { config } from "./config.ts";

const { apiUrl, apiKey, profileId } = config.browserUse;

export interface BrowserUseSession {
  id: string;
  cdpUrl: string;
  liveUrl?: string | null;
  timeoutAt?: string | null;
}

export async function browserUse(path: string, init: RequestInit = {}): Promise<any> {
  if (!apiKey) throw new Error("BROWSER_USE_API_KEY is not set");
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "X-Browser-Use-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`Browser Use ${init.method || "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function createBrowserSession(): Promise<BrowserUseSession> {
  if (!profileId) throw new Error("BROWSER_USE_PROFILE_ID is not set");
  const session: BrowserUseSession = await browserUse("/browsers", {
    method: "POST",
    body: JSON.stringify({ profileId, proxyCountryCode: null }),
  });
  if (!session.id || !session.cdpUrl) throw new Error("Browser Use did not return id + cdpUrl");
  console.error(`[browser-use] session ${session.id} up (profile ${profileId})`);
  return session;
}

export async function stopBrowserSession(id: string): Promise<void> {
  try {
    await browserUse(`/browsers/${id}`, { method: "PATCH", body: JSON.stringify({ action: "stop" }) });
    console.error(`[browser-use] session ${id} stopped`);
  } catch (err) {
    console.error(`[browser-use] failed to stop session ${id}:`, (err as Error).message);
  }
}

export async function resolveCdpUrl(raw: string): Promise<string> {
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;

  const base = raw.replace(/\/+$/, "");
  const endpoint = new URL(base);
  const res = await fetch(`${base}/json/version`);
  if (!res.ok) throw new Error(`CDP ${base}/json/version -> ${res.status}`);
  const { webSocketDebuggerUrl } = (await res.json()) as { webSocketDebuggerUrl?: string };
  if (!webSocketDebuggerUrl) throw new Error(`No webSocketDebuggerUrl from ${base}`);

  const ws = new URL(webSocketDebuggerUrl);
  ws.host = endpoint.host;
  ws.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
  return ws.toString();
}
