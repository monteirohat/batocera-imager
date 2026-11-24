// Small helpers around fetch: one User-Agent, timeouts, readable errors.

let userAgent = "BatoceraImager";

/** Called once by main.ts with app.getVersion(). */
export function setAppVersion(version: string): void {
  userAgent = `BatoceraImager/${version}`;
}

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`The server answered ${status} for ${new URL(url).host}.`);
  }

  /** A server error may go away; a client error (404…) won't. */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

/**
 * fetch with our User-Agent and a timeout on the answer's headers only. The
 * body is not limited in time (an image takes minutes): the caller's signal
 * still stops it, and download.ts watches it for stalls.
 */
export async function get(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 20_000, signal, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`no answer within ${timeoutMs / 1000} s`)), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, {
      ...rest,
      headers: { "User-Agent": userAgent, ...(headers as Record<string, string> | undefined) },
      signal: ctrl.signal,
      redirect: "follow",
    });
  } catch (err) {
    signal?.removeEventListener("abort", onAbort);
    if (signal?.aborted) throw signal.reason ?? err;
    throw networkError(url, ctrl.signal.aborted ? ctrl.signal.reason : err);
  } finally {
    clearTimeout(timer);
  }
}

export async function getText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await get(url, { signal });
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }
  return res.text();
}

export function networkError(url: string, err: unknown): Error {
  const host = new URL(url).host;
  const cause = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  const e = new Error(`Could not reach ${host}. Check the internet connection. (${cause})`);
  (e as Error & { network: boolean }).network = true;
  return e;
}
