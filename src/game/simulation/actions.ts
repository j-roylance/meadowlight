import { WINDOW_MS, type EconomyState } from "@/game/types";

/**
 * Authoritative action-window reset.
 * Unused actions are discarded; allowance is replaced with 2 — never added.
 */
export function settleActionWindow(
  economy: EconomyState,
  now: number
): EconomyState {
  const effective = Math.max(now, economy.lastSettledAt);
  const elapsed = effective - economy.actionWindowStartAt;
  if (elapsed < 0) return { ...economy };

  const elapsedWindows = Math.floor(elapsed / WINDOW_MS);
  if (elapsedWindows <= 0) return { ...economy };

  return {
    ...economy,
    actionsRemaining: 2,
    actionWindowStartAt:
      economy.actionWindowStartAt + elapsedWindows * WINDOW_MS,
  };
}

export function canSpendAction(economy: EconomyState): boolean {
  return economy.actionsRemaining > 0;
}

export function spendAction(economy: EconomyState): EconomyState {
  if (economy.actionsRemaining <= 0) {
    throw new Error("No actions remaining");
  }
  return {
    ...economy,
    actionsRemaining: (economy.actionsRemaining - 1) as 0 | 1 | 2,
  };
}

export function msUntilNextWindow(economy: EconomyState, now: number): number {
  const settled = settleActionWindow(economy, now);
  const next = settled.actionWindowStartAt + WINDOW_MS;
  return Math.max(0, next - now);
}

export function formatDuration(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}
