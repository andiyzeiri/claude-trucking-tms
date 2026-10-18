'use client'

// The Payroll page's numbers - every driver's pay, week by week - shared with
// Reports so both pages always show the same gross, deductions and net pay.
import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useDrivers } from '@/hooks/use-drivers'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { usePayrollOverrides } from '@/hooks/use-payroll-overrides'
import { useDriverPayrollSettings, useDriverRateVersions, type PayStructure } from '@/hooks/use-driver-payroll-settings'
import { usePayrollLayout, type PayrollRow } from '@/hooks/use-payroll-layout'
import { useDriverDebts } from '@/hooks/use-driver-debts'
import { useEldConnection, useEldMileage } from '@/hooks/use-eld'

// Generate 52 weeks for a given year using ISO week numbering
export function generateWeeks(year: number) {
  const weeks = []

  // Find the Monday of week 1 for the given year
  // January 4th is always in week 1 of its year
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum + 1)

  for (let i = 0; i < 52; i++) {
    const weekStart = new Date(week1Monday)
    weekStart.setUTCDate(week1Monday.getUTCDate() + (i * 7))

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6) // Sunday

    const weekNumber = i + 1

    weeks.push({
      weekNumber,
      year,
      startDate: new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()),
      endDate: new Date(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate()),
      label: `Week ${weekNumber} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })})`
    })
  }

  return weeks
}

export type Week = ReturnType<typeof generateWeeks>[number]

// The table is split by driver type, each with its own rows; anything not
// marked owner_operator or company_owner is treated as a company driver.
export type DriverTab = 'company' | 'owner_operator' | 'company_owner'
export const TABS: { key: DriverTab; label: string; noun: string; short: string }[] = [
  { key: 'company', label: 'Company Drivers', noun: 'company drivers', short: 'Company' },
  { key: 'owner_operator', label: 'Owner Operators', noun: 'owner operators', short: 'Owner op' },
  { key: 'company_owner', label: 'Company Owners', noun: 'company owners', short: 'Co. owner' },
]
export const TAB_BY_KEY = Object.fromEntries(TABS.map(t => [t.key, t])) as Record<DriverTab, (typeof TABS)[number]>
export const tabOf = (driverType: string): DriverTab =>
  driverType === 'owner_operator' || driverType === 'company_owner' ? driverType : 'company'

// One driver's pay for one week: a value per row key (hidden rows included,
// so stats can still show miles), and net pay from the visible rows only.
// pay: company drivers with a Pay Structure. Their Net Pay (check_amount) is
// just the driver's pay under the chosen structure; `nets` is the pay under
// each structure, `set` says which have a rate, and company_net is Gross minus
// every deduction minus that pay.
export type WeekCell = {
  values: Record<string, number>
  check_amount: number
  // Fixed deductions in a week with no gross: nothing to pay them from, so they
  // went to the driver's debt (Debt tab). Net Pay is 0 that week.
  to_debt?: number
  pay?: { structure: PayStructure; nets: Record<PayStructure, number>; set: Record<PayStructure, boolean>; company_net: number }
}

export const PAY_STRUCTURES: PayStructure[] = ['fixed', 'per_mile', 'percent']
export const PAY_LABEL: Record<PayStructure, string> = { fixed: 'Fixed', per_mile: 'Per mile', percent: 'Percentage' }

// Short description of a driver's pay structure for the Pay Structure row.
export function payStructureText(s: any): string | null {
  if (!s?.pay_structure) return null
  if (s.pay_structure === 'fixed') return `Fixed ${formatCurrency(Number(s.pay_fixed) || 0)}`
  if (s.pay_structure === 'per_mile') return `$${(Number(s.pay_per_mile) || 0).toFixed(3).replace(/0$/, '')} / mile`
  return `${Number(s.pay_percent) || 0}% of gross`
}

export interface DriverPayrollData {
  driver_id: number
  driver_name: string
  driver_type: string
  truck_id?: number | null
  weeks: Record<number, WeekCell>
}

// One week at a time, picked from the dropdown. Defaults to this week when
// looking at the current year, else week 1.
export const currentWeekNumber = (ws: Week[]) => {
  const today = new Date()
  const end = (w: Week) => new Date(w.endDate.getFullYear(), w.endDate.getMonth(), w.endDate.getDate(), 23, 59, 59)
  return ws.find(w => today >= w.startDate && today <= end(w))?.weekNumber
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Payroll for `selectedYear`. Total Miles (Peak ELD) is read for
 * `selectedWeek` only, and only when `eldEnabled`.
 */
export function usePayrollModel(selectedYear: number, selectedWeek: number, eldEnabled: boolean) {
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: calculatedPayroll, isLoading: payrollLoading, refetch: refetchPayroll } = useCalculatedPayroll(selectedYear)
  const { data: payrollOverrides } = usePayrollOverrides(selectedYear)
  const { data: driverSettings } = useDriverPayrollSettings()
  const { data: rateVersions } = useDriverRateVersions()
  // Each driver type has its own rows.
  const { data: companyRows, isLoading: companyLayoutLoading } = usePayrollLayout('company')
  const { data: ownerRows, isLoading: ownerLayoutLoading } = usePayrollLayout('owner_operator')
  const { data: coOwnerRows, isLoading: coOwnerLayoutLoading } = usePayrollLayout('company_owner')
  const layoutLoading = companyLayoutLoading || ownerLayoutLoading || coOwnerLayoutLoading
  // Debt Payment row amounts filled from each driver's weekly debt deduction.
  const { data: debts } = useDriverDebts()
  const drivers = driversData?.items || []

  const rowsFor = (tab: DriverTab): PayrollRow[] =>
    (tab === 'company' ? companyRows : tab === 'owner_operator' ? ownerRows : coOwnerRows) || []

  // Build overrides lookup from database
  const overridesMap = useMemo(() => {
    const map: Record<string, number> = {}
    payrollOverrides?.forEach(o => {
      map[`${o.driver_id}_${o.week_number}_${o.field}`] = Number(o.value)
    })
    return map
  }, [payrollOverrides])

  const getOverride = (driverId: number, weekNum: number, field: string): number | undefined =>
    overridesMap[`${driverId}_${weekNum}_${field}`]

  const weeks = useMemo(() => generateWeeks(selectedYear), [selectedYear])

  // Total Miles row: what each truck drove in the selected week, from Peak ELD,
  // keyed by TMS truck (Peak trucks are matched under Reports > Mileage).
  const { data: eldConnection } = useEldConnection()
  const selectedWeekObj = weeks.find(w => w.weekNumber === selectedWeek)
  const { data: eldMileage } = useEldMileage(
    selectedWeekObj ? ymd(selectedWeekObj.startDate) : '',
    selectedWeekObj ? ymd(selectedWeekObj.endDate) : '',
    !!eldConnection?.connected && eldEnabled,
    true,
  )
  // Odometer at the week's last inspection minus its first; Peak's GPS miles
  // only when the truck has no inspections with an odometer that week.
  // A driver's settings with the rates in effect for week `wn` (a changed rate
  // applies from the week it was changed; earlier weeks keep the old one).
  const ratesAt = (driverId: number, wn: number): any => {
    const current = driverSettings?.find((s: any) => s.driver_id === driverId)
    const versions = rateVersions?.[String(driverId)]
    const week = weeks.find(w => w.weekNumber === wn)
    if (!versions?.length || !week) return current
    const end = ymd(week.endDate)
    let found = null
    for (const v of versions) {
      if (v.effective_from <= end) found = v
      else break
    }
    return found ? { ...current, ...found } : current
  }

  const eldMilesByTruck = useMemo(() => {
    const m = new Map<number, { miles: number; how: string }>()
    const when = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
    eldMileage?.vehicles.forEach(v => {
      if (!v.truck_id) return
      const odo = v.odometer_miles != null
      m.set(v.truck_id, {
        miles: odo ? v.odometer_miles! : v.miles,
        how: odo
          ? `Odometer ${v.start_odometer?.toLocaleString()} (${when(v.start_time)}) → ${v.end_odometer?.toLocaleString()} (${when(v.end_time)}), ` +
            (v.odometer_source === 'eld' ? `live ELD odometer, Peak unit ${v.unit}` : `first and last inspection (DVIR) of the week, Peak unit ${v.unit}`)
          : `No inspections with an odometer this week - GPS miles from Peak unit ${v.unit}`,
      })
    })
    return m
  }, [eldMileage])

  // A driver counts for a week if hired on or before its end and not
  // terminated before its start (so they're included in the last week they worked).
  const isDriverEmployedDuringWeek = (driver: any, weekStart: Date, weekEnd: Date): boolean => {
    if (driver.date_hired && new Date(driver.date_hired) > weekEnd) return false
    if (driver.date_terminated && new Date(driver.date_terminated) < weekStart) return false
    return true
  }

  const getDriversForWeek = (weekNumber: number) => {
    const week = weeks.find(w => w.weekNumber === weekNumber)
    if (!week) return drivers
    return drivers.filter(driver => isDriverEmployedDuringWeek(driver, week.startDate, week.endDate))
  }

  // Every driver's pay, week by week, from the calculated payroll (loads, fuel
  // cards, driver settings), the row layout and any per-week edits.
  const payrollData: DriverPayrollData[] = useMemo(() => {
    const settingsMap = new Map<number, any>()
    driverSettings?.forEach((s: any) => settingsMap.set(s.driver_id, s))

    const apiMap = new Map<string, any>()
    if (Array.isArray(calculatedPayroll)) {
      calculatedPayroll.forEach((entry: any) => {
        if (entry && typeof entry.driver_id === 'number' && typeof entry.week_number === 'number') {
          apiMap.set(`${entry.driver_id}_${entry.week_number}`, entry)
        }
      })
    }
    // Driver-weeks with a hand-entered value but no loads still get a column.
    const editedWeeks = new Set<string>()
    payrollOverrides?.forEach(o => {
      if (o.field !== 'truck_id') editedWeeks.add(`${o.driver_id}_${o.week_number}`)
    })

    const valueOf = (row: PayrollRow, driverId: number, weekNumber: number, api: any): number => {
      const ov = getOverride(driverId, weekNumber, row.key)
      if (ov !== undefined) return ov
      if (row.builtin) {
        if (row.key === 'debt_payment') return Number(debts?.schedule?.[`${selectedYear}-${weekNumber}`]?.[String(driverId)]) || 0
        if (row.key === 'total_miles') {
          // Only the week on screen is read from Peak; the truck is that week's pick, else the driver's usual truck.
          if (weekNumber !== selectedWeek) return 0
          const truckId = getOverride(driverId, weekNumber, 'truck_id') ?? settingsMap.get(driverId)?.truck_id
          return truckId ? Math.round(eldMilesByTruck.get(Number(truckId))?.miles || 0) : 0
        }
        if (row.mode === 'auto') return Number(api?.[row.key]) || 0
        if (row.mode === 'fixed') return Number(ratesAt(driverId, weekNumber)?.[`${row.key}_weekly`]) || 0
        return 0 // variable: only what's entered for the week
      }
      return row.mode === 'fixed' ? Number(row.amounts?.[String(driverId)]) || 0 : 0
    }

    return drivers
      .map((driver: any) => {
        const data: DriverPayrollData = {
          driver_id: driver.id,
          driver_name: `${driver.first_name} ${driver.last_name}`,
          driver_type: driver.driver_type || 'company',
          truck_id: settingsMap.get(driver.id)?.truck_id || null,
          weeks: {},
        }
        for (let wn = 1; wn <= 53; wn++) {
          const api = apiMap.get(`${driver.id}_${wn}`)
          const toDebt = Number(debts?.unpaid?.[`${selectedYear}-${wn}`]?.[String(driver.id)]) || 0
          if (!api && !editedWeeks.has(`${driver.id}_${wn}`) && !toDebt) continue
          const values: Record<string, number> = {}
          let check = 0
          let deductions = 0
          const tab = tabOf(driver.driver_type || 'company')
          const tabLayout = rowsFor(tab)
          tabLayout.forEach(row => {
            const v = valueOf(row, driver.id, wn, api)
            values[row.key] = v
            if (row.hidden) return
            if (row.kind === 'earning') check += v
            else if (row.kind === 'deduction') { check -= v; deductions += v }
          })
          // Company drivers with a Pay Structure: Net Pay is the driver's pay -
          // fixed a week, per mile on Trip Miles, or a percentage of Gross - and
          // the company keeps Gross minus every deduction minus that pay.
          const ps = ratesAt(driver.id, wn)
          if (toDebt) {
            data.weeks[wn] = { values, check_amount: 0, to_debt: toDebt }
          } else if (tab === 'company' && ps?.pay_structure) {
            const r2 = (n: number) => Math.round(n * 100) / 100
            const nets: Record<PayStructure, number> = {
              fixed: Number(ps.pay_fixed) || 0,
              per_mile: r2((Number(ps.pay_per_mile) || 0) * (values.miles || 0)),
              percent: r2(((Number(ps.pay_percent) || 0) / 100) * (values.gross || 0)),
            }
            const set = {
              fixed: ps.pay_fixed != null && ps.pay_fixed !== '',
              per_mile: ps.pay_per_mile != null && ps.pay_per_mile !== '',
              percent: ps.pay_percent != null && ps.pay_percent !== '',
            }
            const pay = nets[ps.pay_structure as PayStructure]
            values.driver_pay = pay
            data.weeks[wn] = {
              values, check_amount: pay,
              pay: { structure: ps.pay_structure, nets, set, company_net: r2((values.gross || 0) - deductions - pay) },
            }
          } else {
            data.weeks[wn] = { values, check_amount: check }
          }
        }
        return data
      })
      .sort((a, b) => a.driver_name.localeCompare(b.driver_name))
  }, [drivers, calculatedPayroll, overridesMap, payrollOverrides, driverSettings, companyRows, ownerRows, coOwnerRows, debts, selectedYear, selectedWeek, eldMilesByTruck, rateVersions])

  return {
    drivers, driversLoading, payrollLoading, refetchPayroll, layoutLoading,
    calculatedPayroll, payrollOverrides, driverSettings, rateVersions, debts,
    companyRows, ownerRows, coOwnerRows, rowsFor, getOverride, weeks, selectedWeekObj,
    ratesAt, eldMilesByTruck, getDriversForWeek, payrollData,
  }
}
