import { config } from "./config.ts";

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not finish within ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Runs `fn`, rejecting when it stalls past `timeoutMs`.
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
    return await Promise.race([fn(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
