/**
 * Pure reminder rules (no native deps) so they can be unit-tested.
 */

/** Nudge if no fuel entry was logged for this many days. */
export const FUEL_NUDGE_AFTER_DAYS = 14;
/** Do not repeat the same notification more often than this. */
export const DEFAULT_COOLDOWN_DAYS = 1;
export const FUEL_NUDGE_COOLDOWN_DAYS = 7;

/**
 * @param daysSinceLastFill days since last fuel entry, or null if none logged
 * @returns true if a "log your fuel" nudge should be sent
 */
export function shouldSendFuelNudge(daysSinceLastFill: number | null): boolean {
  // No entries at all → don't nag brand-new users
  if (daysSinceLastFill === null) return false;
  return daysSinceLastFill >= FUEL_NUDGE_AFTER_DAYS;
}

/**
 * Decides whether a notification is still in cooldown.
 * @param lastSentMs epoch ms of last send (undefined if never)
 */
export function isInCooldown(
  lastSentMs: number | undefined,
  nowMs: number,
  cooldownDays: number
): boolean {
  if (lastSentMs === undefined) return false;
  return nowMs - lastSentMs < cooldownDays * 24 * 60 * 60 * 1000;
}
