// Trailing-window helpers. HN (Algolia) filters by exact epoch, so there is no
// bucket mapping — the client passes `created_at_i > sinceEpoch(...)`.
export function sinceEpoch(nowSec: number, windowDays: number): number {
  return nowSec - windowDays * 86400;
}

export function withinWindow(createdUtc: number, windowDays: number, nowSec: number): boolean {
  return createdUtc >= sinceEpoch(nowSec, windowDays);
}
