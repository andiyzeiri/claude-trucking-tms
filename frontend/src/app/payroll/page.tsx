'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, EyeOff, ListChecks, Plus, RefreshCw, Settings, Trash2, X } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { usePayrollOverrides, useSavePayrollOverride } from '@/hooks/use-payroll-overrides'
import { useDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
import { usePayrollLayout, useSavePayrollLayout, SWITCHABLE_ROWS, type PayrollRow } from '@/hooks/use-payroll-layout'
import { DriverSettingsModal } from '@/components/payroll/driver-settings-modal'


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

// The table is split into company drivers and owner operators; anything not
// marked owner_operator is treated as a company driver.
type DriverTab = 'company' | 'owner_operator'
const tabOf = (driverType: string): DriverTab => (driverType === 'owner_operator' ? 'owner_operator' : 'company')

// One driver's pay for one week: a value per row key (hidden rows included,
// so stats can still show miles), and net pay from the visible rows only.
type WeekCell = { values: Record<string, number>; check_amount: number }

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
}

const emptyTotals = (): PayTotals => ({ values: {}, earnings: 0, deductions: 0, check_amount: 0, drivers_paid: 0 })

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

const fmtValue = (row: PayrollRow, v: number | undefined) => {
  if (v === undefined) return '-'
  if (row.kind === 'info') return v ? v.toLocaleString() : '-'
  if (row.kind === 'deduction') return v ? `(${formatCurrency(v)})` : '-'
  return v ? formatCurrency(v) : '-'
}

const rowColor = (row: PayrollRow) => (row.kind === 'deduction' ? 'var(--monday-stuck)' : 'var(--monday-text-primary)')

export default function PayrollPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: calculatedPayroll, isLoading: payrollLoading, refetch: refetchPayroll } = useCalculatedPayroll(selectedYear)
  const { data: payrollOverrides } = usePayrollOverrides(selectedYear)
  const saveOverride = useSavePayrollOverride()
  const { data: trucksData } = useTrucks()
  const { data: driverSettings } = useDriverPayrollSettings()
  const { data: layoutRows, isLoading: layoutLoading } = usePayrollLayout()
  const saveLayout = useSavePayrollLayout()
  const drivers = driversData?.items || []
  const trucks = (trucksData?.items || []).filter((t: any) => t.type === 'truck')

  const rows: PayrollRow[] = layoutRows || []
  const visibleRows = rows.filter(r => !r.hidden)
  const hiddenRows = rows.filter(r => r.hidden)

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
        if (row.mode === 'auto') return Number(api?.[row.key]) || 0
        if (row.mode === 'fixed') return Number(settingsMap.get(driverId)?.[`${row.key}_weekly`]) || 0
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
          if (!api && !editedWeeks.has(`${driver.id}_${wn}`)) continue
          const values: Record<string, number> = {}
          let check = 0
          rows.forEach(row => {
            const v = valueOf(row, driver.id, wn, api)
            values[row.key] = v
            if (row.hidden) return
            if (row.kind === 'earning') check += v
            else if (row.kind === 'deduction') check -= v
          })
          data.weeks[wn] = { values, check_amount: check }
        }
        return data
      })
      .sort((a, b) => a.driver_name.localeCompare(b.driver_name))
  }, [drivers, calculatedPayroll, overridesMap, payrollOverrides, driverSettings, layoutRows])

  const addInto = (totals: PayTotals, cell: WeekCell) => {
    rows.forEach(row => {
      const v = cell.values[row.key] || 0
      totals.values[row.key] = (totals.values[row.key] || 0) + v
      if (row.hidden) return
      if (row.kind === 'earning') totals.earnings += v
      else if (row.kind === 'deduction') totals.deductions += v
    })
    totals.check_amount += cell.check_amount
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
      addInto(totals, cell)
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
        addInto(totals, cell)
        if (cell.check_amount !== 0) paid.add(d.driver_id)
      })
    })
    totals.drivers_paid = paid.size
    return totals
  }

  // Stats cards at the top: the selected week and the whole year, each with
  // the company driver / owner operator split.
  const stats = useMemo(() => ({
    week: {
      all: getWeekTotals(selectedWeek),
      company: getWeekTotals(selectedWeek, 'company'),
      owner: getWeekTotals(selectedWeek, 'owner_operator'),
    },
    year: {
      all: getYearTotals(),
      company: getYearTotals('company'),
      owner: getYearTotals('owner_operator'),
    },
  }), [payrollData, weeks, selectedWeek, drivers])

  const goToCurrentWeek = () => {
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
  const toggleMode = (row: PayrollRow) => {
    if (row.mode === 'auto' || (row.builtin && !SWITCHABLE_ROWS.has(row.key))) return
    updateRow(row.key, { mode: row.mode === 'fixed' ? 'variable' : 'fixed' })
  }
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
      saveOverride.mutate({
        driver_id: editingCell.driverId,
        year: selectedYear,
        week_number: editingCell.weekNumber,
        field: editingCell.field,
        value: parseFloat(editValue) || 0,
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
  const tabRows = payrollData.filter(d => employedIds.has(d.driver_id) && tabOf(d.driver_type) === driverTab)
  const tabCount = (tab: DriverTab) => payrollData.filter(d => employedIds.has(d.driver_id) && tabOf(d.driver_type) === tab).length
  const tabNoun = driverTab === 'company' ? 'company drivers' : 'owner operators'
  const amountsRow = rows.find(r => r.key === amountsRowKey) || null

  // Shared cell styles
  const LABEL_W = 230
  const COL_W = 140
  const border = '1px solid var(--monday-border-light)'
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
              onClick={() => setSelectedYear(year)}
              className="px-4 py-2 text-sm transition-all relative"
              style={{
                color: selectedYear === year ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                borderBottom: selectedYear === year ? '3px solid var(--monday-done)' : '3px solid transparent',
                marginBottom: '-1px',
                fontWeight: selectedYear === year ? 600 : 500,
                fontSize: '14px'
              }}
            >
              {year}
              {year === new Date().getFullYear() && (
                <span style={{ marginLeft: '4px', fontSize: '12px', opacity: 0.7 }}>(Current)</span>
              )}
            </button>
          ))}
        </div>

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
                driversLabel="Drivers paid"
              />
              <StatsPanel
                title={`${selectedYear}`}
                subtitle={selectedYear === new Date().getFullYear() ? 'Year to date' : 'Full year'}
                {...stats.year}
                driversLabel="Drivers paid this year"
              />
            </div>

            {/* Driver type tabs */}
            <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)', marginBottom: '-8px' }}>
              {([['company', 'Company Drivers'], ['owner_operator', 'Owner Operators']] as [DriverTab, string][]).map(([key, label]) => (
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
                      <th key={d.driver_id} className="px-3 py-2.5 text-left" style={{ ...cell, fontWeight: 600, color: 'var(--monday-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.driver_name}>
                        {d.driver_name}
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
                              style={isOverridden ? { fontStyle: 'italic', color: 'var(--monday-done)' } : {}}
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
                              {trucks.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.truck_number}</option>
                              ))}
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Line items */}
                  {tabRows.length > 0 && visibleRows.map(row => {
                    const switchable = !row.builtin || SWITCHABLE_ROWS.has(row.key)
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
                              <button
                                onClick={() => toggleMode(row)}
                                disabled={!switchable || row.mode === 'auto'}
                                title={MODE_HELP[row.mode] + (switchable && row.mode !== 'auto' ? ' — click to switch' : '')}
                                className="rounded px-1.5 py-0.5"
                                style={{
                                  fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                                  backgroundColor: row.mode === 'fixed' ? 'rgba(0,115,234,0.1)' : row.mode === 'variable' ? 'rgba(253,171,61,0.18)' : 'var(--monday-bg-secondary)',
                                  color: row.mode === 'fixed' ? '#0073ea' : row.mode === 'variable' ? '#b26b00' : 'var(--monday-text-muted)',
                                  cursor: switchable && row.mode !== 'auto' ? 'pointer' : 'default',
                                }}
                              >
                                {MODE_LABEL[row.mode]}
                              </button>
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
                          const edited = getOverride(d.driver_id, selectedWeek, row.key) !== undefined
                          return (
                            <td
                              key={d.driver_id}
                              className="px-3 py-2 cursor-pointer hover:bg-brand/5"
                              style={{ ...cell, color: rowColor(row), fontStyle: edited ? 'italic' : undefined }}
                              title={edited ? 'Changed for this week only' : undefined}
                              onClick={() => !isEditing(selectedWeek, d.driver_id, row.key) && startEdit(selectedWeek, d.driver_id, row.key, v || 0)}
                            >
                              {isEditing(selectedWeek, d.driver_id, row.key) ? (
                                <Input type="number" step={row.kind === 'info' ? '1' : '0.01'} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                              ) : (
                                fmtValue(row, v)
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
                      {tabRows.map(d => (
                        <td key={d.driver_id} className="px-3 py-2.5" style={{ ...cell, borderBottom: 'none', fontWeight: 700, color: 'var(--monday-done)' }}>
                          {d.weeks[selectedWeek] ? formatCurrency(d.weeks[selectedWeek].check_amount) : '-'}
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

        <DriverSettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
        <RowsDialog
          open={rowsDialogOpen}
          rows={rows}
          onClose={() => setRowsDialogOpen(false)}
          onSave={(next) => { saveLayout.mutate(next); setRowsDialogOpen(false) }}
          onAmounts={(key) => { setRowsDialogOpen(false); setAmountsRowKey(key) }}
          onDriverSettings={() => { setRowsDialogOpen(false); setSettingsModalOpen(true) }}
        />
        <AmountsDialog
          row={amountsRow}
          drivers={drivers.filter((d: any) => !d.date_terminated)}
          onClose={() => setAmountsRowKey(null)}
          onSave={(amounts) => { if (amountsRow) updateRow(amountsRow.key, { amounts }); setAmountsRowKey(null) }}
        />
      </div>
    </Layout>
  )
}

function StatsPanel({ title, subtitle, all, company, owner, driversLabel }: {
  title: string
  subtitle: string
  all: PayTotals
  company: PayTotals
  owner: PayTotals
  driversLabel: string
}) {
  const split = (c: string, o: string) => (
    <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)', marginTop: '4px', lineHeight: '15px' }}>
      <div>Company {c}</div>
      <div>Owner op {o}</div>
    </div>
  )
  const miles = (t: PayTotals) => (t.values.miles || 0).toLocaleString()
  const tiles = [
    { label: 'Gross', value: formatCurrency(all.earnings), sub: split(formatCurrency(company.earnings), formatCurrency(owner.earnings)) },
    { label: 'Deductions', value: formatCurrency(all.deductions), sub: split(formatCurrency(company.deductions), formatCurrency(owner.deductions)), color: 'var(--monday-stuck)' },
    { label: 'Net Pay', value: formatCurrency(all.check_amount), sub: split(formatCurrency(company.check_amount), formatCurrency(owner.check_amount)), color: 'var(--monday-done)' },
    { label: 'Miles', value: miles(all), sub: split(miles(company), miles(owner)) },
    { label: driversLabel, value: String(all.drivers_paid), sub: split(String(company.drivers_paid), String(owner.drivers_paid)) },
  ]
  return (
    <div className="rounded-lg shadow-sm p-4" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{title}</span>
        <span style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>{subtitle}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
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
function RowsDialog({ open, rows, onClose, onSave, onAmounts, onDriverSettings }: {
  open: boolean
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
          <DialogTitle>Payroll rows</DialogTitle>
          <DialogDescription>
            These rows apply to every driver and every week. Hidden rows are left out of net pay.
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
  const sorted = [...drivers].sort((a, b) =>
    (tabOf(a.driver_type) === tabOf(b.driver_type) ? 0 : tabOf(a.driver_type) === 'company' ? -1 : 1) ||
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

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
                {tabOf(d.driver_type) === 'owner_operator' && <span className="ml-1 text-xs text-gray-500">(owner op)</span>}
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
