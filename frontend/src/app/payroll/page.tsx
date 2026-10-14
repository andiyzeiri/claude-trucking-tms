'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, EyeOff, GripVertical, ListChecks, MessageSquare, Plus, RefreshCw, Settings, Trash2, X } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks, pickableTrucks } from '@/hooks/use-trucks'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { usePayrollOverrides, useSavePayrollOverride } from '@/hooks/use-payroll-overrides'
import { useDriverPayrollSettings, useCreateOrUpdateDriverPayrollSettings, useDriverRateVersions, type PayStructure } from '@/hooks/use-driver-payroll-settings'
import { usePayrollLayout, useSavePayrollLayout, useDriverOrder, useSaveDriverOrder, SWITCHABLE_ROWS, type PayrollRow } from '@/hooks/use-payroll-layout'
import { DriverSettingsModal } from '@/components/payroll/driver-settings-modal'
import { DebtView } from '@/components/payroll/debt-view'
import { useDriverDebts } from '@/hooks/use-driver-debts'
import { useEldConnection, useEldMileage } from '@/hooks/use-eld'
import { useCompany } from '@/hooks/use-company'
import api from '@/lib/api'


// Generate 52 weeks for a given year using ISO week numbering
function generateWeeks(year: number) {
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

type Week = ReturnType<typeof generateWeeks>[number]

// The table is split by driver type, each with its own rows; anything not
// marked owner_operator or company_owner is treated as a company driver.
type DriverTab = 'company' | 'owner_operator' | 'company_owner'
const TABS: { key: DriverTab; label: string; noun: string; short: string }[] = [
  { key: 'company', label: 'Company Drivers', noun: 'company drivers', short: 'Company' },
  { key: 'owner_operator', label: 'Owner Operators', noun: 'owner operators', short: 'Owner op' },
  { key: 'company_owner', label: 'Company Owners', noun: 'company owners', short: 'Co. owner' },
]
const TAB_BY_KEY = Object.fromEntries(TABS.map(t => [t.key, t])) as Record<DriverTab, (typeof TABS)[number]>
const tabOf = (driverType: string): DriverTab =>
  driverType === 'owner_operator' || driverType === 'company_owner' ? driverType : 'company'

// One driver's pay for one week: a value per row key (hidden rows included,
// so stats can still show miles), and net pay from the visible rows only.
// pay: company drivers with a Pay Structure. Their Net Pay (check_amount) is
// just the driver's pay under the chosen structure; `nets` is the pay under
// each structure, `set` says which have a rate, and company_net is Gross minus
// every deduction minus that pay.
type WeekCell = {
  values: Record<string, number>
  check_amount: number
  // Fixed deductions in a week with no gross: nothing to pay them from, so they
  // went to the driver's debt (Debt tab). Net Pay is 0 that week.
  to_debt?: number
  pay?: { structure: PayStructure; nets: Record<PayStructure, number>; set: Record<PayStructure, boolean>; company_net: number }
}

const PAY_STRUCTURES: PayStructure[] = ['fixed', 'per_mile', 'percent']
const PAY_LABEL: Record<PayStructure, string> = { fixed: 'Fixed', per_mile: 'Per mile', percent: 'Percentage' }

// Short description of a driver's pay structure for the Pay Structure row.
function payStructureText(s: any): string | null {
  if (!s?.pay_structure) return null
  if (s.pay_structure === 'fixed') return `Fixed ${formatCurrency(Number(s.pay_fixed) || 0)}`
  if (s.pay_structure === 'per_mile') return `$${(Number(s.pay_per_mile) || 0).toFixed(3).replace(/0$/, '')} / mile`
  return `${Number(s.pay_percent) || 0}% of gross`
}

interface DriverPayrollData {
  driver_id: number
  driver_name: string
  driver_type: string
  truck_id?: number | null
  weeks: Record<number, WeekCell>
}

type PayTotals = {
  values: Record<string, number>
  earnings: number
  deductions: number
  check_amount: number
  drivers_paid: number
  company_net: number // company drivers with a Pay Structure: Gross - deductions - their pay
  dispatch_income: number // owner operators' dispatch fee
}

const emptyTotals = (): PayTotals => ({
  values: {}, earnings: 0, deductions: 0, check_amount: 0, drivers_paid: 0, company_net: 0, dispatch_income: 0,
})

type EditingCell = { weekNumber: number; driverId: number; field: string } | null

const MODE_LABEL: Record<PayrollRow['mode'], string> = { auto: 'Auto', fixed: 'Fixed', variable: 'Variable' }
const MODE_HELP: Record<PayrollRow['mode'], string> = {
  auto: 'Calculated from loads and fuel cards',
  fixed: 'Same amount every week, set per driver',
  variable: 'Entered week by week',
}

const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const weekOptionLabel = (w: Week) =>
  `Week ${w.weekNumber} · ${fmtShort(w.startDate)} – ${w.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

// Deduction rows store what's taken out as a positive number (that's how the
// calculated fuel, dispatch, insurance... arrive). On screen every cell is
// signed by its effect on net pay: negative = comes out of pay, positive =
// added to pay. So typing -50 in a deduction row takes out $50 and +50 adds $50.
const signedOf = (row: PayrollRow, stored: number) => (row.kind === 'deduction' ? -stored : stored)
const storedOf = (row: PayrollRow, signed: number) => (row.kind === 'deduction' ? -signed : signed)

// Negative: red in parentheses. Positive: green when typed in for the week,
// plain when calculated (e.g. Gross).
const cellDisplay = (row: PayrollRow, stored: number | undefined, manual: boolean): { text: string; color: string } => {
  const plain = 'var(--monday-text-primary)'
  if (stored === undefined || !stored) return { text: '-', color: plain }
  if (row.kind === 'info') return { text: stored.toLocaleString(), color: plain }
  const v = signedOf(row, stored)
  if (v < 0) return { text: `(${formatCurrency(-v)})`, color: 'var(--monday-stuck)' }
  return { text: formatCurrency(v), color: manual ? 'var(--monday-done)' : plain }
}

export default function PayrollPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: calculatedPayroll, isLoading: payrollLoading, refetch: refetchPayroll } = useCalculatedPayroll(selectedYear)
  const { data: payrollOverrides } = usePayrollOverrides(selectedYear)
  const saveOverride = useSavePayrollOverride()
  const { data: trucksData } = useTrucks()
  const { data: driverSettings } = useDriverPayrollSettings()
  const savePaySettings = useCreateOrUpdateDriverPayrollSettings()
  const { data: rateVersions } = useDriverRateVersions()
  const [payDriverId, setPayDriverId] = useState<number | null>(null) // Pay Structure dialog
  const [statementDriverId, setStatementDriverId] = useState<number | null>(null) // Send Statement dialog
  const { company } = useCompany()
  // Each driver type has its own rows.
  const { data: companyRows, isLoading: companyLayoutLoading } = usePayrollLayout('company')
  const { data: ownerRows, isLoading: ownerLayoutLoading } = usePayrollLayout('owner_operator')
  const { data: coOwnerRows, isLoading: coOwnerLayoutLoading } = usePayrollLayout('company_owner')
  const saveCompanyLayout = useSavePayrollLayout('company')
  const saveOwnerLayout = useSavePayrollLayout('owner_operator')
  const saveCoOwnerLayout = useSavePayrollLayout('company_owner')
  const layoutLoading = companyLayoutLoading || ownerLayoutLoading || coOwnerLayoutLoading
  const drivers = driversData?.items || []
  const trucks = (trucksData?.items || []).filter((t: any) => t.type === 'truck')


  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]
    return years.filter(y => y >= 2024) // Start from 2024
  }, [])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [rowsDialogOpen, setRowsDialogOpen] = useState(false)
  const [amountsRowKey, setAmountsRowKey] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [driverTab, setDriverTab] = useState<DriverTab>('company')
  // Top tabs: a year of payroll, or the Debt tab.
  const [view, setView] = useState<'payroll' | 'debt'>('payroll')
  // Debt Payment row amounts filled from each driver's weekly debt deduction.
  const { data: debts } = useDriverDebts()
  // Driver columns can be dragged into any order; saved per table.
  const { data: driverOrder } = useDriverOrder(driverTab)
  const saveDriverOrder = useSaveDriverOrder(driverTab)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const rowsFor = (tab: DriverTab): PayrollRow[] =>
    (tab === 'company' ? companyRows : tab === 'owner_operator' ? ownerRows : coOwnerRows) || []
  const rows = rowsFor(driverTab) // the table being viewed
  const saveLayout = driverTab === 'company' ? saveCompanyLayout : driverTab === 'owner_operator' ? saveOwnerLayout : saveCoOwnerLayout
  const visibleRows = rows.filter(r => !r.hidden)
  const hiddenRows = rows.filter(r => r.hidden)
  const [newRow, setNewRow] = useState<{ label: string; kind: 'earning' | 'deduction'; mode: 'fixed' | 'variable' } | null>(null)

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

  const isLoading = driversLoading || payrollLoading || layoutLoading

  const weeks = useMemo(() => generateWeeks(selectedYear), [selectedYear])

  // One week at a time, picked from the dropdown. Defaults to this week when
  // looking at the current year, else week 1.
  const currentWeekNumber = (ws: Week[]) => {
    const today = new Date()
    const end = (w: Week) => new Date(w.endDate.getFullYear(), w.endDate.getMonth(), w.endDate.getDate(), 23, 59, 59)
    return ws.find(w => today >= w.startDate && today <= end(w))?.weekNumber
  }
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeekNumber(generateWeeks(new Date().getFullYear())) ?? 1)
  useEffect(() => {
    setSelectedWeek(currentWeekNumber(weeks) ?? 1)
  }, [weeks])

  // Total Miles row: what each truck drove in the selected week, from Peak ELD,
  // keyed by TMS truck (Peak trucks are matched under Reports > Mileage).
  const { data: eldConnection } = useEldConnection()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const selectedWeekObj = weeks.find(w => w.weekNumber === selectedWeek)
  const { data: eldMileage } = useEldMileage(
    selectedWeekObj ? ymd(selectedWeekObj.startDate) : '',
    selectedWeekObj ? ymd(selectedWeekObj.endDate) : '',
    !!eldConnection?.connected && view === 'payroll',
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
  // Hover text for a driver's Total Miles cell.
  const totalMilesSource = (driverId: number): string | undefined => {
    const truckId = getOverride(driverId, selectedWeek, 'truck_id') ?? driverSettings?.find((s: any) => s.driver_id === driverId)?.truck_id
    return truckId ? eldMilesByTruck.get(Number(truckId))?.how : undefined
  }

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

  const addInto = (totals: PayTotals, cell: WeekCell, tab: DriverTab) => {
    rowsFor(tab).forEach(row => {
      const v = cell.values[row.key] || 0
      totals.values[row.key] = (totals.values[row.key] || 0) + v
      if (row.hidden) return
      if (row.kind === 'earning') totals.earnings += v
      else if (row.kind === 'deduction') totals.deductions += v
    })
    totals.check_amount += cell.check_amount
    totals.company_net += cell.pay?.company_net || 0
    if (tab === 'owner_operator' && rowsFor(tab).some(r => r.key === 'dispatch_fee' && !r.hidden)) {
      totals.dispatch_income += cell.values.dispatch_fee || 0
    }
  }

  // Totals for one week (drivers employed that week), optionally for one driver type.
  const getWeekTotals = (weekNumber: number, tab?: DriverTab): PayTotals => {
    const totals = emptyTotals()
    const employedDriverIds = new Set(getDriversForWeek(weekNumber).map(d => d.id))
    payrollData.forEach(d => {
      if (!employedDriverIds.has(d.driver_id)) return
      if (tab && tabOf(d.driver_type) !== tab) return
      const cell = d.weeks[weekNumber]
      if (!cell) return
      addInto(totals, cell, tabOf(d.driver_type))
      if (cell.check_amount !== 0) totals.drivers_paid += 1
    })
    return totals
  }

  // Totals for every week of the selected year, optionally for one driver
  // type. drivers_paid counts distinct drivers paid at least once.
  const getYearTotals = (tab?: DriverTab): PayTotals => {
    const totals = emptyTotals()
    const paid = new Set<number>()
    weeks.forEach(week => {
      const employedDriverIds = new Set(getDriversForWeek(week.weekNumber).map(d => d.id))
      payrollData.forEach(d => {
        if (!employedDriverIds.has(d.driver_id)) return
        if (tab && tabOf(d.driver_type) !== tab) return
        const cell = d.weeks[week.weekNumber]
        if (!cell) return
        addInto(totals, cell, tabOf(d.driver_type))
        if (cell.check_amount !== 0) paid.add(d.driver_id)
      })
    })
    totals.drivers_paid = paid.size
    return totals
  }

  // Stats cards at the top: the selected week and the whole year, each with
  // the split by driver type.
  const stats = useMemo(() => ({
    week: {
      all: getWeekTotals(selectedWeek),
      company: getWeekTotals(selectedWeek, 'company'),
      owner: getWeekTotals(selectedWeek, 'owner_operator'),
      coOwner: getWeekTotals(selectedWeek, 'company_owner'),
    },
    year: {
      all: getYearTotals(),
      company: getYearTotals('company'),
      owner: getYearTotals('owner_operator'),
      coOwner: getYearTotals('company_owner'),
    },
  }), [payrollData, weeks, selectedWeek, drivers, companyRows, ownerRows, coOwnerRows])

  const goToCurrentWeek = () => {
    setView('payroll')
    const thisYear = new Date().getFullYear()
    if (selectedYear !== thisYear) {
      setSelectedYear(thisYear) // the effect above lands on this week
      return
    }
    setSelectedWeek(currentWeekNumber(weeks) ?? 1)
  }

  // --- row layout changes (saved company-wide) ---
  const updateRow = (key: string, patch: Partial<PayrollRow>) =>
    saveLayout.mutate(rows.map(r => (r.key === key ? { ...r, ...patch } : r)))
  const deleteRow = (key: string) => saveLayout.mutate(rows.filter(r => r.key !== key))
  const addRow = async () => {
    if (!newRow || !newRow.label.trim()) return
    const row: PayrollRow = { key: '', label: newRow.label.trim(), kind: newRow.kind, mode: newRow.mode, hidden: false, builtin: false, amounts: {} }
    // Keep Miles last among the items when adding.
    const milesAt = rows.findIndex(r => r.key === 'miles')
    const next = milesAt >= 0 ? [...rows.slice(0, milesAt), row, ...rows.slice(milesAt)] : [...rows, row]
    setNewRow(null)
    const saved = await saveLayout.mutateAsync(next).catch(() => null)
    if (saved && row.mode === 'fixed') {
      const added = saved.find(r => !r.builtin && r.label === row.label && !rows.some(o => o.key === r.key))
      if (added) setAmountsRowKey(added.key) // ask for the weekly amounts right away
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="page-payroll space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="text-gray-600">Weekly driver payroll</p>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 text-gray-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">Loading payroll data...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  const isEditing = (weekNumber: number, driverId: number, field: string) =>
    editingCell?.weekNumber === weekNumber && editingCell?.driverId === driverId && editingCell?.field === field

  const startEdit = (weekNumber: number, driverId: number, field: string, currentValue: number) => {
    setEditingCell({ weekNumber, driverId, field })
    setEditValue(currentValue ? currentValue.toString() : '')
  }

  const stopEdit = () => {
    if (editingCell && editValue !== '') {
      const row = rows.find(r => r.key === editingCell.field)
      const typed = parseFloat(editValue) || 0
      saveOverride.mutate({
        driver_id: editingCell.driverId,
        year: selectedYear,
        week_number: editingCell.weekNumber,
        field: editingCell.field,
        value: row ? storedOf(row, typed) : typed,
      })
    }
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') stopEdit()
    else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }

  const week = weeks.find(w => w.weekNumber === selectedWeek)
  const employedIds = new Set(getDriversForWeek(selectedWeek).map(d => d.id))
  // Saved column order first; drivers not placed yet follow alphabetically.
  const orderIndex = new Map((driverOrder || []).map((id, i) => [id, i]))
  const byColumnOrder = (a: DriverPayrollData, b: DriverPayrollData) =>
    (orderIndex.get(a.driver_id) ?? Infinity) - (orderIndex.get(b.driver_id) ?? Infinity) || a.driver_name.localeCompare(b.driver_name)
  const tabRows = payrollData
    .filter(d => employedIds.has(d.driver_id) && tabOf(d.driver_type) === driverTab)
    .sort(byColumnOrder)

  // Drop the dragged driver in front of `targetId`. Orders every driver of
  // this type, not just this week's, so absent drivers keep their place.
  const moveDriver = (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return
    const all = payrollData.filter(d => tabOf(d.driver_type) === driverTab).sort(byColumnOrder).map(d => d.driver_id)
    const from = all.indexOf(draggedId)
    if (from < 0) return
    all.splice(from, 1)
    const to = all.indexOf(targetId)
    all.splice(to < 0 ? all.length : (from <= to ? to + 1 : to), 0, draggedId)
    saveDriverOrder.mutate(all)
  }
  const tabCount = (tab: DriverTab) => payrollData.filter(d => employedIds.has(d.driver_id) && tabOf(d.driver_type) === tab).length
  const tabNoun = TAB_BY_KEY[driverTab].noun
  const amountsRow = rows.find(r => r.key === amountsRowKey) || null

  // Shared cell styles
  const LABEL_W = 230
  const COL_W = 140
  const border = '1px solid var(--monday-border-light)'
  // A driver's pay statement for the selected week, as a text message: the
  // table's own lines (in table order, as shown there), total deductions and Net Pay.
  const statementText = (d: DriverPayrollData): string => {
    const wk = d.weeks[selectedWeek]
    const day = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const truckId = getOverride(d.driver_id, selectedWeek, 'truck_id') ?? d.truck_id
    const truck = truckId ? trucks.find((t: any) => t.id === Number(truckId))?.truck_number : null
    const lines = [
      company?.name ? `${company.name} - Pay statement` : 'Pay statement',
      d.driver_name + (truck ? ` - Truck ${truck}` : ''),
      selectedWeekObj
        ? `Week ${selectedWeek}: ${day(selectedWeekObj.startDate)} - ${day(selectedWeekObj.endDate)}, ${selectedWeekObj.endDate.getFullYear()}`
        : `Week ${selectedWeek}`,
      '',
    ]
    let deductions = 0
    visibleRows.forEach(row => {
      const v = wk?.values[row.key]
      if (!v) return
      if (row.kind === 'deduction') deductions += v
      lines.push(`${row.label}: ${cellDisplay(row, v, false).text}`)
    })
    if (deductions) lines.push(`Total deductions: (${formatCurrency(deductions)})`)
    if (wk?.pay) {
      const text = payStructureText(ratesAt(d.driver_id, selectedWeek))
      if (text) lines.push(`Your pay: ${text}`)
    }
    if (wk?.to_debt) lines.push(`No gross this week: ${formatCurrency(wk.to_debt)} added to your balance`)
    lines.push('', `NET PAY: ${formatCurrency(wk?.check_amount || 0)}`)
    return lines.join('\n')
  }
  const statementDriver = tabRows.find(d => d.driver_id === statementDriverId) || null

  const stickyLabel: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, width: LABEL_W, minWidth: LABEL_W, borderRight: border, borderBottom: border }
  const cell: React.CSSProperties = { width: COL_W, minWidth: COL_W, borderRight: border, borderBottom: border, fontSize: '13px' }

  return (
    <Layout>
      <div className="page-payroll space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--monday-text-primary)', letterSpacing: '-0.02em' }}>Payroll</h1>
            <p style={{ fontSize: '14px', color: 'var(--monday-text-secondary)', marginTop: '2px' }}>Weekly driver payroll</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setSettingsModalOpen(true)}
              style={{ backgroundColor: 'var(--monday-done)', borderColor: 'var(--monday-done)', color: 'white', fontWeight: 500, fontSize: '13px' }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Driver Settings
            </Button>
            <Button onClick={() => setRowsDialogOpen(true)} variant="outline" style={{ fontSize: '13px', fontWeight: 500 }}>
              <ListChecks className="h-4 w-4 mr-2" />
              Edit Rows
            </Button>
            <Button onClick={() => refetchPayroll()} variant="outline" disabled={payrollLoading} style={{ fontSize: '13px', fontWeight: 500 }}>
              <RefreshCw className={`h-4 w-4 mr-2 ${payrollLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={goToCurrentWeek} variant="outline" style={{ fontSize: '13px', fontWeight: 500 }}>
              Current Week
            </Button>
          </div>
        </div>

        {/* Year Tabs */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => { setSelectedYear(year); setView('payroll') }}
              className="px-4 py-2 text-sm transition-all relative"
              style={{
                color: view === 'payroll' && selectedYear === year ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                borderBottom: view === 'payroll' && selectedYear === year ? '3px solid var(--monday-done)' : '3px solid transparent',
                marginBottom: '-1px',
                fontWeight: view === 'payroll' && selectedYear === year ? 600 : 500,
                fontSize: '14px'
              }}
            >
              {year}
              {year === new Date().getFullYear() && (
                <span style={{ marginLeft: '4px', fontSize: '12px', opacity: 0.7 }}>(Current)</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setView('debt')}
            className="px-4 py-2 text-sm transition-all relative ml-2"
            style={{
              color: view === 'debt' ? 'var(--monday-stuck)' : 'var(--monday-text-secondary)',
              borderBottom: view === 'debt' ? '3px solid var(--monday-stuck)' : '3px solid transparent',
              marginBottom: '-1px',
              fontWeight: view === 'debt' ? 600 : 500,
              fontSize: '14px'
            }}
          >
            Debt
            {(debts?.drivers || []).some(d => Number(d.balance) > 0) && (
              <span style={{ marginLeft: '4px', fontSize: '12px', opacity: 0.7 }}>({(debts?.drivers || []).filter(d => Number(d.balance) > 0).length})</span>
            )}
          </button>
        </div>

        {view === 'debt' ? (
          <DebtView drivers={drivers} />
        ) : (
        <>
        {/* Week picker */}
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Week</span>
          <Button variant="outline" size="sm" aria-label="Previous week" disabled={selectedWeek <= 1} onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
            <SelectTrigger className="w-[300px]" style={{ fontSize: '14px', fontWeight: 500 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[360px]">
              {weeks.map(w => (
                <SelectItem key={w.weekNumber} value={String(w.weekNumber)}>
                  {weekOptionLabel(w)}
                  {w.weekNumber === currentWeekNumber(weeks) ? ' (this week)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" aria-label="Next week" disabled={selectedWeek >= weeks.length} onClick={() => setSelectedWeek(w => Math.min(weeks.length, w + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {drivers.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--monday-text-muted)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--monday-text-primary)', marginBottom: '8px' }}>No Drivers</h2>
              <p style={{ fontSize: '14px', color: 'var(--monday-text-secondary)' }}>Add drivers to start tracking payroll.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Week + year stats */}
            <div className="grid gap-4 lg:grid-cols-2">
              <StatsPanel
                title={`Week ${selectedWeek}`}
                subtitle={week ? `${fmtShort(week.startDate)} – ${week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                {...stats.week}
              />
              <StatsPanel
                title={`${selectedYear}`}
                subtitle={selectedYear === new Date().getFullYear() ? 'Year to date' : 'Full year'}
                {...stats.year}
              />
            </div>

            {/* Driver type tabs */}
            <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)', marginBottom: '-8px' }}>
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDriverTab(key)}
                  className="px-4 py-2 text-sm transition-all"
                  style={{
                    color: driverTab === key ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                    borderBottom: driverTab === key ? '3px solid var(--monday-done)' : '3px solid transparent',
                    marginBottom: '-1px',
                    fontWeight: driverTab === key ? 600 : 500,
                    fontSize: '14px'
                  }}
                >
                  {label}
                  <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.7 }}>({tabCount(key)})</span>
                </button>
              ))}
            </div>

            {/* Payroll table: items down the side, one column per driver */}
            <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                    <th className="px-3 py-2.5 text-left" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-secondary)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>
                      Week {selectedWeek} · {tabRows.length} {tabNoun}
                    </th>
                    {tabRows.map(d => (
                      <th
                        key={d.driver_id}
                        draggable
                        onDragStart={(e) => { setDragging(d.driver_id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(d.driver_id)) }}
                        onDragOver={(e) => { if (dragging !== null) { e.preventDefault(); setDropTarget(d.driver_id) } }}
                        onDragLeave={() => setDropTarget(t => (t === d.driver_id ? null : t))}
                        onDrop={(e) => { e.preventDefault(); if (dragging !== null) moveDriver(dragging, d.driver_id); setDragging(null); setDropTarget(null) }}
                        onDragEnd={() => { setDragging(null); setDropTarget(null) }}
                        className="px-3 py-2.5 text-left cursor-grab active:cursor-grabbing select-none"
                        style={{
                          ...cell, fontWeight: 600, color: 'var(--monday-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          opacity: dragging === d.driver_id ? 0.4 : 1,
                          boxShadow: dropTarget === d.driver_id && dragging !== d.driver_id ? 'inset 3px 0 0 var(--monday-done), inset -3px 0 0 var(--monday-done)' : undefined,
                        }}
                        title={`${d.driver_name} \u2014 drag to move`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <GripVertical className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--monday-text-muted)' }} />
                          {d.driver_name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                        No {tabNoun} this week.
                      </td>
                    </tr>
                  )}

                  {/* Truck */}
                  {tabRows.length > 0 && (
                    <tr>
                      <td className="px-3 py-2" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>Truck</td>
                      {tabRows.map(d => {
                        const weekTruckOverride = getOverride(d.driver_id, selectedWeek, 'truck_id')
                        const isOverridden = weekTruckOverride !== undefined
                        return (
                          <td key={d.driver_id} className="px-3 py-2" style={cell}>
                            <select
                              className="w-full bg-transparent text-sm border-0 p-0 focus:ring-0 cursor-pointer"
                              value={isOverridden ? weekTruckOverride || '' : (d.truck_id || '')}
                              onChange={(e) => saveOverride.mutate({
                                driver_id: d.driver_id,
                                year: selectedYear,
                                week_number: selectedWeek,
                                field: 'truck_id',
                                value: e.target.value ? parseInt(e.target.value) : 0,
                              })}
                            >
                              <option value="">-</option>
                              {pickableTrucks(trucks, isOverridden ? weekTruckOverride : d.truck_id).map((t: any) => (
                                <option key={t.id} value={t.id}>{t.truck_number}</option>
                              ))}
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Pay structure (company drivers): what each driver is paid */}
                  {tabRows.length > 0 && driverTab === 'company' && (
                    <tr>
                      <td className="px-3 py-2" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>Pay Structure</td>
                      {tabRows.map(d => {
                        const text = payStructureText(ratesAt(d.driver_id, selectedWeek))
                        return (
                          <td
                            key={d.driver_id}
                            className="px-3 py-2 cursor-pointer hover:bg-brand/5"
                            style={{ ...cell, color: text ? 'var(--monday-text-primary)' : 'var(--monday-text-muted)' }}
                            onClick={() => setPayDriverId(d.driver_id)}
                            title="Set how this driver is paid"
                          >
                            {text ?? 'Set pay'}
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Line items */}
                  {tabRows.length > 0 && visibleRows.map(row => {
                    return (
                      <tr key={row.key || row.label} className="group">
                        <td className="px-3 py-2" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)' }}>
                          {confirmDelete === row.key ? (
                            <div className="flex items-center gap-2" style={{ fontSize: '12px' }}>
                              <span style={{ color: 'var(--monday-text-primary)' }}>Delete {row.label}?</span>
                              <button className="text-red-600 font-semibold" onClick={() => { deleteRow(row.key); setConfirmDelete(null) }}>Delete</button>
                              <button style={{ color: 'var(--monday-text-secondary)' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="truncate" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>{row.label}</span>
                              <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {row.mode === 'fixed' && (
                                  <button
                                    title="Set weekly amounts"
                                    onClick={() => (row.builtin ? setSettingsModalOpen(true) : setAmountsRowKey(row.key))}
                                    style={{ fontSize: '11px', color: '#0073ea' }}
                                  >
                                    Amounts
                                  </button>
                                )}
                                <button
                                  title={row.builtin ? `Hide ${row.label}` : `Delete ${row.label}`}
                                  aria-label={row.builtin ? `Hide ${row.label}` : `Delete ${row.label}`}
                                  onClick={() => (row.builtin ? updateRow(row.key, { hidden: true }) : setConfirmDelete(row.key))}
                                  className="rounded p-0.5 hover:bg-red-50"
                                >
                                  <X className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </span>
                            </div>
                          )}
                        </td>
                        {tabRows.map(d => {
                          const v = d.weeks[selectedWeek]?.values[row.key]
                          const manual = getOverride(d.driver_id, selectedWeek, row.key) !== undefined
                          const shown = cellDisplay(row, v, manual)
                          return (
                            <td
                              key={d.driver_id}
                              className="px-3 py-2 cursor-pointer hover:bg-brand/5"
                              style={{ ...cell, color: shown.color }}
                              title={row.key === 'total_miles' && !manual ? totalMilesSource(d.driver_id) : undefined}
                              onClick={() => !isEditing(selectedWeek, d.driver_id, row.key) && startEdit(selectedWeek, d.driver_id, row.key, signedOf(row, v || 0))}
                            >
                              {isEditing(selectedWeek, d.driver_id, row.key) ? (
                                <Input type="number" step={row.kind === 'info' ? '1' : '0.01'} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                              ) : (
                                shown.text
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  {/* Add a row */}
                  {tabRows.length > 0 && (
                    <tr>
                      <td className="px-3 py-2" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)' }} colSpan={newRow ? 1 : 1}>
                        {newRow ? (
                          <div className="space-y-1.5">
                            <Input
                              autoFocus
                              placeholder="Row name"
                              value={newRow.label}
                              maxLength={40}
                              onChange={(e) => setNewRow({ ...newRow, label: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') setNewRow(null) }}
                              className="h-7 text-sm"
                            />
                            <div className="flex gap-1">
                              <select className="h-7 flex-1 rounded border text-xs px-1" value={newRow.kind} onChange={(e) => setNewRow({ ...newRow, kind: e.target.value as any })}>
                                <option value="deduction">Deduction</option>
                                <option value="earning">Earning</option>
                              </select>
                              <select className="h-7 flex-1 rounded border text-xs px-1" value={newRow.mode} onChange={(e) => setNewRow({ ...newRow, mode: e.target.value as any })}>
                                <option value="fixed">Fixed</option>
                                <option value="variable">Variable</option>
                              </select>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 flex-1" disabled={!newRow.label.trim()} onClick={addRow}>Add</Button>
                              <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => setNewRow(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1"
                            style={{ fontSize: '13px', color: 'var(--monday-done)', fontWeight: 500 }}
                            onClick={() => setNewRow({ label: '', kind: 'deduction', mode: 'fixed' })}
                          >
                            <Plus className="h-4 w-4" /> Add row
                          </button>
                        )}
                      </td>
                      {tabRows.map(d => <td key={d.driver_id} style={cell}></td>)}
                    </tr>
                  )}

                  {/* Net pay */}
                  {tabRows.length > 0 && (
                    <tr style={{ backgroundColor: 'rgba(44, 160, 28, 0.08)' }}>
                      <td className="px-3 py-2.5" style={{ ...stickyLabel, backgroundColor: '#eef7ec', borderBottom: 'none', fontSize: '12px', fontWeight: 700, color: 'var(--monday-done)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Net Pay
                      </td>
                      {tabRows.map(d => {
                        const wk = d.weeks[selectedWeek]
                        return (
                          <td key={d.driver_id} className="px-3 py-2.5 align-top" style={{ ...cell, borderBottom: 'none', fontWeight: 700, color: 'var(--monday-done)' }}>
                            {wk ? formatCurrency(wk.check_amount) : '-'}
                            {wk?.to_debt ? (
                              <div
                                style={{ fontSize: '11px', fontWeight: 600, color: 'var(--monday-stuck)', marginTop: '3px' }}
                                title="No gross this week, so the fixed deductions were added to this driver's debt (Debt tab). Type 0 in a cell to waive it."
                              >
                                ({formatCurrency(wk.to_debt)}) to debt
                              </div>
                            ) : null}
                            {/* What net pay would be under the other pay structures */}
                            {wk?.pay && (
                              <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--monday-text-muted)', marginTop: '3px', lineHeight: '15px' }}>
                                {PAY_STRUCTURES.filter(k => k !== wk.pay!.structure).map(k => (
                                  <div key={k}>
                                    {PAY_LABEL[k]}: {wk.pay!.set[k] ? formatCurrency(wk.pay!.nets[k]) : 'no rate'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Company drivers with a Pay Structure: Gross - all deductions - Net Pay */}
                  {tabRows.length > 0 && driverTab === 'company' && tabRows.some(d => d.weeks[selectedWeek]?.pay) && (
                    <tr>
                      <td
                        className="px-3 py-2.5"
                        style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)', fontSize: '12px', fontWeight: 700, color: 'var(--monday-text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                        title="Gross minus every deduction minus the driver's Net Pay"
                      >
                        Company Net
                      </td>
                      {tabRows.map(d => {
                        const pay = d.weeks[selectedWeek]?.pay
                        const v = pay?.company_net
                        return (
                          <td key={d.driver_id} className="px-3 py-2.5" style={{ ...cell, fontWeight: 700, color: v === undefined ? 'var(--monday-text-muted)' : v < 0 ? 'var(--monday-stuck)' : 'var(--monday-text-primary)' }}>
                            {v === undefined ? '-' : v < 0 ? `(${formatCurrency(-v)})` : formatCurrency(v)}
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Send Statement: text the driver this week's statement */}
                  {tabRows.length > 0 && (
                    <tr>
                      <td className="px-3 py-2" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>Statement</td>
                      {tabRows.map(d => (
                        <td key={d.driver_id} className="px-3 py-2" style={cell}>
                          {d.weeks[selectedWeek] ? (
                            <button
                              onClick={() => setStatementDriverId(d.driver_id)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-brand/5"
                              style={{ fontSize: '12px', fontWeight: 500, color: '#0073ea', border: '1px solid #0073ea' }}
                              title={`Text ${d.driver_name} this week's pay statement`}
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Send Statement
                            </button>
                          ) : (
                            <span style={{ color: 'var(--monday-text-muted)' }}>-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hiddenRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
                <EyeOff className="h-3.5 w-3.5" />
                Hidden (not counted in net pay):
                {hiddenRows.map(r => (
                  <button
                    key={r.key}
                    onClick={() => updateRow(r.key, { hidden: false })}
                    className="rounded-full px-2 py-0.5 hover:underline"
                    style={{ backgroundColor: 'var(--monday-bg-secondary)', color: 'var(--monday-text-primary)' }}
                    title={`Show ${r.label} again`}
                  >
                    {r.label} +
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}

        <DriverSettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
        <RowsDialog
          open={rowsDialogOpen}
          title={TAB_BY_KEY[driverTab].label}
          rows={rows}
          onClose={() => setRowsDialogOpen(false)}
          onSave={(next) => { saveLayout.mutate(next); setRowsDialogOpen(false) }}
          onAmounts={(key) => { setRowsDialogOpen(false); setAmountsRowKey(key) }}
          onDriverSettings={() => { setRowsDialogOpen(false); setSettingsModalOpen(true) }}
        />
        <PayStructureDialog
          driver={drivers.find((d: any) => d.id === payDriverId) || null}
          settings={driverSettings?.find((s: any) => s.driver_id === payDriverId)}
          saving={savePaySettings.isPending}
          onClose={() => setPayDriverId(null)}
          onSave={(data) => payDriverId && savePaySettings.mutate({ driver_id: payDriverId, ...data }, { onSuccess: () => setPayDriverId(null) })}
        />
        <StatementDialog
          driver={statementDriver}
          phone={drivers.find((x: any) => x.id === statementDriverId)?.phone}
          text={statementDriver ? statementText(statementDriver) : ''}
          onClose={() => setStatementDriverId(null)}
        />
        <AmountsDialog
          row={amountsRow}
          drivers={drivers.filter((d: any) => !d.date_terminated && tabOf(d.driver_type || 'company') === driverTab)}
          onClose={() => setAmountsRowKey(null)}
          onSave={(amounts) => { if (amountsRow) updateRow(amountsRow.key, { amounts }); setAmountsRowKey(null) }}
        />
      </div>
    </Layout>
  )
}

function StatsPanel({ title, subtitle, all, company, owner, coOwner }: {
  title: string
  subtitle: string
  all: PayTotals
  company: PayTotals
  owner: PayTotals
  coOwner: PayTotals
}) {
  // One line per driver type under each number.
  const split = (f: (t: PayTotals) => string) => (
    <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)', marginTop: '4px', lineHeight: '15px' }}>
      <div>Company {f(company)}</div>
      <div>Owner op {f(owner)}</div>
      <div>Co. owner {f(coOwner)}</div>
    </div>
  )
  const money = (f: (t: PayTotals) => number) => (t: PayTotals) => formatCurrency(f(t))
  const signed = (n: number) => (n < 0 ? `(${formatCurrency(-n)})` : formatCurrency(n))
  // Net Profit: what the company keeps - company drivers' Company Net plus
  // owner operators' dispatch fee.
  const net = all.company_net + all.dispatch_income
  const tiles = [
    { label: 'Gross', value: money(t => t.earnings)(all), sub: split(money(t => t.earnings)), color: undefined as string | undefined },
    {
      label: 'Net Profit',
      value: signed(net),
      color: net < 0 ? 'var(--monday-stuck)' : 'var(--monday-done)',
      sub: (
        <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)', marginTop: '4px', lineHeight: '15px' }}>
          <div>Company drivers net {signed(all.company_net)}</div>
          <div>Owner op dispatch {signed(all.dispatch_income)}</div>
        </div>
      ),
    },
  ]
  return (
    <div className="rounded-lg shadow-sm p-4" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{title}</span>
        <span style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-md p-3" style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: t.color || 'var(--monday-text-primary)', marginTop: '2px' }}>{t.value}</div>
            {t.sub}
          </div>
        ))}
      </div>
    </div>
  )
}

// Rename, reorder, show/hide, switch fixed/variable and delete rows, saved together.
function RowsDialog({ open, title, rows, onClose, onSave, onAmounts, onDriverSettings }: {
  open: boolean
  title: string
  rows: PayrollRow[]
  onClose: () => void
  onSave: (rows: PayrollRow[]) => void
  onAmounts: (key: string) => void
  onDriverSettings: () => void
}) {
  const [draft, setDraft] = useState<PayrollRow[]>(rows)
  useEffect(() => { if (open) setDraft(rows) }, [open, rows])

  const patch = (i: number, p: Partial<PayrollRow>) => setDraft(d => d.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (i: number, by: number) => setDraft(d => {
    const j = i + by
    if (j < 0 || j >= d.length) return d
    const next = [...d]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const add = () => setDraft(d => [...d, { key: '', label: 'New row', kind: 'deduction', mode: 'fixed', hidden: false, builtin: false, amounts: {} }])
  const changed = JSON.stringify(draft) !== JSON.stringify(rows)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payroll rows: {title}</DialogTitle>
          <DialogDescription>
            These rows apply to every {title.toLowerCase().replace(/s$/, '')} and every week. Hidden rows are left out of net pay.
            Fixed rows take the same amount every week; variable rows are entered week by week.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {draft.map((r, i) => {
            const switchable = !r.builtin || SWITCHABLE_ROWS.has(r.key)
            return (
              <div key={r.key || `new-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5" style={{ opacity: r.hidden ? 0.55 : 1 }}>
                <div className="flex flex-col">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="Move down" disabled={i === draft.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <Input value={r.label} maxLength={40} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 w-40 text-sm" />
                {r.builtin ? (
                  <span className="w-24 text-xs text-gray-500">{r.kind === 'info' ? 'Info only' : r.kind === 'earning' ? 'Earning' : 'Deduction'}</span>
                ) : (
                  <select className="h-8 w-24 rounded border text-xs px-1" value={r.kind} onChange={(e) => patch(i, { kind: e.target.value as any })}>
                    <option value="deduction">Deduction</option>
                    <option value="earning">Earning</option>
                  </select>
                )}
                {switchable ? (
                  <select className="h-8 w-24 rounded border text-xs px-1" value={r.mode} onChange={(e) => patch(i, { mode: e.target.value as any })}>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                  </select>
                ) : (
                  <span className="w-24 text-xs text-gray-500" title={MODE_HELP[r.mode]}>{MODE_LABEL[r.mode]}</span>
                )}
                {r.mode === 'fixed' && (
                  <button
                    className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    disabled={!r.builtin && (!r.key || changed)}
                    title={!r.builtin && (!r.key || changed) ? 'Save first' : 'Weekly amount per driver'}
                    onClick={() => (r.builtin ? onDriverSettings() : onAmounts(r.key))}
                  >
                    Amounts
                  </button>
                )}
                <label className="ml-auto flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={!r.hidden} onChange={(e) => patch(i, { hidden: !e.target.checked })} />
                  Show
                </label>
                {!r.builtin && (
                  <button aria-label={`Delete ${r.label}`} onClick={() => setDraft(d => d.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!changed || draft.some(r => !r.label.trim())} onClick={() => onSave(draft)}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Weekly amount per driver for a fixed custom row.
// Pay Structure for one company driver: pick fixed / per mile / percentage and
// set a rate for each (the others show under Net Pay for comparison).
function PayStructureDialog({ driver, settings, saving, onClose, onSave }: {
  driver: any | null
  settings: any
  saving: boolean
  onClose: () => void
  onSave: (data: { pay_structure: PayStructure | null; pay_fixed: number | null; pay_per_mile: number | null; pay_percent: number | null }) => void
}) {
  const [structure, setStructure] = useState<PayStructure | null>(null)
  const [rates, setRates] = useState<Record<PayStructure, string>>({ fixed: '', per_mile: '', percent: '' })
  useEffect(() => {
    if (!driver) return
    const str = (v: any) => (v === null || v === undefined || v === '' ? '' : String(Number(v)))
    setStructure(settings?.pay_structure ?? null)
    setRates({ fixed: str(settings?.pay_fixed), per_mile: str(settings?.pay_per_mile), percent: str(settings?.pay_percent) })
  }, [driver?.id, settings?.pay_structure, settings?.pay_fixed, settings?.pay_per_mile, settings?.pay_percent])

  const num = (s: string) => (s.trim() === '' || isNaN(parseFloat(s)) ? null : parseFloat(s))
  const invalid = (structure && num(rates[structure]) === null) || (num(rates.percent) ?? 0) > 100
  const fields: { key: PayStructure; label: string; prefix?: string; suffix: string; step: string; help: string }[] = [
    { key: 'fixed', label: 'Fixed', prefix: '$', suffix: 'a week', step: '0.01', help: 'The same amount every week' },
    { key: 'per_mile', label: 'Per mile', prefix: '$', suffix: 'a mile', step: '0.001', help: 'Times the week\u2019s Trip Miles' },
    { key: 'percent', label: 'Percentage', suffix: '% of gross', step: '0.01', help: 'Of the week\u2019s Gross' },
  ]

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay structure: {driver?.first_name} {driver?.last_name}</DialogTitle>
          <DialogDescription>
            The one you pick is the driver&apos;s Net Pay. Company Net below it is Gross minus every deduction minus
            that pay. Rates you set for the other two show under Net Pay so you can compare. Changes apply from this
            week on; earlier weeks keep the rates they had.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {fields.map(f => (
            <label
              key={f.key}
              className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${structure === f.key ? 'border-brand bg-brand/5' : 'border-gray-200'}`}
            >
              <input type="radio" name="pay-structure" checked={structure === f.key} onChange={() => setStructure(f.key)} />
              <div className="flex-1">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-gray-500">{f.help}</div>
              </div>
              <div className="flex items-center gap-1 text-sm">
                {f.prefix && <span className="text-gray-500">{f.prefix}</span>}
                <Input
                  type="number"
                  min="0"
                  step={f.step}
                  value={rates[f.key]}
                  onChange={(e) => setRates(r => ({ ...r, [f.key]: e.target.value }))}
                  onFocus={() => !structure && setStructure(f.key)}
                  className="h-8 w-24 text-sm"
                />
                <span className="text-gray-500 whitespace-nowrap">{f.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          {settings?.pay_structure ? (
            <Button
              variant="ghost"
              className="text-gray-500"
              onClick={() => onSave({ pay_structure: null, pay_fixed: num(rates.fixed), pay_per_mile: num(rates.per_mile), pay_percent: num(rates.percent) })}
            >
              Remove (pay Gross)
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!structure || !!invalid || saving}
              onClick={() => onSave({ pay_structure: structure, pay_fixed: num(rates.fixed), pay_per_mile: num(rates.per_mile), pay_percent: num(rates.percent) })}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AmountsDialog({ row, drivers, onClose, onSave }: {
  row: PayrollRow | null
  drivers: any[]
  onClose: () => void
  onSave: (amounts: Record<string, number>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [fillAll, setFillAll] = useState('')
  useEffect(() => {
    if (!row) return
    const v: Record<string, string> = {}
    drivers.forEach(d => { const a = row.amounts?.[String(d.id)]; v[String(d.id)] = a ? String(a) : '' })
    setValues(v)
    setFillAll('')
  }, [row?.key])

  const save = () => {
    const amounts: Record<string, number> = {}
    Object.entries(values).forEach(([id, s]) => { const n = parseFloat(s); if (n) amounts[id] = Math.round(n * 100) / 100 })
    onSave(amounts)
  }
  const sorted = [...drivers].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row?.label}: weekly amounts</DialogTitle>
          <DialogDescription>
            {row?.kind === 'earning' ? 'Added to' : 'Taken out of'} each driver&apos;s pay every week. Leave blank for none.
            You can still change a single week by clicking its cell in the table.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-2 border-b">
          <Input type="number" step="0.01" placeholder="Same amount for all" value={fillAll} onChange={(e) => setFillAll(e.target.value)} className="h-8 text-sm" />
          <Button size="sm" variant="outline" disabled={!fillAll} onClick={() => setValues(v => Object.fromEntries(Object.keys(v).map(k => [k, fillAll])))}>Apply to all</Button>
        </div>
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">
                {d.first_name} {d.last_name}
              </span>
              <Input
                type="number"
                step="0.01"
                value={values[String(d.id)] ?? ''}
                onChange={(e) => setValues(v => ({ ...v, [String(d.id)]: e.target.value }))}
                className="h-8 w-32 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Send Statement: the week's pay statement, editable, texted to the driver.
function StatementDialog({ driver, phone, text, onClose }: {
  driver: DriverPayrollData | null
  phone?: string | null
  text: string
  onClose: () => void
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  useEffect(() => {
    if (!driver) return
    setMessage(text)
    setError(null)
    setSentTo(null)
  }, [driver?.driver_id])

  const send = async () => {
    if (!driver) return
    setSending(true)
    setError(null)
    try {
      const r = await api.post('/v1/payroll/statement/send', { driver_id: driver.driver_id, message })
      setSentTo(r.data?.to || phone || '')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not send the text.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Statement: {driver?.driver_name}</DialogTitle>
          <DialogDescription>
            Texted to {phone || 'no phone on file'}. This is this week&apos;s column of the payroll table; you can edit it before sending.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={Math.min(18, Math.max(8, message.split('\n').length + 1))}
          maxLength={1600}
          disabled={!!sentTo}
          className="w-full rounded border p-2 font-mono text-sm"
          style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)', color: 'var(--monday-text-primary)' }}
        />
        {error && <div className="text-sm" style={{ color: 'var(--monday-stuck)' }}>{error}</div>}
        {sentTo && <div className="text-sm font-medium" style={{ color: 'var(--monday-done)' }}>Sent to {sentTo}.</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>{sentTo ? 'Close' : 'Cancel'}</Button>
          {!sentTo && <Button onClick={send} disabled={sending || !message.trim() || !phone}>{sending ? 'Sending…' : 'Send Text'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
