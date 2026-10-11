'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calculator, ChevronLeft, ChevronRight, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, Copy, RefreshCw, Settings } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { usePayrollOverrides, useSavePayrollOverride } from '@/hooks/use-payroll-overrides'
import { useDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
import { useColumnWidths } from '@/hooks/use-column-widths'
import { ColumnWidthControl } from '@/components/ui/column-width-control'
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

interface DriverPayrollData {
  driver_id: number
  driver_name: string
  driver_type: string
  truck_id?: number | null
  weeks: {
    [weekNumber: number]: {
      gross: number
      extra: number
      dispatch_fee: number
      insurance: number
      fuel: number
      parking: number
      trailer: number
      misc: number
      adjustments: number  // Load adjustments (positive = bonuses, negative = deductions)
      miles: number
      check_amount: number
    }
  }
}

// The table is split into company drivers and owner operators; anything not
// marked owner_operator is treated as a company driver.
type DriverTab = 'company' | 'owner_operator'
const tabOf = (driverType: string): DriverTab => (driverType === 'owner_operator' ? 'owner_operator' : 'company')

type PayTotals = {
  gross: number
  extra: number
  dispatch_fee: number
  insurance: number
  fuel: number
  parking: number
  trailer: number
  misc: number
  adjustments: number
  miles: number
  check_amount: number
  drivers_paid: number
}

const emptyTotals = (): PayTotals => ({
  gross: 0, extra: 0, dispatch_fee: 0, insurance: 0, fuel: 0, parking: 0,
  trailer: 0, misc: 0, adjustments: 0, miles: 0, check_amount: 0, drivers_paid: 0,
})

const deductionsOf = (t: PayTotals) => t.dispatch_fee + t.insurance + t.fuel + t.parking + t.trailer + t.misc

type EditingCell = {
  weekNumber: number
  driverId: number
  field: string
} | null

export default function PayrollPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: calculatedPayroll, isLoading: payrollLoading, refetch: refetchPayroll } = useCalculatedPayroll(selectedYear)
  const { data: payrollOverrides } = usePayrollOverrides(selectedYear)
  const saveOverride = useSavePayrollOverride()
  const { data: trucksData } = useTrucks()
  const { data: driverSettings } = useDriverPayrollSettings()
  const drivers = driversData?.items || []
  const trucks = (trucksData?.items || []).filter((t: any) => t.type === 'truck')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])) // Week 1 expanded by default

  // Available years for the tabs
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]
    return years.filter(y => y >= 2024) // Start from 2024
  }, [])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [sortField, setSortField] = useState<string>('weekNumber')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, weekNumber: number, driverId: number} | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [driverTab, setDriverTab] = useState<DriverTab>('company')
  const [editValue, setEditValue] = useState<string>('')

  // Build overrides lookup from database
  const overridesMap = useMemo(() => {
    const map: Record<string, number> = {}
    if (payrollOverrides) {
      payrollOverrides.forEach(o => {
        map[`${o.driver_id}_${o.week_number}_${o.field}`] = o.value
      })
    }
    return map
  }, [payrollOverrides])

  const getOverride = (driverId: number, weekNum: number, field: string): number | undefined => {
    return overridesMap[`${driverId}_${weekNum}_${field}`]
  }

  const isLoading = driversLoading || payrollLoading

  // Column width management
  const { columnWidths, adjustWidth } = useColumnWidths('payroll-table', {
    driver: 200,
    truck: 100,
    gross: 100,
    extra: 100,
    dispatch_fee: 110,
    insurance: 100,
    fuel: 100,
    parking: 100,
    trailer: 100,
    misc: 100,
    miles: 90,
    pay: 120
  })

  const weeks = useMemo(() => generateWeeks(selectedYear), [selectedYear])

  // One week at a time, picked from the dropdown. Defaults to this week when
  // looking at the current year, else week 1.
  const currentWeekNumber = (ws: ReturnType<typeof generateWeeks>) => {
    const today = new Date()
    const end = (w: { endDate: Date }) => new Date(w.endDate.getFullYear(), w.endDate.getMonth(), w.endDate.getDate(), 23, 59, 59)
    return ws.find(w => today >= w.startDate && today <= end(w))?.weekNumber
  }
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeekNumber(generateWeeks(new Date().getFullYear())) ?? 1)
  useEffect(() => {
    setSelectedWeek(currentWeekNumber(weeks) ?? 1)
  }, [weeks])
  const weekOptionLabel = (w: { weekNumber: number; startDate: Date; endDate: Date }) =>
    `Week ${w.weekNumber} \u00b7 ${w.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${w.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  // Helper function to check if a driver was employed during a specific week
  const isDriverEmployedDuringWeek = (driver: any, weekStart: Date, weekEnd: Date): boolean => {
    // If driver has a hire date, they must be hired on or before the week ends
    if (driver.date_hired) {
      const hireDate = new Date(driver.date_hired)
      if (hireDate > weekEnd) {
        return false // Driver wasn't hired yet
      }
    }

    // If driver has a termination date, they must be terminated after the week starts
    // (so they're included in the last week they worked)
    if (driver.date_terminated) {
      const terminationDate = new Date(driver.date_terminated)
      if (terminationDate < weekStart) {
        return false // Driver was already terminated before this week
      }
    }

    return true
  }

  // Get drivers employed during a specific week
  const getDriversForWeek = (weekNumber: number) => {
    const week = weeks.find(w => w.weekNumber === weekNumber)
    if (!week) return drivers

    return drivers.filter(driver => isDriverEmployedDuringWeek(driver, week.startDate, week.endDate))
  }

  // Transform calculated payroll data into the format expected by the page
  const payrollData: DriverPayrollData[] = useMemo(() => {
    // Build settings lookup for truck assignments
    const settingsMap = new Map<number, any>()
    if (driverSettings) {
      driverSettings.forEach((s: any) => settingsMap.set(s.driver_id, s))
    }

    // Create a map from driver ID to driver data
    const driverMap = new Map(
      drivers.map(driver => [
        driver.id,
        {
          driver_id: driver.id,
          driver_name: `${driver.first_name} ${driver.last_name}`,
          driver_type: driver.driver_type || 'company',
          truck_id: settingsMap.get(driver.id)?.truck_id || null,
          weeks: {} as DriverPayrollData['weeks']
        }
      ])
    )

    // Populate weeks data from calculated payroll (API data only, no localStorage)
    if (calculatedPayroll && Array.isArray(calculatedPayroll)) {
      calculatedPayroll.forEach(entry => {
        if (!entry || typeof entry.driver_id !== 'number' || typeof entry.week_number !== 'number') {
          console.warn('Invalid payroll entry:', entry)
          return
        }

        const driverData = driverMap.get(entry.driver_id)
        if (driverData) {
          const ov = (field: string, apiVal: number) => {
            const o = getOverride(entry.driver_id, entry.week_number, field)
            return o !== undefined ? o : apiVal
          }
          const gross = ov('gross', Number(entry.gross) || 0)
          const extra = ov('extra', Number(entry.extra) || 0)
          const dispatch_fee = ov('dispatch_fee', Number(entry.dispatch_fee) || 0)
          const insurance = ov('insurance', Number(entry.insurance) || 0)
          const fuel = ov('fuel', Number(entry.fuel) || 0)
          const parking = ov('parking', Number(entry.parking) || 0)
          const trailer = ov('trailer', Number(entry.trailer) || 0)
          const misc = ov('misc', Number(entry.misc) || 0)
          const miles = ov('miles', Number(entry.miles) || 0)
          const adjustments = Number(entry.adjustments) || 0

          const check_amount = gross + extra - dispatch_fee - insurance - fuel - parking - trailer - misc

          driverData.weeks[entry.week_number] = {
            gross,
            extra,
            dispatch_fee,
            insurance,
            fuel,
            parking,
            trailer,
            misc,
            adjustments,
            miles,
            check_amount
          }
        }
      })
    }

    return Array.from(driverMap.values()).sort((a, b) => {
      // Company drivers first, then owner operators
      if (a.driver_type !== b.driver_type) {
        return a.driver_type === 'company' ? -1 : 1
      }
      return a.driver_name.localeCompare(b.driver_name)
    })
  }, [drivers, calculatedPayroll, overridesMap, driverSettings])

  const toggleWeek = (weekNumber: number) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekNumber)) {
      newExpanded.delete(weekNumber)
    } else {
      newExpanded.add(weekNumber)
    }
    setExpandedWeeks(newExpanded)
  }

  const expandAll = () => {
    setExpandedWeeks(new Set(weeks.map(w => w.weekNumber)))
  }

  const collapseAll = () => {
    setExpandedWeeks(new Set())
  }

  const goToCurrentWeek = () => {
    const thisYear = new Date().getFullYear()
    if (selectedYear !== thisYear) {
      setSelectedYear(thisYear) // the effect above lands on this week
      return
    }
    setSelectedWeek(currentWeekNumber(weeks) ?? 1)
  }


  // Calculate week totals (only for drivers employed during that week),
  // optionally for one driver type.
  const getWeekTotals = (weekNumber: number, tab?: DriverTab): PayTotals => {
    const totals = emptyTotals()
    const employedDriverIds = new Set(getDriversForWeek(weekNumber).map(d => d.id))

    payrollData.forEach(driverData => {
      // Only include drivers who were employed during this week
      if (!employedDriverIds.has(driverData.driver_id)) return
      if (tab && tabOf(driverData.driver_type) !== tab) return

      const weekData = driverData.weeks[weekNumber]
      if (weekData) {
        totals.gross += weekData.gross
        totals.extra += weekData.extra
        totals.dispatch_fee += weekData.dispatch_fee
        totals.insurance += weekData.insurance
        totals.fuel += weekData.fuel
        totals.parking += weekData.parking
        totals.trailer += weekData.trailer
        totals.misc += weekData.misc
        totals.adjustments += weekData.adjustments
        totals.miles += weekData.miles
        totals.check_amount += weekData.check_amount
        if (weekData.check_amount !== 0) totals.drivers_paid += 1
      }
    })

    return totals
  }

  // Totals across every week of the selected year, optionally for one driver type.
  // drivers_paid here counts distinct drivers paid at least once.
  const getYearTotals = (tab?: DriverTab): PayTotals => {
    const totals = emptyTotals()
    const paid = new Set<number>()
    weeks.forEach(week => {
      const employedDriverIds = new Set(getDriversForWeek(week.weekNumber).map(d => d.id))
      payrollData.forEach(driverData => {
        if (!employedDriverIds.has(driverData.driver_id)) return
        if (tab && tabOf(driverData.driver_type) !== tab) return
        const weekData = driverData.weeks[week.weekNumber]
        if (!weekData) return
        totals.gross += weekData.gross
        totals.extra += weekData.extra
        totals.dispatch_fee += weekData.dispatch_fee
        totals.insurance += weekData.insurance
        totals.fuel += weekData.fuel
        totals.parking += weekData.parking
        totals.trailer += weekData.trailer
        totals.misc += weekData.misc
        totals.adjustments += weekData.adjustments
        totals.miles += weekData.miles
        totals.check_amount += weekData.check_amount
        if (weekData.check_amount !== 0) paid.add(driverData.driver_id)
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

  // Annual Total footer follows the selected tab.
  const grandTotals = driverTab === 'company' ? stats.year.company : stats.year.owner

  // Close context menu when clicking outside
  // IMPORTANT: This must be before any early returns to maintain hook order
  useEffect(() => {
    if (!contextMenu) {
      return undefined
    }

    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  if (isLoading) {
    return (
      <Layout>
        <div className="page-payroll space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
              <p className="text-gray-600">Weekly driver payroll</p>
            </div>
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

  const handleContextMenu = (e: React.MouseEvent, weekNumber: number, driverId: number) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      weekNumber,
      driverId
    })
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const isEditing = (weekNumber: number, driverId: number, field: string) => {
    return editingCell?.weekNumber === weekNumber && editingCell?.driverId === driverId && editingCell?.field === field
  }

  const startEdit = (weekNumber: number, driverId: number, field: string, currentValue: number) => {
    setEditingCell({ weekNumber, driverId, field })
    setEditValue(currentValue.toString())
  }

  const stopEdit = () => {
    if (editingCell && editValue !== '') {
      saveOverride.mutate({
        driver_id: editingCell.driverId,
        year: selectedYear,
        week_number: editingCell.weekNumber,
        field: editingCell.field,
        value: parseFloat(editValue) || 0
      })
    }
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      stopEdit()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }


  return (
    <Layout>
      <div className="page-payroll space-y-5">
        {/* Header - QuickBooks style */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--monday-text-primary)', letterSpacing: '-0.02em' }}>Payroll</h1>
            <p style={{ fontSize: '14px', color: 'var(--monday-text-secondary)', marginTop: '2px' }}>Weekly driver payroll</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setSettingsModalOpen(true)}
              style={{ backgroundColor: 'var(--monday-done)', borderColor: 'var(--monday-done)', color: 'white', fontWeight: 500, fontSize: '13px' }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Driver Settings
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

        {/* Year Tabs - QuickBooks style */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className="px-4 py-2 text-sm transition-all relative"
              style={{
                color: selectedYear === year ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                borderBottom: selectedYear === year ? `3px solid ${'var(--monday-done)'}` : '3px solid transparent',
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
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous week"
            disabled={selectedWeek <= 1}
            onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
          >
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
          <Button
            variant="outline"
            size="sm"
            aria-label="Next week"
            disabled={selectedWeek >= weeks.length}
            onClick={() => setSelectedWeek(w => Math.min(weeks.length, w + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week + year stats */}
        {drivers.length > 0 && (() => {
          const week = weeks.find(w => w.weekNumber === selectedWeek)
          const isThisYear = selectedYear === new Date().getFullYear()
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <StatsPanel
                title={`Week ${selectedWeek}`}
                subtitle={week ? `${week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                {...stats.week}
                driversLabel="Drivers paid"
              />
              <StatsPanel
                title={`${selectedYear}`}
                subtitle={isThisYear ? 'Year to date' : 'Full year'}
                {...stats.year}
                driversLabel="Drivers paid this year"
              />
            </div>
          )
        })()}

        {/* Driver type tabs */}
        {drivers.length > 0 && (() => {
          const employed = getDriversForWeek(selectedWeek)
          const count = (tab: DriverTab) => employed.filter((d: any) => tabOf(d.driver_type || 'company') === tab).length
          const tabs: { key: DriverTab; label: string }[] = [
            { key: 'company', label: 'Company Drivers' },
            { key: 'owner_operator', label: 'Owner Operators' },
          ]
          return (
            <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)', marginBottom: '-8px' }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setDriverTab(t.key)}
                  className="px-4 py-2 text-sm transition-all"
                  style={{
                    color: driverTab === t.key ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                    borderBottom: driverTab === t.key ? '3px solid var(--monday-done)' : '3px solid transparent',
                    marginBottom: '-1px',
                    fontWeight: driverTab === t.key ? 600 : 500,
                    fontSize: '14px'
                  }}
                >
                  {t.label}
                  <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.7 }}>({count(t.key)})</span>
                </button>
              ))}
            </div>
          )
        })()}

        {/* Payroll Table */}
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--monday-text-muted)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--monday-text-primary)', marginBottom: '8px' }}>No Drivers</h2>
              <p style={{ fontSize: '14px', color: 'var(--monday-text-secondary)' }}>Add drivers to start tracking payroll.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                    <th className="px-3 py-2.5 text-left border-b border-r relative group" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.driver}px`, minWidth: `${columnWidths.driver}px` }}>
                      <ColumnWidthControl currentWidth={columnWidths.driver} onAdjust={(delta) => adjustWidth('driver', delta)} />
                      Driver
                    </th>
                    <th className="px-3 py-2.5 text-left border-b border-r relative group" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.truck}px`, minWidth: `${columnWidths.truck}px` }}>
                      <ColumnWidthControl currentWidth={columnWidths.truck} onAdjust={(delta) => adjustWidth('truck', delta)} />
                      Truck
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.gross}px`, minWidth: `${columnWidths.gross}px` }} onClick={() => handleSort('gross')}>
                      <ColumnWidthControl currentWidth={columnWidths.gross} onAdjust={(delta) => adjustWidth('gross', delta)} />
                      <div className="flex items-center gap-1">Gross</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.extra}px`, minWidth: `${columnWidths.extra}px` }} onClick={() => handleSort('extra')}>
                      <ColumnWidthControl currentWidth={columnWidths.extra} onAdjust={(delta) => adjustWidth('extra', delta)} />
                      <div className="flex items-center gap-1">Extra</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.dispatch_fee}px`, minWidth: `${columnWidths.dispatch_fee}px` }} onClick={() => handleSort('dispatch_fee')}>
                      <ColumnWidthControl currentWidth={columnWidths.dispatch_fee} onAdjust={(delta) => adjustWidth('dispatch_fee', delta)} />
                      <div className="flex items-center gap-1">Dispatch</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.insurance}px`, minWidth: `${columnWidths.insurance}px` }} onClick={() => handleSort('insurance')}>
                      <ColumnWidthControl currentWidth={columnWidths.insurance} onAdjust={(delta) => adjustWidth('insurance', delta)} />
                      <div className="flex items-center gap-1">Insurance</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.fuel}px`, minWidth: `${columnWidths.fuel}px` }} onClick={() => handleSort('fuel')}>
                      <ColumnWidthControl currentWidth={columnWidths.fuel} onAdjust={(delta) => adjustWidth('fuel', delta)} />
                      <div className="flex items-center gap-1">Fuel</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.parking}px`, minWidth: `${columnWidths.parking}px` }} onClick={() => handleSort('parking')}>
                      <ColumnWidthControl currentWidth={columnWidths.parking} onAdjust={(delta) => adjustWidth('parking', delta)} />
                      <div className="flex items-center gap-1">Parking</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.trailer}px`, minWidth: `${columnWidths.trailer}px` }} onClick={() => handleSort('trailer')}>
                      <ColumnWidthControl currentWidth={columnWidths.trailer} onAdjust={(delta) => adjustWidth('trailer', delta)} />
                      <div className="flex items-center gap-1">Trailer</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.misc}px`, minWidth: `${columnWidths.misc}px` }} onClick={() => handleSort('misc')}>
                      <ColumnWidthControl currentWidth={columnWidths.misc} onAdjust={(delta) => adjustWidth('misc', delta)} />
                      <div className="flex items-center gap-1">Misc</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.miles}px`, minWidth: `${columnWidths.miles}px` }} onClick={() => handleSort('miles')}>
                      <ColumnWidthControl currentWidth={columnWidths.miles} onAdjust={(delta) => adjustWidth('miles', delta)} />
                      <div className="flex items-center gap-1">Miles</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--monday-done)', textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.pay}px`, minWidth: `${columnWidths.pay}px`, backgroundColor: 'rgba(44, 160, 28, 0.08)' }}>
                      <ColumnWidthControl currentWidth={columnWidths.pay} onAdjust={(delta) => adjustWidth('pay', delta)} />
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--monday-bg-primary)' }}>
                  {weeks.filter(w => w.weekNumber === selectedWeek).map((week, weekIndex) => {
                    const isExpanded = true
                    const weekTotals = getWeekTotals(week.weekNumber, driverTab)
                    // Drivers of the selected type employed during this week
                    const employedDriverIds = new Set(getDriversForWeek(week.weekNumber).map(d => d.id))
                    const tabRows = payrollData.filter(d => employedDriverIds.has(d.driver_id) && tabOf(d.driver_type) === driverTab)

                    return (
                      <React.Fragment key={week.weekNumber}>
                        {/* Week Header Row */}
                        <tr
                          id={`week-${week.weekNumber}`}
                          className="border-b"
                          style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}
                        >
                          <td colSpan={2} className="px-2 py-2" style={{ paddingLeft: '8px' }}>
                            <div className="flex items-center gap-2">
                              <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                                Week {week.weekNumber} {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                                ({tabRows.length} {driverTab === 'company' ? 'company drivers' : 'owner operators'})
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2" colSpan={9}></td>
                          <td className="px-2 py-2">
                            <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)' }}>
                              {formatCurrency(weekTotals.check_amount)}
                            </div>
                          </td>
                        </tr>

                        {/* Driver Rows */}
                        {isExpanded && tabRows.length === 0 && (
                          <tr>
                            <td colSpan={12} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                              No {driverTab === 'company' ? 'company drivers' : 'owner operators'} this week.
                            </td>
                          </tr>
                        )}
                        {isExpanded && tabRows.map((driverData, driverIndex) => {
                          const weekData = driverData.weeks[week.weekNumber]
                          const isOwner = driverData.driver_type === 'owner_operator'
                          const rowBg = isOwner ? '#FFF8E1' : '#F0F7FF'
                          const rowHoverBg = isOwner ? '#FFF0C2' : '#E0EFFF'

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="transition-colors"
                              style={{ borderTop: '2px solid #9CA3AF', borderBottom: '2px solid #9CA3AF', backgroundColor: rowBg }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = rowHoverBg }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowBg }}
                              onContextMenu={(e) => handleContextMenu(e, week.weekNumber, driverData.driver_id)}
                            >
                              <td className="px-3 py-2.5" style={{ border: '1px solid #D1D5DB', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                                {driverData.driver_name}
                              </td>
                              <td className="px-3 py-2" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', border: '1px solid #D1D5DB' }}>
                                {(() => {
                                  const weekTruckOverride = getOverride(driverData.driver_id, week.weekNumber, 'truck_id')
                                  const effectiveTruckId = weekTruckOverride !== undefined ? weekTruckOverride : (driverData.truck_id || '')
                                  const isOverridden = weekTruckOverride !== undefined
                                  return (
                                    <select
                                      className="w-full bg-transparent text-sm border-0 p-0 focus:ring-0 cursor-pointer"
                                      style={isOverridden ? { fontStyle: 'italic', color: 'var(--monday-done)' } : {}}
                                      value={effectiveTruckId}
                                      onChange={(e) => {
                                        const truckId = e.target.value ? parseInt(e.target.value) : 0
                                        saveOverride.mutate({
                                          driver_id: driverData.driver_id,
                                          year: selectedYear,
                                          week_number: week.weekNumber,
                                          field: 'truck_id',
                                          value: truckId
                                        })
                                      }}
                                    >
                                      <option value="">-</option>
                                      {trucks.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.truck_number}</option>
                                      ))}
                                    </select>
                                  )
                                })()}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'gross') && startEdit(week.weekNumber, driverData.driver_id, 'gross', weekData?.gross || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'gross') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.gross) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'extra') && startEdit(week.weekNumber, driverData.driver_id, 'extra', weekData?.extra || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'extra') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.extra) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') && startEdit(week.weekNumber, driverData.driver_id, 'dispatch_fee', weekData?.dispatch_fee || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.dispatch_fee > 0 ? `(${formatCurrency(weekData.dispatch_fee)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'insurance') && startEdit(week.weekNumber, driverData.driver_id, 'insurance', weekData?.insurance || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'insurance') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.insurance > 0 ? `(${formatCurrency(weekData.insurance)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'fuel') && startEdit(week.weekNumber, driverData.driver_id, 'fuel', weekData?.fuel || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'fuel') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.fuel > 0 ? `(${formatCurrency(weekData.fuel)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'parking') && startEdit(week.weekNumber, driverData.driver_id, 'parking', weekData?.parking || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'parking') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.parking > 0 ? `(${formatCurrency(weekData.parking)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'trailer') && startEdit(week.weekNumber, driverData.driver_id, 'trailer', weekData?.trailer || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'trailer') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.trailer > 0 ? `(${formatCurrency(weekData.trailer)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'misc') && startEdit(week.weekNumber, driverData.driver_id, 'misc', weekData?.misc || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'misc') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.misc > 0 ? `(${formatCurrency(weekData.misc)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-brand/5 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', border: '1px solid #D1D5DB' }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'miles') && startEdit(week.weekNumber, driverData.driver_id, 'miles', weekData?.miles || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'miles') ? (
                                  <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? weekData.miles.toLocaleString() : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--monday-done)', backgroundColor: 'rgba(232, 245, 230, 0.5)', border: '1px solid #D1D5DB' }}>
                                {weekData ? formatCurrency(weekData.check_amount) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                    <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>Annual Total · {driverTab === 'company' ? 'Company' : 'Owner Ops'}</td>
                    <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}></td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotals.gross)}</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotals.extra)}</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.dispatch_fee)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.insurance)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.fuel)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.parking)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.trailer)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-stuck)' }}>({formatCurrency(grandTotals.misc)})</td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{grandTotals.miles.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--monday-done)' }}>{formatCurrency(grandTotals.check_amount)}</td>
                  </tr>
                </tfoot>
              </table>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                // TODO: Add edit functionality
                setContextMenu(null)
              }}
            >
              <Edit2 className="h-4 w-4 text-brand" />
              <span>Edit Payroll</span>
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                // TODO: Add copy functionality
                setContextMenu(null)
              }}
            >
              <Copy className="h-4 w-4 text-green-600" />
              <span>Copy to Next Week</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
              onClick={() => {
                // TODO: Add delete functionality
                setContextMenu(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Payroll</span>
            </button>
          </div>
        )}

        {/* Driver Settings Modal */}
        <DriverSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
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
  const money = (t: PayTotals, f: (t: PayTotals) => number) => formatCurrency(f(t))
  const tiles = [
    { label: 'Gross', value: money(all, t => t.gross + t.extra), sub: split(money(company, t => t.gross + t.extra), money(owner, t => t.gross + t.extra)) },
    { label: 'Deductions', value: money(all, deductionsOf), sub: split(money(company, deductionsOf), money(owner, deductionsOf)), color: 'var(--monday-stuck)' },
    { label: 'Net Pay', value: money(all, t => t.check_amount), sub: split(money(company, t => t.check_amount), money(owner, t => t.check_amount)), color: 'var(--monday-done)' },
    { label: 'Miles', value: all.miles.toLocaleString(), sub: split(company.miles.toLocaleString(), owner.miles.toLocaleString()) },
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
