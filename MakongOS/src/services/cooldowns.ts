const buckets = new Map<string, number>();

/**
 * Returns true and records a hit if `key` is off cooldown; otherwise returns
 * false. Used for command cooldowns, XP gain, AI per-user/per-channel
 * throttling, and anti-spam pacing — all share the same tiny primitive.
 */
export function consumeCooldown(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = buckets.get(key);
  if (last && now - last < windowMs) {
    return false;
  }
  buckets.set(key, now);
  return true;
}

export function remainingCooldownMs(key: string, windowMs: number): number {
  const last = buckets.get(key);
  if (!last) return 0;
  const remaining = windowMs - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of buckets) {
    if (now - ts > 1000 * 60 * 60) buckets.delete(key);
  }
}, 1000 * 60 * 10).unref();
