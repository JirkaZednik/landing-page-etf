/** Event a fund card sends when the visitor wants its group in the fee calculator. */
export const CALC_GROUP_EVENT = 'ix:calc-group';

declare global {
  interface Window { __ixPendingCalcGroup?: string }
}

/**
 * Asks the calculator to show `groupId`. The calculator island is `client:visible` and usually
 * hydrates only after the click scrolled it into view, so the choice is also kept as pending
 * and read once on mount (the event alone would be lost).
 */
export function requestCalcGroup(groupId: string): void {
  window.__ixPendingCalcGroup = groupId;
  window.dispatchEvent(new CustomEvent(CALC_GROUP_EVENT, { detail: groupId }));
}

/** Returns and clears the pending choice (each request is applied once). */
export function takePendingCalcGroup(): string | undefined {
  const g = window.__ixPendingCalcGroup;
  delete window.__ixPendingCalcGroup;
  return g;
}
