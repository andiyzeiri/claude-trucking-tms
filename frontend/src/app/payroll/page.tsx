'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ChevronRight, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, Copy, RefreshCw, Settings } from 'lucide-react'
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
    const today = new Date()
    const currentWeek = weeks.find(week =>
      today >= week.startDate && today <= week.endDate
    )
    if (currentWeek) {
      setExpandedWeeks(new Set([currentWeek.weekNumber]))
      // Scroll to the week
      const element = document.getElementById(`week-${currentWeek.weekNumber}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Calculate week totals (only for drivers employed during that week)
  const getWeekTotals = (weekNumber: number) => {
    const totals = {
      gross: 0,
      extra: 0,
      dispatch_fee: 0,
      insurance: 0,
      fuel: 0,
      parking: 0,
      trailer: 0,
      misc: 0,
      adjustments: 0,
      miles: 0,
      check_amount: 0
    }

    const employedDriverIds = new Set(getDriversForWeek(weekNumber).map(d => d.id))

    payrollData.forEach(driverData => {
      // Only include drivers who were employed during this week
      if (!employedDriverIds.has(driverData.driver_id)) return

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
      }
    })

    return totals
  }

  // Calculate grand totals across all 52 weeks
  const grandTotals = useMemo(() => {
    const totals = {
      gross: 0,
      extra: 0,
      dispatch_fee: 0,
      insurance: 0,
      fuel: 0,
      parking: 0,
      trailer: 0,
      misc: 0,
      adjustments: 0,
      miles: 0,
      check_amount: 0
    }

    weeks.forEach(week => {
      const weekTotals = getWeekTotals(week.weekNumber)
      totals.gross += weekTotals.gross
      totals.extra += weekTotals.extra
      totals.dispatch_fee += weekTotals.dispatch_fee
      totals.insurance += weekTotals.insurance
      totals.fuel += weekTotals.fuel
      totals.parking += weekTotals.parking
      totals.trailer += weekTotals.trailer
      totals.misc += weekTotals.misc
      totals.adjustments += weekTotals.adjustments
      totals.miles += weekTotals.miles
      totals.check_amount += weekTotals.check_amount
    })

    return totals
  }, [payrollData, weeks])

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

  // Calculate stats for the current week
  // IMPORTANT: This must be before any early returns to maintain hook order
  const currentWeekStats = useMemo(() => {
    const today = new Date()
    const currentWeek = weeks.find(week =>
      today >= week.startDate && today <= week.endDate
    )
    if (!currentWeek) return { total: 0, paid: 0, pending: 0, miles: 0 }

    const totals = getWeekTotals(currentWeek.weekNumber)
    return {
      total: totals.check_amount,
      paid: totals.check_amount > 0 ? totals.check_amount : 0,
      pending: 0, // TODO: Add pending logic
      miles: totals.miles
    }
  }, [payrollData, weeks])

  if (isLoading) {
    return (
      <Layout>
        <div className="page-payroll space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
              <p className="text-gray-600">52-week driver payroll overview</p>
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
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
            <p style={{ fontSize: '14px', color: 'var(--monday-text-secondary)', marginTop: '2px' }}>52-week driver payroll overview</p>
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
            <Button onClick={expandAll} variant="outline" style={{ fontSize: '13px', fontWeight: 500 }}>
              Expand All
            </Button>
            <Button onClick={collapseAll} variant="outline" style={{ fontSize: '13px', fontWeight: 500 }}>
              Collapse All
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
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                <thead>
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
                  {weeks.map((week, weekIndex) => {
                    const isExpanded = expandedWeeks.has(week.weekNumber)
                    const weekTotals = getWeekTotals(week.weekNumber)
                    const hasData = weekTotals.check_amount > 0
                    // Get drivers employed during this week
                    const employedDrivers = getDriversForWeek(week.weekNumber)
                    const employedDriverIds = new Set(employedDrivers.map(d => d.id))

                    return (
                      <React.Fragment key={week.weekNumber}>
                        {/* Week Header Row */}
                        <tr
                          id={`week-${week.weekNumber}`}
                          className="border-b cursor-pointer"
                          style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}
                          onClick={() => toggleWeek(week.weekNumber)}
                        >
                          <td colSpan={2} className="px-2 py-2" style={{ paddingLeft: '8px' }}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--monday-blue)' }} />
                              ) : (
                                <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--monday-blue)' }} />
                              )}
                              <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                                Week {week.weekNumber} {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                                ({employedDrivers.length} drivers)
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
                        {isExpanded && payrollData
                          .filter(driverData => employedDriverIds.has(driverData.driver_id))
                          .map((driverData, driverIndex) => {
                          const weekData = driverData.weeks[week.weekNumber]
                          const isOwner = driverData.driver_type === 'owner_operator'
                          const rowBg = isOwner ? '#FFF8E1' : '#F0F7FF'
                          const rowHoverBg = isOwner ? '#FFF0C2' : '#E0EFFF'

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="transition-colors"
                              style={{ borderTop: '2px solid #CBD5E1', borderBottom: '2px solid #CBD5E1', backgroundColor: rowBg }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = rowHoverBg }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowBg }}
                              onContextMenu={(e) => handleContextMenu(e, week.weekNumber, driverData.driver_id)}
                            >
                              <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                                {driverData.driver_name}
                              </td>
                              <td className="px-3 py-2" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', borderRight: `1px solid ${'var(--monday-border-light)'}` }}>
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
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'gross') && startEdit(week.weekNumber, driverData.driver_id, 'gross', weekData?.gross || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'gross') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.gross) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'extra') && startEdit(week.weekNumber, driverData.driver_id, 'extra', weekData?.extra || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'extra') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.extra) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') && startEdit(week.weekNumber, driverData.driver_id, 'dispatch_fee', weekData?.dispatch_fee || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.dispatch_fee > 0 ? `(${formatCurrency(weekData.dispatch_fee)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'insurance') && startEdit(week.weekNumber, driverData.driver_id, 'insurance', weekData?.insurance || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'insurance') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.insurance > 0 ? `(${formatCurrency(weekData.insurance)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'fuel') && startEdit(week.weekNumber, driverData.driver_id, 'fuel', weekData?.fuel || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'fuel') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.fuel > 0 ? `(${formatCurrency(weekData.fuel)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'parking') && startEdit(week.weekNumber, driverData.driver_id, 'parking', weekData?.parking || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'parking') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.parking > 0 ? `(${formatCurrency(weekData.parking)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'trailer') && startEdit(week.weekNumber, driverData.driver_id, 'trailer', weekData?.trailer || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'trailer') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.trailer > 0 ? `(${formatCurrency(weekData.trailer)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-stuck)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'misc') && startEdit(week.weekNumber, driverData.driver_id, 'misc', weekData?.misc || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'misc') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.misc > 0 ? `(${formatCurrency(weekData.misc)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', borderRight: `1px solid ${'var(--monday-border-light)'}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'miles') && startEdit(week.weekNumber, driverData.driver_id, 'miles', weekData?.miles || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'miles') ? (
                                  <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? weekData.miles.toLocaleString() : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--monday-done)', backgroundColor: 'rgba(232, 245, 230, 0.5)' }}>
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
                    <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>Annual Total</td>
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
              <Edit2 className="h-4 w-4 text-blue-600" />
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
