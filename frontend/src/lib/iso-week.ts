// ISO 8601 week helpers.
//
// Weeks run Monday-Sunday and a week belongs to the year containing its
// Thursday, so the boundary weeks straddle new year:
//   - Dec 30, 2024 is in Week 1 of 2025
//   - Dec 29-31, 2025 are in Week 1 of 2026
//
// The algorithm matches the one the loads page uses for its week summary
// bands, so a load lands in the same week number on both pages. Like that
// page these read the date through UTC getters - the API serialises naive
// timestamps (`2025-08-04T00:00:00`) that carry a wall-clock date, not an
// instant, and the UTC getters keep the calendar date intact.

/** Midnight UTC on the given date, with any time component discarded. */
function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** The Thursday of the week containing `date` - ISO's anchor day. */
function isoThursday(date: Date): Date {
  const d = utcMidnight(date)
  const dayNum = d.getUTCDay() || 7 // Sunday counts as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d
}

/** ISO week number, 1-53. */
export function isoWeekNumber(date: Date): number {
  const thursday = isoThursday(date)
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** The year the week belongs to, which is not always the calendar year. */
export function isoWeekYear(date: Date): number {
  return isoThursday(date).getUTCFullYear()
}

/** Monday of the week containing `date`, at midnight UTC. */
export function isoWeekStart(date: Date): Date {
  const d = utcMidnight(date)
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dayNum - 1))
  return d
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Human-readable Monday-Sunday span, collapsing the repeated month when the
 * week sits inside one: `Aug 4-10`, but `Jul 28 - Aug 3` across a boundary.
 */
export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart.getTime())
  end.setUTCDate(end.getUTCDate() + 6)

  const startMonth = MONTH_ABBR[weekStart.getUTCMonth()]
  const endMonth = MONTH_ABBR[end.getUTCMonth()]

  return startMonth === endMonth
    ? `${startMonth} ${weekStart.getUTCDate()}-${end.getUTCDate()}`
    : `${startMonth} ${weekStart.getUTCDate()} - ${endMonth} ${end.getUTCDate()}`
}
