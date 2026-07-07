// One door to the Overpass API. The public instance allots a couple of
// slots per client and sheds excess with 429s (and 504s under load), so
// queries run strictly one at a time through a module-wide queue and a
// rejected attempt waits out a growing backoff before trying again.

const OVERPASS = "https://overpass-api.de/api/interpreter";
const RETRYABLE = new Set([429, 502, 503, 504]);
const ATTEMPTS = 3;
const BACKOFF_MS = [3000, 8000];

const rest = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("aborted"));
      },
      { once: true },
    );
  });

const attemptQuery = async <Body>(query: string, signal: AbortSignal) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      signal,
    });
    if (res.ok) return (await res.json()) as Body;
    if (attempt >= ATTEMPTS || !RETRYABLE.has(res.status)) {
      throw new Error(`overpass responded ${res.status}`);
    }
    await rest(BACKOFF_MS[attempt - 1] ?? 8000, signal);
  }
};

let turnstile: Promise<unknown> = Promise.resolve();

export const overpassQuery = <Body>(query: string, signal: AbortSignal) => {
  // A waiting query runs whether its predecessor settled or failed; the
  // predecessor's error still reaches its own caller through `run`.
  const run = turnstile.then(
    () => attemptQuery<Body>(query, signal),
    () => attemptQuery<Body>(query, signal),
  );
  // Only sequencing: the rejection is the caller's to handle via `run`.
  turnstile = run.catch(() => undefined);
  return run;
};
