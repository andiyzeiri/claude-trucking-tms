// Statistics for Reports > Overview and Weekly, built from the Payroll page's
// own numbers (usePayrollModel) so gross, pay and deductions always match it.
import { formatCurrency } from '@/lib/utils'
import type { PayrollRow } from '@/hooks/use-payroll-layout'
import { tabOf, type DriverPayrollData, type DriverTab } from '@/hooks/use-payroll-model'

export interface Stat {
  gross: number
  loads: number
  loadedMiles: number // trip miles on the loads
  totalMiles: number // ELD miles (0 = not known)
  // Loaded miles / gallons of the driver-weeks whose ELD miles are known, so
  // deadhead and MPG only compare like with like.
  trackedLoadedMiles: number
  trackedGallons: number
  gallons: number
  fuel: number
  driverPay: number
  costs: Record<string, number> // each payroll deduction row except fuel
  totalCosts: number
  profit: number
}

export const emptyStat = (): Stat => ({
  gross: 0, loads: 0, loadedMiles: 0, totalMiles: 0, trackedLoadedMiles: 0, trackedGallons: 0,
  gallons: 0, fuel: 0, driverPay: 0, costs: {}, totalCosts: 0, profit: 0,
})

export function addStat(into: Stat, s: Stat): Stat {
  into.gross += s.gross
  into.loads += s.loads
  into.loadedMiles += s.loadedMiles
  into.totalMiles += s.totalMiles
  into.trackedLoadedMiles += s.trackedLoadedMiles
  into.trackedGallons += s.trackedGallons
  into.gallons += s.gallons
  into.fuel += s.fuel
  into.driverPay += s.driverPay
  into.totalCosts += s.totalCosts
  into.profit += s.profit
  Object.entries(s.costs).forEach(([k, v]) => { into.costs[k] = (into.costs[k] || 0) + v })
  return into
}

/** Payroll's API entry for a driver-week: loads and diesel gallons. */
export type PayrollEntry = { load_count?: number; gallons?: number; truck_id?: number | null }

/**
 * One driver's week. Profit by driver type:
 *  - company driver: what the company keeps - gross minus every deduction
 *    minus the driver's pay (Payroll's "Company net" with a Pay Structure)
 *  - owner operator: the dispatch fee (the company's income on that truck)
 *  - company owner: net pay - what is left of gross after the truck's costs
 * Total costs: deductions plus driver pay for company drivers; the truck's
 * deductions (less the dispatch fee, which is income) for the others.
 */
export function cellStat(d: DriverPayrollData, wn: number, rows: PayrollRow[], entry: PayrollEntry | undefined, eldMiles?: number): Stat | null {
  const cell = d.weeks[wn]
  if (!cell) return null
  const tab = tabOf(d.driver_type)
  const v = cell.values
  const shown = rows.filter(r => !r.hidden)
  const sum = (rs: PayrollRow[]) => rs.reduce((t, r) => t + (v[r.key] || 0), 0)
  const deductionRows = shown.filter(r => r.kind === 'deduction')
  const earnings = sum(shown.filter(r => r.kind === 'earning'))
  const deductions = sum(deductionRows)
  const dispatch = tab === 'owner_operator' && deductionRows.some(r => r.key === 'dispatch_fee') ? v.dispatch_fee || 0 : 0

  const driverPay = tab === 'company_owner' ? 0 : cell.check_amount
  const profit =
    tab === 'company' ? (cell.pay ? cell.pay.company_net : earnings - deductions - cell.check_amount)
      : tab === 'owner_operator' ? dispatch
        : cell.check_amount
  const totalCosts = tab === 'company' ? deductions + driverPay : deductions - dispatch

  const costs: Record<string, number> = {}
  deductionRows.forEach(r => { if (r.key !== 'fuel') costs[r.key] = v[r.key] || 0 })
  const totalMiles = Math.max(0, eldMiles ?? v.total_miles ?? 0)
  const gallons = Number(entry?.gallons) || 0
  return {
    gross: v.gross || 0,
    loads: Number(entry?.load_count) || 0,
    loadedMiles: v.miles || 0,
    totalMiles,
    trackedLoadedMiles: totalMiles ? v.miles || 0 : 0,
    trackedGallons: totalMiles ? gallons : 0,
    gallons,
    fuel: v.fuel || 0,
    driverPay,
    costs,
    totalCosts,
    profit,
  }
}

// --- derived figures (null = not enough data) ---
const div = (a: number, b: number) => (b ? a / b : null)
export const milesFor = (s: Stat) => s.totalMiles || s.loadedMiles // per-mile figures: ELD miles when known
export const derived = (s: Stat) => ({
  avgPerLoad: div(s.gross, s.loads),
  rpm: div(s.gross, s.loadedMiles),
  rpmAll: div(s.gross, s.totalMiles),
  deadhead: s.totalMiles ? Math.max(0, s.totalMiles - s.trackedLoadedMiles) : null,
  deadheadPct: s.totalMiles ? Math.max(0, s.totalMiles - s.trackedLoadedMiles) / s.totalMiles : null,
  mpg: s.totalMiles && s.trackedGallons ? s.totalMiles / s.trackedGallons : null,
  fuelPerMile: div(s.fuel, milesFor(s)),
  costPerMile: div(s.totalCosts, milesFor(s)),
  profitPerMile: div(s.profit, milesFor(s)),
  margin: div(s.profit, s.gross),
})

// --- formatting ---
export const money = (n: number | null) => (n == null ? '—' : n < 0 ? `(${formatCurrency(-n)})` : formatCurrency(n))
export const perMile = (n: number | null) => (n == null ? '—' : `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`)
export const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)
export const num = (n: number | null, digits = 0) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const PROFIT_LABEL: Record<DriverTab, string> = {
  company: 'Company profit',
  owner_operator: 'Dispatch income',
  company_owner: 'Owner net',
}
export const PROFIT_HELP: Record<DriverTab, string> = {
  company: "Gross minus every deduction minus the driver's pay",
  owner_operator: "The dispatch fee - the company's income on owner-operator trucks",
  company_owner: "Net pay: what is left of gross after the truck's costs",
}
export const PAY_LABEL_BY_TAB: Record<DriverTab, string> = {
  company: 'Driver pay',
  owner_operator: 'Settlement (net pay)',
  company_owner: 'Driver pay',
}
