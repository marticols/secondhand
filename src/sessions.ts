import { Stagehand } from "@browserbasehq/stagehand";
import { createBrowserSession, resolveCdpUrl, stopBrowserSession } from "./browser-use.ts";
import { stagehandModel } from "./config.ts";

export interface Session {
  id: string;
  liveUrl: string | null;
  stagehand: Stagehand;
  /** Serializes work on a session: Stagehand is not safe to drive concurrently. */
  queue: Promise<unknown>;
}

const sessions = new Map<string, Session>();

export function lastPage(stagehand: Stagehand) {
  const pages = stagehand.context.pages();
  if (!pages || pages.length === 0) throw new Error("No page available");
  return pages[pages.length - 1];
}

/**
 * Runs `fn` after any work already queued on the session. Tool calls arrive as
 * independent HTTP requests, so without this two calls could drive the same page
 * at once and deadlock — a hang no timeout would attribute to the right call.
 */
export function runExclusive<T>(session: Session, fn: (session: Session) => Promise<T>): Promise<T> {
  const next = session.queue.then(
    () => fn(session),
    () => fn(session),
  );
  session.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function startSession(): Promise<Session> {
  const { id, cdpUrl, liveUrl } = await createBrowserSession();
  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: { cdpUrl: await resolveCdpUrl(cdpUrl) },
    model: stagehandModel(),
    // Persisted by the stagehand-cache Docker volume at /app/.cache.
    cacheDir: ".cache/stagehand",
    verbose: 0,
  });
  try {
    await stagehand.init();
  } catch (err) {
    await stopBrowserSession(id);
    throw err;
  }
  const session: Session = { id, liveUrl: liveUrl ?? null, stagehand, queue: Promise.resolve() };
  sessions.set(id, session);
  console.error(`[stagehand] session ${id} started${liveUrl ? ` (live: ${liveUrl})` : ""}`);
  return session;
}

export function getSession(id: string): Session {
  const session = sessions.get(id);
  if (!session) throw new Error(`Unknown session ${id}`);
  return session;
}

export async function closeSession(id: string): Promise<boolean> {
  const session = sessions.get(id);
  if (!session) return false;
  sessions.delete(id);
  try {
    await session.stagehand.close();
  } catch (err) {
    console.error("[stagehand] close failed:", (err as Error).message);
  }
  await stopBrowserSession(id);
  return true;
}

export async function closeAllSessions(): Promise<void> {
  await Promise.all([...sessions.keys()].map((id) => closeSession(id)));
}
