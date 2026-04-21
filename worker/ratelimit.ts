/**
 * Tiny in-memory token bucket per Telegram user. Survives only within one Worker
 * isolate, which is enough to absorb floods (Telegram itself caps inbound rates).
 * Replace with KV/DO if you need cross-isolate accuracy.
 */
const buckets = new Map<number, { tokens: number; updated: number }>();
const CAPACITY = 20;
const REFILL_PER_SEC = 1;

export function allow(user_id: number): boolean {
  const now = Date.now();
  const b = buckets.get(user_id) ?? { tokens: CAPACITY, updated: now };
  const delta = (now - b.updated) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + delta * REFILL_PER_SEC);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(user_id, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(user_id, b);
  return true;
}
