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
import { useDriverPayrollSettings, useCreateOrUpdateDriverPayrollSettings, useUpdateDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
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
  const createDriverSettings = useCreateOrUpdateDriverPayrollSettings()
  const updateDriverSettings = useUpdateDriverPayrollSettings()
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
    week: 300,
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

    return Array.from(driverMap.values())
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

  // QuickBooks-inspired color scheme
  const qbColors = {
    green: '#2CA01C',
    greenDark: '#1E7A12',
    greenLight: '#E8F5E6',
    red: '#D92D20',
    redLight: '#FEF3F2',
    textPrimary: '#1A1F36',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    borderLight: '#E5E7EB',
    borderMedium: '#D1D5DB',
    bgWhite: '#FFFFFF',
    bgGray: '#F9FAFB',
    bgHeader: '#393A3D',
  }

  return (
    <Layout>
      <div className="page-payroll space-y-5" style={{ fontFamily: '"Avenir Next", "Avenir", "Helvetica Neue", -apple-system, BlinkMacSystemFont, sans-serif' }}>
        {/* Header - QuickBooks style */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: qbColors.textPrimary, letterSpacing: '-0.02em' }}>Payroll</h1>
            <p style={{ fontSize: '14px', color: qbColors.textSecondary, marginTop: '2px' }}>52-week driver payroll overview</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setSettingsModalOpen(true)}
              style={{ backgroundColor: qbColors.green, borderColor: qbColors.green, color: 'white', fontWeight: 500, fontSize: '13px' }}
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
        <div className="flex items-center gap-1 border-b" style={{ borderColor: qbColors.borderLight }}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className="px-4 py-2 text-sm transition-all relative"
              style={{
                color: selectedYear === year ? qbColors.green : qbColors.textSecondary,
                borderBottom: selectedYear === year ? `3px solid ${qbColors.green}` : '3px solid transparent',
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

        {/* Grand Totals Summary - QuickBooks style - uses same column widths as main table */}
        {drivers.length > 0 && (
          <div style={{ border: `1px solid ${qbColors.borderLight}`, borderRadius: '8px', backgroundColor: qbColors.bgWhite, overflow: 'hidden' }}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ backgroundColor: qbColors.bgHeader }}>
                  <tr>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.week}px`, minWidth: `${columnWidths.week}px` }}>
                      {selectedYear}
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.driver}px`, minWidth: `${columnWidths.driver}px` }}>
                      Drivers
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.truck}px`, minWidth: `${columnWidths.truck}px` }}>
                      Truck
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.gross}px`, minWidth: `${columnWidths.gross}px` }}>
                      Gross
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.extra}px`, minWidth: `${columnWidths.extra}px` }}>
                      Extra
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.dispatch_fee}px`, minWidth: `${columnWidths.dispatch_fee}px` }}>
                      Dispatch
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.insurance}px`, minWidth: `${columnWidths.insurance}px` }}>
                      Insurance
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.fuel}px`, minWidth: `${columnWidths.fuel}px` }}>
                      Fuel
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.parking}px`, minWidth: `${columnWidths.parking}px` }}>
                      Parking
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.trailer}px`, minWidth: `${columnWidths.trailer}px` }}>
                      Trailer
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.misc}px`, minWidth: `${columnWidths.misc}px` }}>
                      Misc
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.miles}px`, minWidth: `${columnWidths.miles}px` }}>
                      Miles
                    </th>
                    <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', width: `${columnWidths.pay}px`, minWidth: `${columnWidths.pay}px`, backgroundColor: 'rgba(44, 160, 28, 0.3)' }}>
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: qbColors.bgGray, borderBottom: `1px solid ${qbColors.borderLight}` }}>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 600, color: qbColors.textPrimary }}>
                      52 Weeks Total
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, color: qbColors.textSecondary }}>
                      {payrollData.length} drivers
                    </td>
                    <td style={{ padding: '14px 12px' }}></td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 600, textAlign: 'left', color: qbColors.textPrimary }}>
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 600, textAlign: 'left', color: qbColors.textPrimary }}>
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.dispatch_fee)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.insurance)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.fuel)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.parking)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.trailer)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 500, textAlign: 'left', color: qbColors.red }}>
                      ({formatCurrency(grandTotals.misc)})
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 600, textAlign: 'left', color: qbColors.textPrimary }}>
                      {grandTotals.miles.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '16px', fontWeight: 700, textAlign: 'left', color: qbColors.green, backgroundColor: qbColors.greenLight }}>
                      {formatCurrency(grandTotals.check_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payroll Table - QuickBooks style */}
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 mx-auto mb-4" style={{ color: qbColors.textMuted }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: qbColors.textPrimary, marginBottom: '8px' }}>No Drivers</h2>
              <p style={{ fontSize: '14px', color: qbColors.textSecondary }}>Add drivers to start tracking payroll.</p>
            </div>
          </div>
        ) : (
          <div style={{ border: `1px solid ${qbColors.borderLight}`, borderRadius: '8px', backgroundColor: qbColors.bgWhite, overflow: 'hidden' }}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ backgroundColor: qbColors.bgGray, borderBottom: `2px solid ${qbColors.borderMedium}` }}>
                  <tr>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none sticky left-0 z-10" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', backgroundColor: qbColors.bgGray, width: `${columnWidths.week}px`, minWidth: `${columnWidths.week}px` }} onClick={() => handleSort('weekNumber')}>
                      <ColumnWidthControl currentWidth={columnWidths.week} onAdjust={(delta) => adjustWidth('week', delta)} />
                      <div className="flex items-center gap-1">
                        Week
                        {sortField === 'weekNumber' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.driver}px`, minWidth: `${columnWidths.driver}px` }} onClick={() => handleSort('driver')}>
                      <ColumnWidthControl currentWidth={columnWidths.driver} onAdjust={(delta) => adjustWidth('driver', delta)} />
                      <div className="flex items-center gap-1">
                        Driver
                        {sortField === 'driver' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.truck}px`, minWidth: `${columnWidths.truck}px` }}>
                      <ColumnWidthControl currentWidth={columnWidths.truck} onAdjust={(delta) => adjustWidth('truck', delta)} />
                      <div className="flex items-center gap-1">Truck</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.gross}px`, minWidth: `${columnWidths.gross}px` }} onClick={() => handleSort('gross')}>
                      <ColumnWidthControl currentWidth={columnWidths.gross} onAdjust={(delta) => adjustWidth('gross', delta)} />
                      <div className="flex items-center gap-1">Gross</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.extra}px`, minWidth: `${columnWidths.extra}px` }} onClick={() => handleSort('extra')}>
                      <ColumnWidthControl currentWidth={columnWidths.extra} onAdjust={(delta) => adjustWidth('extra', delta)} />
                      <div className="flex items-center gap-1">Extra</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.dispatch_fee}px`, minWidth: `${columnWidths.dispatch_fee}px` }} onClick={() => handleSort('dispatch_fee')}>
                      <ColumnWidthControl currentWidth={columnWidths.dispatch_fee} onAdjust={(delta) => adjustWidth('dispatch_fee', delta)} />
                      <div className="flex items-center gap-1">Dispatch</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.insurance}px`, minWidth: `${columnWidths.insurance}px` }} onClick={() => handleSort('insurance')}>
                      <ColumnWidthControl currentWidth={columnWidths.insurance} onAdjust={(delta) => adjustWidth('insurance', delta)} />
                      <div className="flex items-center gap-1">Insurance</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.fuel}px`, minWidth: `${columnWidths.fuel}px` }} onClick={() => handleSort('fuel')}>
                      <ColumnWidthControl currentWidth={columnWidths.fuel} onAdjust={(delta) => adjustWidth('fuel', delta)} />
                      <div className="flex items-center gap-1">Fuel</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.parking}px`, minWidth: `${columnWidths.parking}px` }} onClick={() => handleSort('parking')}>
                      <ColumnWidthControl currentWidth={columnWidths.parking} onAdjust={(delta) => adjustWidth('parking', delta)} />
                      <div className="flex items-center gap-1">Parking</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.trailer}px`, minWidth: `${columnWidths.trailer}px` }} onClick={() => handleSort('trailer')}>
                      <ColumnWidthControl currentWidth={columnWidths.trailer} onAdjust={(delta) => adjustWidth('trailer', delta)} />
                      <div className="flex items-center gap-1">Trailer</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.misc}px`, minWidth: `${columnWidths.misc}px` }} onClick={() => handleSort('misc')}>
                      <ColumnWidthControl currentWidth={columnWidths.misc} onAdjust={(delta) => adjustWidth('misc', delta)} />
                      <div className="flex items-center gap-1">Misc</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left cursor-pointer select-none" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.miles}px`, minWidth: `${columnWidths.miles}px` }} onClick={() => handleSort('miles')}>
                      <ColumnWidthControl currentWidth={columnWidths.miles} onAdjust={(delta) => adjustWidth('miles', delta)} />
                      <div className="flex items-center gap-1">Miles</div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left" style={{ fontSize: '11px', fontWeight: 600, color: qbColors.green, textTransform: 'uppercase', letterSpacing: '0.03em', width: `${columnWidths.pay}px`, minWidth: `${columnWidths.pay}px`, backgroundColor: qbColors.greenLight }}>
                      <ColumnWidthControl currentWidth={columnWidths.pay} onAdjust={(delta) => adjustWidth('pay', delta)} />
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: qbColors.bgWhite }}>
                  {weeks.map((week, weekIndex) => {
                    const isExpanded = expandedWeeks.has(week.weekNumber)
                    const weekTotals = getWeekTotals(week.weekNumber)
                    const hasData = weekTotals.check_amount > 0
                    // Get drivers employed during this week
                    const employedDrivers = getDriversForWeek(week.weekNumber)
                    const employedDriverIds = new Set(employedDrivers.map(d => d.id))

                    return (
                      <React.Fragment key={week.weekNumber}>
                        {/* Week Header Row - QuickBooks style */}
                        <tr
                          id={`week-${week.weekNumber}`}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderTop: `1px solid ${qbColors.borderLight}`,
                            backgroundColor: hasData ? qbColors.bgGray : qbColors.bgWhite
                          }}
                          onClick={() => toggleWeek(week.weekNumber)}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = hasData ? qbColors.bgGray : qbColors.bgWhite }}
                        >
                          <td className="px-3 py-2.5 sticky left-0 z-10" style={{ backgroundColor: 'inherit', borderRight: `1px solid ${qbColors.borderLight}` }}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" style={{ color: qbColors.textSecondary }} />
                              ) : (
                                <ChevronRight className="h-4 w-4" style={{ color: qbColors.textSecondary }} />
                              )}
                              <div className="flex flex-col">
                                <span style={{ fontSize: '13px', fontWeight: 600, color: qbColors.textPrimary }}>
                                  Week {week.weekNumber}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 400, color: qbColors.textMuted }}>
                                  {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.textSecondary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            {employedDrivers.length} drivers
                          </td>
                          <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${qbColors.borderLight}` }}></td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 600, color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            {formatCurrency(weekTotals.gross)}
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 600, color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            {formatCurrency(weekTotals.extra)}
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.dispatch_fee)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.insurance)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.fuel)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.parking)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.trailer)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            ({formatCurrency(weekTotals.misc)})
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '13px', fontWeight: 600, color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                            {weekTotals.miles.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-left" style={{ fontSize: '14px', fontWeight: 700, color: qbColors.green, backgroundColor: qbColors.greenLight }}>
                            {formatCurrency(weekTotals.check_amount)}
                          </td>
                        </tr>

                        {/* Driver Rows (shown when expanded) - QuickBooks style */}
                        {isExpanded && payrollData
                          .filter(driverData => employedDriverIds.has(driverData.driver_id))
                          .map((driverData, driverIndex) => {
                          const weekData = driverData.weeks[week.weekNumber]
                          const isEvenRow = driverIndex % 2 === 0
                          const defaultBgColor = isEvenRow ? qbColors.bgWhite : '#FAFAFA'

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="transition-colors"
                              style={{
                                borderBottom: `1px solid ${qbColors.borderLight}`,
                                backgroundColor: defaultBgColor
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F9FF' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = defaultBgColor }}
                              onContextMenu={(e) => handleContextMenu(e, week.weekNumber, driverData.driver_id)}
                            >
                              <td className="px-3 py-2 sticky left-0 z-10" style={{ backgroundColor: 'inherit', borderRight: `1px solid ${qbColors.borderLight}` }}>
                                {/* Empty for driver rows */}
                              </td>
                              <td className="px-3 py-2 pl-8" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                                {driverData.driver_name}
                              </td>
                              <td className="px-3 py-2" style={{ fontSize: '13px', color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }}>
                                <select
                                  className="w-full bg-transparent text-sm border-0 p-0 focus:ring-0 cursor-pointer"
                                  value={driverData.truck_id || ''}
                                  onChange={(e) => {
                                    const truckId = e.target.value ? parseInt(e.target.value) : null
                                    const existingSettings = driverSettings?.find((s: any) => s.driver_id === driverData.driver_id)
                                    if (existingSettings && existingSettings.id > 0) {
                                      updateDriverSettings.mutate({ driverId: driverData.driver_id, data: { truck_id: truckId } })
                                    } else {
                                      createDriverSettings.mutate({ driver_id: driverData.driver_id, truck_id: truckId })
                                    }
                                  }}
                                >
                                  <option value="">-</option>
                                  {trucks.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.truck_number}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'gross') && startEdit(week.weekNumber, driverData.driver_id, 'gross', weekData?.gross || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'gross') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.gross) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'extra') && startEdit(week.weekNumber, driverData.driver_id, 'extra', weekData?.extra || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'extra') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.extra) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') && startEdit(week.weekNumber, driverData.driver_id, 'dispatch_fee', weekData?.dispatch_fee || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.dispatch_fee > 0 ? `(${formatCurrency(weekData.dispatch_fee)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'insurance') && startEdit(week.weekNumber, driverData.driver_id, 'insurance', weekData?.insurance || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'insurance') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.insurance > 0 ? `(${formatCurrency(weekData.insurance)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'fuel') && startEdit(week.weekNumber, driverData.driver_id, 'fuel', weekData?.fuel || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'fuel') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.fuel > 0 ? `(${formatCurrency(weekData.fuel)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'parking') && startEdit(week.weekNumber, driverData.driver_id, 'parking', weekData?.parking || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'parking') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.parking > 0 ? `(${formatCurrency(weekData.parking)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'trailer') && startEdit(week.weekNumber, driverData.driver_id, 'trailer', weekData?.trailer || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'trailer') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.trailer > 0 ? `(${formatCurrency(weekData.trailer)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.red, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'misc') && startEdit(week.weekNumber, driverData.driver_id, 'misc', weekData?.misc || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'misc') ? (
                                  <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData && weekData.misc > 0 ? `(${formatCurrency(weekData.misc)})` : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left cursor-pointer hover:bg-blue-50 rounded" style={{ fontSize: '13px', color: qbColors.textPrimary, borderRight: `1px solid ${qbColors.borderLight}` }} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'miles') && startEdit(week.weekNumber, driverData.driver_id, 'miles', weekData?.miles || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'miles') ? (
                                  <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={stopEdit} onKeyDown={handleKeyDown} autoFocus className="h-7 text-sm" />
                                ) : (
                                  <span>{weekData ? weekData.miles.toLocaleString() : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-left" style={{ fontSize: '13px', fontWeight: 600, color: qbColors.green, backgroundColor: 'rgba(232, 245, 230, 0.5)' }}>
                                {weekData ? formatCurrency(weekData.check_amount) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 shadow-lg" style={{ borderTop: `2px solid ${qbColors.borderMedium}` }}>
                  <tr style={{ backgroundColor: qbColors.bgGray }}>
                    <td className="px-3 py-3 sticky left-0" style={{ fontSize: '13px', fontWeight: 700, color: qbColors.textPrimary, backgroundColor: qbColors.bgGray }}>Annual Total</td>
                    <td className="px-3 py-3" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.textSecondary }}>{payrollData.length} drivers</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 700, color: qbColors.textPrimary }}>
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 700, color: qbColors.textPrimary }}>
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.dispatch_fee)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.insurance)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.fuel)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.parking)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.trailer)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 500, color: qbColors.red }}>
                      ({formatCurrency(grandTotals.misc)})
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '13px', fontWeight: 700, color: qbColors.textPrimary }}>
                      {grandTotals.miles.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-left" style={{ fontSize: '15px', fontWeight: 700, color: qbColors.green, backgroundColor: qbColors.greenLight }}>
                      {formatCurrency(grandTotals.check_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
