/** Exponential backoff with jitter: ~1s, 2s, 4s... capped at 30s. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base * (0.5 + random() * 0.5));
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
