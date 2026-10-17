import { config } from "./config.ts";

let rejectShutdown: ((err: Error) => void) | undefined;

/**
 * Rejected once the server starts shutting down. Racing pending tool calls against
 * it means an in-flight request gets an error response instead of hanging forever
 * when the process is replaced (`node --watch` restarts on every file edit).
 */
const shutdownSignal = new Promise<never>((_, reject) => {
  rejectShutdown = reject;
});
shutdownSignal.catch(() => {}); // handled per-race below; keep the process quiet

export function beginShutdown(reason: string): void {
  rejectShutdown?.(new Error(reason));
  rejectShutdown = undefined;
}

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not finish within ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Runs `fn`, rejecting when it stalls past `timeoutMs` or the server shuts down.
 *
 * Stagehand gives its `act`/`observe` model calls no timeout of their own, so a
 * stalled model response would otherwise keep the tool call — and the client —
 * waiting forever. This is the only bound that guarantees a call returns.
 */
export async function withDeadline<T>(
  fn: () => Promise<T>,
  label: string,
  timeoutMs: number = config.callTimeoutMs,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), deadline, shutdownSignal]);
  } finally {
    clearTimeout(timer);
  }
}
