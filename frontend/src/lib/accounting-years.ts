// Years offered by the accounting year menu.
//
// Enumerated from a constant rather than derived from the loads themselves,
// because the sidebar renders on every page and must not pull 6k rows just to
// populate a menu. The list grows on its own each January and never drops an
// older year, so no data becomes unreachable.
//
// 2024 is the earliest delivery_date in the data (51 loads).
export const ACCOUNTING_FIRST_YEAR = 2024

export function accountingYears(now: Date = new Date()): number[] {
  const current = now.getFullYear()
  const first = Math.min(ACCOUNTING_FIRST_YEAR, current)
  const years: number[] = []
  for (let y = current; y >= first; y--) years.push(y)
  return years
}
