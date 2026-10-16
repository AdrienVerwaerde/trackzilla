const BaseDelayMs = 1000;
const MaxDelayMs = 30_000;
const JitterRatio = 0.3;

/** 1 s, 2 s, 4 s… capped at 30 s, ±30 % so reconnecting apps do not sync up. */
export function backoffDelay(attempt: number) {
  const base = Math.min(BaseDelayMs * 2 ** attempt, MaxDelayMs);
  const jitter = 1 + (Math.random() * 2 - 1) * JitterRatio;

  return Math.round(base * jitter);
}
