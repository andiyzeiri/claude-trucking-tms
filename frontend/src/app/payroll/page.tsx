'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ChevronRight, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, Copy, RefreshCw, Settings } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { useColumnWidths } from '@/hooks/use-column-widths'
import { ColumnWidthControl } from '@/components/ui/column-width-control'
import { DriverSettingsModal } from '@/components/payroll/driver-settings-modal'

// Fuel data storage key (same as fuel page)
const FUEL_STORAGE_KEY = 'tms-fuel-data'
// Payroll overrides storage key
const PAYROLL_OVERRIDES_KEY = 'tms-payroll-overrides'

// Type for payroll field overrides
interface PayrollOverride {
  gross?: number
  extra?: number
  dispatch_fee?: number
  insurance?: number
  fuel?: number
  parking?: number
  trailer?: number
  misc?: number
  miles?: number
}

// Map key is "weekNumber-driverId"
type PayrollOverrides = Record<string, PayrollOverride>

interface FuelEntry {
  id: string
  weekNumber: number
  driverId: number
  truckId: number | null
  gallons: number
  pricePerGallon: number
  defGallons: number
  defPrice: number
  totalAmount: number
}

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
  const drivers = driversData?.items || []
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
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([])
  const [payrollOverrides, setPayrollOverrides] = useState<PayrollOverrides>({})
  const [editValue, setEditValue] = useState<string>('')

  // Load fuel data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(FUEL_STORAGE_KEY)
    if (stored) {
      try {
        setFuelEntries(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load fuel data:', e)
      }
    }
  }, [])

  // Load payroll overrides from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(PAYROLL_OVERRIDES_KEY)
    if (stored) {
      try {
        setPayrollOverrides(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load payroll overrides:', e)
      }
    }
  }, [])

  // Save payroll overrides to localStorage
  const saveOverride = (weekNumber: number, driverId: number, field: string, value: number) => {
    const key = `${weekNumber}-${driverId}`
    setPayrollOverrides(prev => {
      const newOverrides = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value
        }
      }
      localStorage.setItem(PAYROLL_OVERRIDES_KEY, JSON.stringify(newOverrides))
      return newOverrides
    })
  }

  // Get override value for a specific field
  const getOverride = (weekNumber: number, driverId: number, field: keyof PayrollOverride): number | undefined => {
    const key = `${weekNumber}-${driverId}`
    return payrollOverrides[key]?.[field]
  }

  // Create a map of fuel totals by week and driver
  const fuelByWeekAndDriver = useMemo(() => {
    const map: Record<number, Record<number, number>> = {}
    fuelEntries.forEach(entry => {
      if (!map[entry.weekNumber]) {
        map[entry.weekNumber] = {}
      }
      if (!map[entry.weekNumber][entry.driverId]) {
        map[entry.weekNumber][entry.driverId] = 0
      }
      map[entry.weekNumber][entry.driverId] += entry.totalAmount || 0
    })
    return map
  }, [fuelEntries])

  const isLoading = driversLoading || payrollLoading

  // Column width management
  const { columnWidths, adjustWidth } = useColumnWidths('payroll-table', {
    week: 300,
    driver: 200,
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
    // Create a map from driver ID to driver data
    const driverMap = new Map(
      drivers.map(driver => [
        driver.id,
        {
          driver_id: driver.id,
          driver_name: `${driver.first_name} ${driver.last_name}`,
          weeks: {} as DriverPayrollData['weeks']
        }
      ])
    )

    // Populate weeks data from calculated payroll
    if (calculatedPayroll && Array.isArray(calculatedPayroll)) {
      calculatedPayroll.forEach(entry => {
        if (!entry || typeof entry.driver_id !== 'number' || typeof entry.week_number !== 'number') {
          console.warn('Invalid payroll entry:', entry)
          return
        }

        const driverData = driverMap.get(entry.driver_id)
        if (driverData) {
          const weekNumber = entry.week_number
          const driverId = entry.driver_id

          // Get fuel amount for this driver/week from localStorage
          const fuelFromStorage = fuelByWeekAndDriver[weekNumber]?.[driverId] || 0

          // Apply overrides if they exist, otherwise use calculated values
          const grossOverride = getOverride(weekNumber, driverId, 'gross')
          const gross = grossOverride !== undefined ? grossOverride : (Number(entry.gross) || 0)
          const extraOverride = getOverride(weekNumber, driverId, 'extra')
          const extra = extraOverride !== undefined ? extraOverride : (Number(entry.extra) || 0)
          const dispatchFeeOverride = getOverride(weekNumber, driverId, 'dispatch_fee')
          const dispatch_fee = dispatchFeeOverride !== undefined ? dispatchFeeOverride : (Number(entry.dispatch_fee) || 0)
          const insuranceOverride = getOverride(weekNumber, driverId, 'insurance')
          const insurance = insuranceOverride !== undefined ? insuranceOverride : (Number(entry.insurance) || 0)
          const fuelOverride = getOverride(weekNumber, driverId, 'fuel')
          const fuel = fuelOverride !== undefined ? fuelOverride : fuelFromStorage
          const parkingOverride = getOverride(weekNumber, driverId, 'parking')
          const parking = parkingOverride !== undefined ? parkingOverride : (Number(entry.parking) || 0)
          const trailerOverride = getOverride(weekNumber, driverId, 'trailer')
          const trailer = trailerOverride !== undefined ? trailerOverride : (Number(entry.trailer) || 0)
          const miscOverride = getOverride(weekNumber, driverId, 'misc')
          const misc = miscOverride !== undefined ? miscOverride : (Number(entry.misc) || 0)
          const milesOverride = getOverride(weekNumber, driverId, 'miles')
          const miles = milesOverride !== undefined ? milesOverride : (Number(entry.miles) || 0)

          // Check amount = gross + extra - deductions (dispatch_fee, insurance, fuel, parking, trailer, misc)
          const check_amount = gross + extra - dispatch_fee - insurance - fuel - parking - trailer - misc

          driverData.weeks[weekNumber] = {
            gross,
            extra,
            dispatch_fee,
            insurance,
            fuel,
            parking,
            trailer,
            misc,
            miles,
            check_amount
          }
        }
      })
    }

    // Also add fuel data for weeks/drivers that don't have payroll entries yet
    Object.entries(fuelByWeekAndDriver).forEach(([weekNumStr, driverFuels]) => {
      const weekNumber = parseInt(weekNumStr)
      Object.entries(driverFuels).forEach(([driverIdStr, fuelAmount]) => {
        const driverId = parseInt(driverIdStr)
        const driverData = driverMap.get(driverId)
        if (driverData && !driverData.weeks[weekNumber]) {
          // Apply overrides if they exist
          const gross = getOverride(weekNumber, driverId, 'gross') ?? 0
          const extra = getOverride(weekNumber, driverId, 'extra') ?? 0
          const dispatch_fee = getOverride(weekNumber, driverId, 'dispatch_fee') ?? 0
          const insurance = getOverride(weekNumber, driverId, 'insurance') ?? 0
          const fuel = getOverride(weekNumber, driverId, 'fuel') ?? fuelAmount
          const parking = getOverride(weekNumber, driverId, 'parking') ?? 0
          const trailer = getOverride(weekNumber, driverId, 'trailer') ?? 0
          const misc = getOverride(weekNumber, driverId, 'misc') ?? 0
          const miles = getOverride(weekNumber, driverId, 'miles') ?? 0

          const check_amount = gross + extra - dispatch_fee - insurance - fuel - parking - trailer - misc

          driverData.weeks[weekNumber] = {
            gross,
            extra,
            dispatch_fee,
            insurance,
            fuel,
            parking,
            trailer,
            misc,
            miles,
            check_amount
          }
        }
      })
    })

    // Also create entries for weeks with overrides but no calculated data
    Object.entries(payrollOverrides).forEach(([key, overrides]) => {
      const [weekNumStr, driverIdStr] = key.split('-')
      const weekNumber = parseInt(weekNumStr)
      const driverId = parseInt(driverIdStr)
      const driverData = driverMap.get(driverId)

      if (driverData && !driverData.weeks[weekNumber]) {
        const gross = overrides.gross ?? 0
        const extra = overrides.extra ?? 0
        const dispatch_fee = overrides.dispatch_fee ?? 0
        const insurance = overrides.insurance ?? 0
        const fuel = overrides.fuel ?? 0
        const parking = overrides.parking ?? 0
        const trailer = overrides.trailer ?? 0
        const misc = overrides.misc ?? 0
        const miles = overrides.miles ?? 0

        const check_amount = gross + extra - dispatch_fee - insurance - fuel - parking - trailer - misc

        driverData.weeks[weekNumber] = {
          gross,
          extra,
          dispatch_fee,
          insurance,
          fuel,
          parking,
          trailer,
          misc,
          miles,
          check_amount
        }
      }
    })

    return Array.from(driverMap.values())
  }, [drivers, calculatedPayroll, fuelByWeekAndDriver, payrollOverrides])

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
    if (editingCell) {
      const value = parseFloat(editValue) || 0
      saveOverride(editingCell.weekNumber, editingCell.driverId, editingCell.field, value)
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
      <div className="page-payroll space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Payroll</h1>
            <p className="text-slate-500">52-week driver payroll overview (auto-calculated from loads)</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setSettingsModalOpen(true)} variant="default">
              <Settings className="h-4 w-4 mr-2" />
              Driver Settings
            </Button>
            <Button onClick={() => refetchPayroll()} variant="outline" disabled={payrollLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${payrollLoading ? 'animate-spin' : ''}`} />
              Refresh from Loads
            </Button>
            <Button onClick={goToCurrentWeek} variant="outline">
              Go to Current Week
            </Button>
            <Button onClick={expandAll} variant="outline">
              Expand All
            </Button>
            <Button onClick={collapseAll} variant="outline">
              Collapse All
            </Button>
          </div>
        </div>

        {/* Year Tabs */}
        <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className="px-4 py-2 text-sm font-medium transition-all relative"
              style={{
                color: selectedYear === year ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
                borderBottom: selectedYear === year ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              {year}
              {year === new Date().getFullYear() && (
                <span className="ml-1 text-xs opacity-60">(Current)</span>
              )}
            </button>
          ))}
        </div>

        {/* Grand Totals Summary */}
        {drivers.length > 0 && (
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider min-w-[300px]">
                      52-Week Totals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider min-w-[200px]">
                      All Drivers
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Extra
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[110px]">
                      Dispatch Fee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Insurance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Parking
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Trailer
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]">
                      Misc
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[90px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[120px]">
                      Total Pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                      Year 2025
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-500">
                      {payrollData.length} drivers
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.dispatch_fee)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.insurance)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.fuel)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.parking)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.trailer)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.misc)}
                    </td>
                    <td className="px-4 py-4 text-base font-semibold text-right text-slate-700">
                      {grandTotals.miles.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-lg font-bold text-right text-emerald-600">
                      {formatCurrency(grandTotals.check_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payroll Table */}
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Drivers</h2>
              <p className="text-gray-600">Add drivers to start tracking payroll.</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                  <tr>
                    <th className="relative group px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none sticky left-0 z-10" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, backgroundColor: 'var(--cell-background-header)', width: `${columnWidths.week}px`, minWidth: `${columnWidths.week}px`}} onClick={() => handleSort('weekNumber')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.week}
                        onAdjust={(delta) => adjustWidth('week', delta)}
                      />
                      <div className="flex items-center gap-1">
                        Week
                        {sortField === 'weekNumber' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.driver}px`, minWidth: `${columnWidths.driver}px`}} onClick={() => handleSort('driver')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.driver}
                        onAdjust={(delta) => adjustWidth('driver', delta)}
                      />
                      <div className="flex items-center gap-1">
                        Driver
                        {sortField === 'driver' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.gross}px`, minWidth: `${columnWidths.gross}px`}} onClick={() => handleSort('gross')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.gross}
                        onAdjust={(delta) => adjustWidth('gross', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Gross
                        {sortField === 'gross' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.extra}px`, minWidth: `${columnWidths.extra}px`}} onClick={() => handleSort('extra')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.extra}
                        onAdjust={(delta) => adjustWidth('extra', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Extra
                        {sortField === 'extra' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.dispatch_fee}px`, minWidth: `${columnWidths.dispatch_fee}px`}} onClick={() => handleSort('dispatch_fee')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.dispatch_fee}
                        onAdjust={(delta) => adjustWidth('dispatch_fee', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Dispatch Fee
                        {sortField === 'dispatch_fee' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.insurance}px`, minWidth: `${columnWidths.insurance}px`}} onClick={() => handleSort('insurance')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.insurance}
                        onAdjust={(delta) => adjustWidth('insurance', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Insurance
                        {sortField === 'insurance' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.fuel}px`, minWidth: `${columnWidths.fuel}px`}} onClick={() => handleSort('fuel')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.fuel}
                        onAdjust={(delta) => adjustWidth('fuel', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Fuel
                        {sortField === 'fuel' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.parking}px`, minWidth: `${columnWidths.parking}px`}} onClick={() => handleSort('parking')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.parking}
                        onAdjust={(delta) => adjustWidth('parking', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Parking
                        {sortField === 'parking' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.trailer}px`, minWidth: `${columnWidths.trailer}px`}} onClick={() => handleSort('trailer')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.trailer}
                        onAdjust={(delta) => adjustWidth('trailer', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Trailer
                        {sortField === 'trailer' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.misc}px`, minWidth: `${columnWidths.misc}px`}} onClick={() => handleSort('misc')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.misc}
                        onAdjust={(delta) => adjustWidth('misc', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Misc
                        {sortField === 'misc' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.miles}px`, minWidth: `${columnWidths.miles}px`}} onClick={() => handleSort('miles')}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.miles}
                        onAdjust={(delta) => adjustWidth('miles', delta)}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        Miles
                        {sortField === 'miles' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="relative group px-3 py-2.5 text-right text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, width: `${columnWidths.pay}px`, minWidth: `${columnWidths.pay}px`, backgroundColor: 'var(--cell-background-highlight)'}}>
                      <ColumnWidthControl
                        currentWidth={columnWidths.pay}
                        onAdjust={(delta) => adjustWidth('pay', delta)}
                      />
                      Pay
                    </th>
                  </tr>
                </thead>
                <tbody style={{backgroundColor: 'var(--cell-background-base)'}}>
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
                          className="border-t-2 cursor-pointer transition-colors"
                          style={{
                            borderColor: 'var(--cell-borderColor)',
                            backgroundColor: hasData ? 'rgba(99, 102, 241, 0.08)' : 'rgba(241, 245, 249, 0.8)'
                          }}
                          onClick={() => toggleWeek(week.weekNumber)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.12)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = hasData ? 'rgba(99, 102, 241, 0.08)' : 'rgba(241, 245, 249, 0.8)'
                          }}
                        >
                          <td className="px-3 py-2.5 border-r sticky left-0 z-10" style={{borderColor: 'var(--cell-borderColor)', backgroundColor: 'inherit'}}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" style={{color: 'var(--colors-foreground-muted)'}} />
                              ) : (
                                <ChevronRight className="h-4 w-4" style={{color: 'var(--colors-foreground-muted)'}} />
                              )}
                              <div className="flex flex-col">
                                <span style={{fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                                  Week {week.weekNumber}
                                </span>
                                <span style={{fontSize: '11px', fontWeight: 400, color: 'var(--colors-foreground-muted)', lineHeight: '16px'}}>
                                  {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-muted)'}}>
                            {employedDrivers.length} drivers
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#334155'}}>
                            {formatCurrency(weekTotals.gross)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#334155'}}>
                            {formatCurrency(weekTotals.extra)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.dispatch_fee)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.insurance)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.fuel)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.parking)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.trailer)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#f87171'}}>
                            {formatCurrency(-weekTotals.misc)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: '#334155'}}>
                            {weekTotals.miles.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right" style={{fontSize: '14px', fontWeight: 700, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.08)'}}>
                            {formatCurrency(weekTotals.check_amount)}
                          </td>
                        </tr>

                        {/* Driver Rows (shown when expanded) - only show drivers employed during this week */}
                        {isExpanded && payrollData
                          .filter(driverData => employedDriverIds.has(driverData.driver_id))
                          .map((driverData, driverIndex) => {
                          const weekData = driverData.weeks[week.weekNumber]
                          const rowIndex = weekIndex * employedDrivers.length + driverIndex
                          const isEvenRow = rowIndex % 2 === 0
                          const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="border-b transition-colors"
                              style={{
                                borderColor: 'var(--cell-borderColor)',
                                backgroundColor: defaultBgColor
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--row-background-cursor)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = defaultBgColor
                              }}
                              onContextMenu={(e) => handleContextMenu(e, week.weekNumber, driverData.driver_id)}
                            >
                              <td className="px-3 py-2.5 border-r sticky left-0 z-10" style={{borderColor: 'var(--cell-borderColor)', backgroundColor: 'inherit'}}>
                                {/* Empty for driver rows */}
                              </td>
                              <td className="px-3 py-2.5 border-r pl-8" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 500, color: '#475569'}}>
                                {driverData.driver_name}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'gross') && startEdit(week.weekNumber, driverData.driver_id, 'gross', weekData?.gross || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'gross') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.gross) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'extra') && startEdit(week.weekNumber, driverData.driver_id, 'extra', weekData?.extra || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'extra') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.extra) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') && startEdit(week.weekNumber, driverData.driver_id, 'dispatch_fee', weekData?.dispatch_fee || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.dispatch_fee) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'insurance') && startEdit(week.weekNumber, driverData.driver_id, 'insurance', weekData?.insurance || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'insurance') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.insurance) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'fuel') && startEdit(week.weekNumber, driverData.driver_id, 'fuel', weekData?.fuel || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'fuel') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.fuel) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'parking') && startEdit(week.weekNumber, driverData.driver_id, 'parking', weekData?.parking || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'parking') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.parking) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'trailer') && startEdit(week.weekNumber, driverData.driver_id, 'trailer', weekData?.trailer || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'trailer') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.trailer) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: '#f87171'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'misc') && startEdit(week.weekNumber, driverData.driver_id, 'misc', weekData?.misc || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'misc') ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(-weekData.misc) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-slate-100 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => !isEditing(week.weekNumber, driverData.driver_id, 'miles') && startEdit(week.weekNumber, driverData.driver_id, 'miles', weekData?.miles || 0)}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'miles') ? (
                                  <Input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={stopEdit}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? weekData.miles.toLocaleString() : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right" style={{fontSize: '13px', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.06)'}}>
                                {weekData ? formatCurrency(weekData.check_amount) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white border-t-2 shadow-lg" style={{borderColor: 'var(--cell-borderColor)'}}>
                  <tr className="bg-slate-100">
                    <td className="px-3 py-2.5 text-sm font-semibold sticky left-0 bg-slate-100 text-slate-700">52 Weeks</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-500">{payrollData.length} drivers</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-right text-slate-700">
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.dispatch_fee)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.insurance)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.fuel)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.parking)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.trailer)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-300">
                      {formatCurrency(-grandTotals.misc)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-right text-slate-600">
                      {grandTotals.miles.toLocaleString()} mi
                    </td>
                    <td className="px-3 py-2.5 text-lg font-bold text-right text-emerald-600">
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
