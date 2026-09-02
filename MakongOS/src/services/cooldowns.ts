const buckets = new Map<string, number>();

/** Returns true (and starts the cooldown) if the key is not currently on cooldown. */
export function tryConsumeCooldown(key: string, durationMs: number): boolean {
  const now = Date.now();
  const expiresAt = buckets.get(key);
  if (expiresAt && expiresAt > now) return false;
  buckets.set(key, now + durationMs);
  return true;
}

export function remainingCooldownMs(key: string): number {
  const expiresAt = buckets.get(key);
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}
