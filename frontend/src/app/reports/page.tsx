'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Download, Search, ChevronRight, ChevronDown, TrendingUp, Users, Truck, Calendar } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'
import { useDrivers } from '@/hooks/use-drivers'
import { useExpenses } from '@/hooks/use-expenses'
import { useFuel } from '@/hooks/use-fuel'
import { useTrucks } from '@/hooks/use-trucks'
import { useDriverPayrollSettings, useUpdateDriverPayrollSettings, useCreateOrUpdateDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
import { useCalculatedPayroll } from '@/hooks/use-payroll'
import { Driver } from '@/types'

// Helper to safely convert to number, defaulting to 0 for NaN/null/undefined
function safeNumber(value: any): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

// Backend returns datetimes without timezone (e.g., "2024-12-28T14:00:00")
// JavaScript would parse these as local time, so we append 'Z' to force UTC
function normalizeDateTime(dateString: string): string {
  if (!dateString) return dateString
  // If already has timezone info (Z or +/-offset), return as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return dateString
  }
  // Append Z to treat as UTC
  return dateString + 'Z'
}

// Helper to get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  // Use UTC methods to get the date components (we store wall-clock time as UTC)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  return weekNum
}

// Helper to get ISO week year (the year the week belongs to)
function getISOWeekYear(date: Date): number {
  // Use UTC methods to get the date components (we store wall-clock time as UTC)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

// Helper to get week date range
function getWeekDateRange(date: Date): string {
  // Use UTC methods to avoid timezone conversion (we store wall-clock time as UTC)
  const dayOfWeek = date.getUTCDay()
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diffToMonday))

  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6))

  const startMonth = monday.getUTCMonth() + 1
  const startDay = monday.getUTCDate()
  const endMonth = sunday.getUTCMonth() + 1
  const endDay = sunday.getUTCDate()

  return `${startMonth}/${startDay}-${endMonth}/${endDay}`
}

// Helper function to check if a driver was employed during a specific year
function wasEmployedDuringYear(driver: Driver, year: number): boolean {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  const hireDate = driver.date_hired ? new Date(normalizeDateTime(driver.date_hired)) : null
  const terminationDate = driver.date_terminated ? new Date(normalizeDateTime(driver.date_terminated)) : null

  const hiredBeforeYearEnd = !hireDate || hireDate <= yearEnd
  const notTerminatedBeforeYearStart = !terminationDate || terminationDate >= yearStart

  return hiredBeforeYearEnd && notTerminatedBeforeYearStart
}

interface WeekData {
  weekKey: string
  weekLabel: string
  weekDateRange: string
  weekNumber: number
  gross: number
  miles: number
  expenses: number
  profit: number
  loadCount: number
}

interface DriverReportData {
  driver_id: number
  driver_name: string
  driver_type: 'company' | 'owner_operator'
  wasEmployed: boolean
  weeks: WeekData[]
  totals: {
    gross: number
    miles: number
    expenses: number
    profit: number
    loadCount: number
  }
}

interface ExpenseEntry {
  id: number
  date: string
  category: string
  cost_type: string
  description: string
  amount: number
  vendor: string
  driver_id: number | null
  truck_id: number | null
}

type TabType = 'drivers' | 'owners' | 'expenses'

export default function ReportsPage() {
  // Fetch ALL data - use large limit to get everything
  const { data: loadsData, isLoading: loadsLoading } = useLoads(1, 10000)
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(1, 10000)
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const { data: trucksData } = useTrucks()
  const { data: driverSettingsData } = useDriverPayrollSettings()
  const updateDriverSettings = useUpdateDriverPayrollSettings()
  const createDriverSettings = useCreateOrUpdateDriverPayrollSettings()

  const loads = loadsData?.items || []
  const drivers = driversData?.items || []
  const expenses = expensesData?.items || []
  const fuel = fuelData || []
  const trucks = (trucksData?.items || []).filter((t: any) => t.type === 'truck')

  const [activeTab, setActiveTab] = useState<TabType>('drivers')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const { data: calculatedPayroll } = useCalculatedPayroll(selectedYear)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedDrivers, setExpandedDrivers] = useState<Set<number>>(new Set())

  const isLoading = loadsLoading || driversLoading || expensesLoading || fuelLoading

  // Get available years from loads data
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    years.add(currentYear) // Always include current year

    loads.forEach(load => {
      if (load.pickup_date) {
        const loadDate = new Date(normalizeDateTime(load.pickup_date))
        if (!isNaN(loadDate.getTime())) {
          const isoYear = getISOWeekYear(loadDate)
          if (!isNaN(isoYear)) {
            years.add(isoYear)
          }
        }
      }
    })

    expenses.forEach(expense => {
      if (expense.date) {
        const expenseDate = new Date(normalizeDateTime(expense.date))
        if (!isNaN(expenseDate.getTime())) {
          const year = expenseDate.getUTCFullYear()
          if (!isNaN(year)) {
            years.add(year)
          }
        }
      }
    })

    fuel.forEach(f => {
      if (f.date) {
        const fuelDate = new Date(normalizeDateTime(f.date))
        if (!isNaN(fuelDate.getTime())) {
          const year = fuelDate.getUTCFullYear()
          if (!isNaN(year)) {
            years.add(year)
          }
        }
      }
    })

    // Filter out any NaN values and sort descending (newest first)
    return Array.from(years).filter(y => !isNaN(y)).sort((a, b) => b - a)
  }, [loads, expenses, fuel])

  // Build expense lookup by driver and week (filtered by year)
  const expensesByDriverWeek = useMemo(() => {
    const map = new Map<string, number>()

    // Add expenses
    expenses.forEach(expense => {
      if (!expense.driver_id || !expense.date) return
      const expenseDate = new Date(normalizeDateTime(expense.date))
      if (isNaN(expenseDate.getTime())) return
      const isoYear = getISOWeekYear(expenseDate)
      const weekNum = getWeekNumber(expenseDate)
      if (isNaN(isoYear) || isoYear !== selectedYear) return
      const key = `${expense.driver_id}-${isoYear}-${weekNum}`
      map.set(key, (map.get(key) || 0) + safeNumber(expense.amount))
    })

    // Add fuel
    fuel.forEach(f => {
      if (!f.driver_id || !f.date) return
      const fuelDate = new Date(normalizeDateTime(f.date))
      if (isNaN(fuelDate.getTime())) return
      const isoYear = getISOWeekYear(fuelDate)
      const weekNum = getWeekNumber(fuelDate)
      if (isNaN(isoYear) || isoYear !== selectedYear) return
      const key = `${f.driver_id}-${isoYear}-${weekNum}`
      map.set(key, (map.get(key) || 0) + safeNumber(f.total_amount))
    })

    return map
  }, [expenses, fuel, selectedYear])

  // Process data grouped by driver and week (filtered by year)
  const reportData = useMemo(() => {
    const driverMap = new Map<number, DriverReportData>()

    // Initialize with all drivers, checking employment status
    drivers.forEach(driver => {
      const wasEmployed = wasEmployedDuringYear(driver, selectedYear)
      driverMap.set(driver.id, {
        driver_id: driver.id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        driver_type: driver.driver_type || 'company',
        wasEmployed,
        weeks: [],
        totals: { gross: 0, miles: 0, expenses: 0, profit: 0, loadCount: 0 }
      })
    })

    // Group loads by driver and week
    const weekMap = new Map<string, WeekData>()

    loads.forEach(load => {
      if (!load.driver_id || !load.pickup_date) return

      const loadDate = new Date(normalizeDateTime(load.pickup_date))
      if (isNaN(loadDate.getTime())) return

      const isoYear = getISOWeekYear(loadDate)
      const weekNum = getWeekNumber(loadDate)

      // Filter by selected year (also check for NaN)
      if (isNaN(isoYear) || isoYear !== selectedYear) return

      const weekDateRange = getWeekDateRange(loadDate)
      const driverWeekKey = `${load.driver_id}-${isoYear}-${weekNum}`

      if (!weekMap.has(driverWeekKey)) {
        weekMap.set(driverWeekKey, {
          weekKey: `${isoYear}-W${String(weekNum).padStart(2, '0')}`,
          weekLabel: `Week ${weekNum}`,
          weekDateRange: weekDateRange,
          weekNumber: weekNum,
          gross: 0,
          miles: 0,
          expenses: 0,
          profit: 0,
          loadCount: 0
        })
      }

      const weekData = weekMap.get(driverWeekKey)!
      weekData.gross += safeNumber(load.rate)
      weekData.miles += safeNumber(load.miles)
      weekData.loadCount += 1
    })

    // Add expense data to weeks and build driver data
    weekMap.forEach((weekData, key) => {
      const [driverIdStr, year, week] = key.split('-')
      const driverId = parseInt(driverIdStr)
      const expenseKey = `${driverId}-${year}-${week}`
      weekData.expenses = expensesByDriverWeek.get(expenseKey) || 0
      weekData.profit = weekData.gross - weekData.expenses

      const driverData = driverMap.get(driverId)
      if (driverData) {
        driverData.weeks.push(weekData)
        driverData.totals.gross += weekData.gross
        driverData.totals.miles += weekData.miles
        driverData.totals.expenses += weekData.expenses
        driverData.totals.profit += weekData.profit
        driverData.totals.loadCount += weekData.loadCount
      }
    })

    // Sort weeks within each driver (by week number, descending)
    driverMap.forEach(driverData => {
      driverData.weeks.sort((a, b) => b.weekNumber - a.weekNumber)
    })

    return Array.from(driverMap.values())
  }, [loads, drivers, expensesByDriverWeek, selectedYear])

  // Build fuel data per driver (via truck assignment from settings)
  const fuelByDriver = useMemo(() => {
    const settingsMap = new Map<number, any>()
    if (driverSettingsData) driverSettingsData.forEach((s: any) => settingsMap.set(s.driver_id, s))

    // Aggregate fuel by truck for the year
    const fuelByTruck = new Map<number, { totalAmount: number; totalMiles: number }>()
    const fuelEntriesByTruck = new Map<number, Array<{ odometer: number; weekYear: number; weekNum: number }>>()

    fuel.forEach((fe: any) => {
      if (!fe.date || !fe.truck_id) return
      const fDate = new Date(fe.date + 'T00:00:00')
      const d = new Date(Date.UTC(fDate.getFullYear(), fDate.getMonth(), fDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const fYear = d.getUTCFullYear()
      if (fYear !== selectedYear) return

      const amount = (Number(fe.total_amount) || 0) + (Number(fe.def_price) || 0)
      const existing = fuelByTruck.get(fe.truck_id) || { totalAmount: 0, totalMiles: 0 }
      existing.totalAmount += amount
      fuelByTruck.set(fe.truck_id, existing)

      if (fe.odometer) {
        if (!fuelEntriesByTruck.has(fe.truck_id)) fuelEntriesByTruck.set(fe.truck_id, [])
        fuelEntriesByTruck.get(fe.truck_id)!.push({ odometer: Number(fe.odometer), weekYear: fYear, weekNum: 0 })
      }
    })

    // Calculate miles from odometer (max - min)
    fuelEntriesByTruck.forEach((entries, truckId) => {
      if (entries.length > 1) {
        const odoms = entries.map(e => e.odometer)
        const miles = Math.max(...odoms) - Math.min(...odoms)
        const existing = fuelByTruck.get(truckId)
        if (existing) existing.totalMiles = miles
      }
    })

    // Map to drivers via settings truck assignment
    const result = new Map<number, { fuelTotal: number; fuelMiles: number; pricePerMile: number }>()
    drivers.forEach((driver: any) => {
      const settings = settingsMap.get(driver.id)
      if (settings?.truck_id) {
        const truckData = fuelByTruck.get(settings.truck_id)
        if (truckData) {
          result.set(driver.id, {
            fuelTotal: truckData.totalAmount,
            fuelMiles: truckData.totalMiles,
            pricePerMile: truckData.totalMiles > 0 ? truckData.totalAmount / truckData.totalMiles : 0
          })
        }
      }
    })
    return result
  }, [fuel, drivers, driverSettingsData, selectedYear])

  // Settings lookup for pay type/rate
  const settingsMap = useMemo(() => {
    const map = new Map<number, any>()
    if (driverSettingsData) driverSettingsData.forEach((s: any) => map.set(s.driver_id, s))
    return map
  }, [driverSettingsData])

  // Aggregate payroll data per driver for the year (adjusted gross, deductions)
  const payrollByDriver = useMemo(() => {
    const map = new Map<number, { adjustedGross: number; insurance: number; insuranceWeeks: number; parking: number; trailer: number; misc: number; dispatch: number; netPay: number }>()
    if (calculatedPayroll && Array.isArray(calculatedPayroll)) {
      calculatedPayroll.forEach((entry: any) => {
        if (!entry?.driver_id) return
        const existing = map.get(entry.driver_id) || { adjustedGross: 0, insurance: 0, insuranceWeeks: 0, parking: 0, trailer: 0, misc: 0, dispatch: 0, netPay: 0 }
        existing.adjustedGross += Number(entry.gross) || 0
        const insAmt = Number(entry.insurance) || 0
        existing.insurance += insAmt
        if (insAmt > 0) existing.insuranceWeeks += 1
        existing.parking += Number(entry.parking) || 0
        existing.trailer += Number(entry.trailer) || 0
        existing.misc += Number(entry.misc) || 0
        existing.dispatch += Number(entry.dispatch_fee) || 0
        existing.netPay += Number(entry.check_amount) || 0
        map.set(entry.driver_id, existing)
      })
    }
    return map
  }, [calculatedPayroll])

  // Build expense report data grouped by driver type, then by category/week
  const expenseReportData = useMemo(() => {
    // Group expenses by category for the selected year
    const byCategory = new Map<string, { total: number; entries: ExpenseEntry[] }>()
    let totalAmount = 0

    expenses.forEach((exp: any) => {
      if (!exp.date) return
      const expDate = new Date(exp.date + 'T00:00:00')
      const d = new Date(Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const expYear = d.getUTCFullYear()
      if (expYear !== selectedYear) return

      const cat = exp.category || 'Uncategorized'
      const amount = Number(exp.amount) || 0
      if (!byCategory.has(cat)) {
        byCategory.set(cat, { total: 0, entries: [] })
      }
      const catData = byCategory.get(cat)!
      catData.total += amount
      catData.entries.push({
        id: exp.id,
        date: exp.date,
        category: cat,
        cost_type: exp.cost_type || 'variable',
        description: exp.description || '',
        amount,
        vendor: exp.vendor || '',
        driver_id: exp.driver_id,
        truck_id: exp.truck_id
      })
      totalAmount += amount
    })

    // Also add fuel as a category
    let fuelTotal = 0
    const fuelEntries: ExpenseEntry[] = []
    fuel.forEach((fe: any) => {
      if (!fe.date) return
      const fDate = new Date(fe.date + 'T00:00:00')
      const d = new Date(Date.UTC(fDate.getFullYear(), fDate.getMonth(), fDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const fYear = d.getUTCFullYear()
      if (fYear !== selectedYear) return

      const amount = (Number(fe.total_amount) || 0) + (Number(fe.def_price) || 0)
      if (amount > 0) {
        fuelTotal += amount
        fuelEntries.push({
          id: fe.id,
          date: fe.date,
          category: 'Fuel',
          cost_type: 'variable',
          description: fe.location || 'Fuel',
          amount,
          vendor: fe.location || '',
          driver_id: fe.driver_id,
          truck_id: fe.truck_id
        })
      }
    })
    if (fuelEntries.length > 0) {
      byCategory.set('Fuel', { total: fuelTotal, entries: fuelEntries })
      totalAmount += fuelTotal
    }

    return {
      categories: Array.from(byCategory.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      totalAmount
    }
  }, [expenses, fuel, selectedYear])

  // Filter by tab and search - show all drivers who were employed during the year
  const filteredData = useMemo(() => {
    return reportData
      .filter(d => {
        // Expenses tab shows all drivers
        if (activeTab === 'expenses') return false
        // Filter by tab
        if (activeTab === 'drivers' && d.driver_type !== 'company') return false
        if (activeTab === 'owners' && d.driver_type !== 'owner_operator') return false

        // Filter by search
        if (searchTerm && !d.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false
        }

        // Show all drivers who were employed during the selected year
        return d.wasEmployed
      })
      .sort((a, b) => a.driver_name.localeCompare(b.driver_name))
  }, [reportData, activeTab, searchTerm])

  // Calculate grand totals for current tab and year
  const grandTotals = useMemo(() => {
    return filteredData.reduce((acc, driver) => ({
      gross: acc.gross + driver.totals.gross,
      miles: acc.miles + driver.totals.miles,
      expenses: acc.expenses + driver.totals.expenses,
      profit: acc.profit + driver.totals.profit,
      loadCount: acc.loadCount + driver.totals.loadCount
    }), { gross: 0, miles: 0, expenses: 0, profit: 0, loadCount: 0 })
  }, [filteredData])

  const toggleDriver = (driverId: number) => {
    const newExpanded = new Set(expandedDrivers)
    if (newExpanded.has(driverId)) {
      newExpanded.delete(driverId)
    } else {
      newExpanded.add(driverId)
    }
    setExpandedDrivers(newExpanded)
  }

  const expandAll = () => {
    const allDriverIds = new Set(filteredData.map(d => d.driver_id))
    setExpandedDrivers(allDriverIds)
  }

  const collapseAll = () => {
    setExpandedDrivers(new Set())
  }

  // Export to CSV
  const exportToCSV = () => {
    const rows: string[] = ['Driver,Type,Year,Week,Gross,Miles,Expenses,Profit']

    filteredData.forEach(driver => {
      if (driver.weeks.length === 0) {
        // Include drivers with no loads
        rows.push([
          driver.driver_name,
          driver.driver_type === 'owner_operator' ? 'Owner Operator' : 'Company',
          selectedYear,
          'No loads',
          '0.00',
          '0',
          '0.00',
          '0.00'
        ].join(','))
      } else {
        driver.weeks.forEach(week => {
          rows.push([
            driver.driver_name,
            driver.driver_type === 'owner_operator' ? 'Owner Operator' : 'Company',
            selectedYear,
            week.weekLabel,
            week.gross.toFixed(2),
            week.miles,
            week.expenses.toFixed(2),
            week.profit.toFixed(2)
          ].join(','))
        })
      }
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-report-${selectedYear}-${Date.now()}.csv`
    a.click()
  }

  // Format number safely (avoid NaN display)
  const formatNumber = (num: number): string => {
    const safe = safeNumber(num)
    return safe.toLocaleString()
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="page-reports space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">Loading reports...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-reports space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <p className="text-gray-600">Financial reports grouped by driver and week</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={expandAll} variant="outline">
              Expand All
            </Button>
            <Button onClick={collapseAll} variant="outline">
              Collapse All
            </Button>
            <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Year Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex gap-1">
          <Calendar className="h-5 w-5 text-gray-400 my-auto mx-2" />
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                selectedYear === year
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Driver/Owner Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'drivers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Company Drivers
            </button>
            <button
              onClick={() => setActiveTab('owners')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'owners'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Owner Operators
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expenses'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Expenses
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Summary Cards - Driver/Owner tabs */}
        {activeTab !== 'expenses' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Loads ({selectedYear})</div>
            <div className="text-3xl font-bold text-blue-600">{grandTotals.loadCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Gross ({selectedYear})</div>
            <div className="text-3xl font-bold" style={{color: '#1a5f2a'}}>{formatCurrency(safeNumber(grandTotals.gross))}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Expenses ({selectedYear})</div>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(safeNumber(grandTotals.expenses))}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Profit ({selectedYear})</div>
            <div className="text-3xl font-bold" style={{color: safeNumber(grandTotals.profit) >= 0 ? '#1a5f2a' : '#b91c1c'}}>
              {formatCurrency(safeNumber(grandTotals.profit))}
            </div>
          </div>
        </div>
        )}

        {/* Summary Cards - Expenses tab */}
        {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Expenses ({selectedYear})</div>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(expenseReportData.totalAmount)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Categories</div>
            <div className="text-3xl font-bold text-blue-600">{expenseReportData.categories.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Entries</div>
            <div className="text-3xl font-bold text-gray-700">{expenseReportData.categories.reduce((s, c) => s + c.entries.length, 0)}</div>
          </div>
        </div>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Entries</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseReportData.categories.map((cat) => {
                    const isExpanded = expandedDrivers.has(cat.name.hashCode?.() || cat.name.length)
                    const catKey = cat.name.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
                    const isCatExpanded = expandedDrivers.has(catKey)
                    return (
                      <React.Fragment key={cat.name}>
                        <tr
                          className="border-t-2 border-gray-300 cursor-pointer hover:bg-gray-50 bg-red-50/30"
                          onClick={() => toggleDriver(catKey)}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {cat.entries.length > 0 ? (
                                isCatExpanded ? <ChevronDown className="h-4 w-4 text-gray-600" /> : <ChevronRight className="h-4 w-4 text-gray-600" />
                              ) : <span className="w-4" />}
                              {cat.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{cat.entries.length}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(cat.total)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-600">
                            {expenseReportData.totalAmount > 0 ? ((cat.total / expenseReportData.totalAmount) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        {isCatExpanded && cat.entries
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((entry) => (
                          <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700 pl-12">
                              {entry.description || entry.category}
                              {entry.vendor && <span className="text-gray-400 ml-2">({entry.vendor})</span>}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-500">{entry.date}</td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">{formatCurrency(entry.amount)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-400">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">{entry.cost_type}</span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-gray-400 bg-gray-100">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">
                      {expenseReportData.categories.reduce((s, c) => s + c.entries.length, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(expenseReportData.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Table - Drivers/Owners */}
        {activeTab !== 'expenses' && (filteredData.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Drivers Found</h2>
              <p className="text-gray-600">
                {activeTab === 'drivers'
                  ? `No company drivers were employed during ${selectedYear}.`
                  : `No owner operators were employed during ${selectedYear}.`}
              </p>
            </div>
          </div>
        ) : activeTab === 'drivers' ? (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Driver</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Gross</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">Load Miles</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">Fuel Miles</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Fuel Total</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">Fuel $/Mi</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Driver Pay</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Expense %</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Fixed Exp</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Variable Exp</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px] bg-green-50">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredData.map((driverData) => {
                    const fuelInfo = fuelByDriver.get(driverData.driver_id)
                    const settings = settingsMap.get(driverData.driver_id)
                    const payType = settings?.pay_type || 'flat'
                    const payRate = Number(settings?.pay_rate) || 0
                    const fuelMiles = fuelInfo?.fuelMiles || 0
                    const driverPay = payType === 'per_mile' ? payRate * fuelMiles : payRate
                    const fuelTotal = fuelInfo?.fuelTotal || 0
                    const fuelPricePerMile = fuelInfo?.pricePerMile || 0

                    const gross = safeNumber(driverData.totals.gross)
                    const expensePct = gross * 0.02
                    // TODO: Fixed/variable expenses will come from expense tab later
                    const fixedExp = 0
                    const variableExp = 0
                    const totalProfit = gross - driverPay - fuelTotal - expensePct - fixedExp - variableExp

                    return (
                      <tr
                        key={driverData.driver_id}
                        className="border-t border-gray-200 hover:bg-gray-50"
                      >
                        <td className="px-3 py-3 text-sm font-semibold text-gray-900">{driverData.driver_name}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold" style={{color: '#1a5f2a'}}>{formatCurrency(safeNumber(driverData.totals.gross))}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{formatNumber(driverData.totals.miles)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{fuelMiles > 0 ? formatNumber(fuelMiles) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{fuelTotal > 0 ? formatCurrency(fuelTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">{fuelPricePerMile > 0 ? `$${fuelPricePerMile.toFixed(3)}` : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <select
                              className="text-xs border rounded px-1 py-0.5 bg-white"
                              value={payType}
                              onChange={(e) => {
                                const newType = e.target.value
                                if (settings && settings.id > 0) {
                                  updateDriverSettings.mutate({ driverId: driverData.driver_id, data: { pay_type: newType } })
                                } else {
                                  createDriverSettings.mutate({ driver_id: driverData.driver_id, pay_type: newType })
                                }
                              }}
                            >
                              <option value="flat">Flat</option>
                              <option value="per_mile">Per Mi</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              className="w-16 text-xs border rounded px-1 py-0.5 text-right"
                              value={payRate || ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                if (settings && settings.id > 0) {
                                  updateDriverSettings.mutate({ driverId: driverData.driver_id, data: { pay_rate: val } })
                                } else {
                                  createDriverSettings.mutate({ driver_id: driverData.driver_id, pay_rate: val })
                                }
                              }}
                            />
                            <span className="text-xs text-gray-500 font-semibold w-16 text-right">{formatCurrency(driverPay)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{expensePct > 0 ? formatCurrency(expensePct) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{fixedExp > 0 ? formatCurrency(fixedExp) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{variableExp > 0 ? formatCurrency(variableExp) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right font-bold" style={{
                          backgroundColor: 'rgba(26, 95, 42, 0.1)',
                          color: totalProfit >= 0 ? '#1a5f2a' : '#b91c1c'
                        }}>
                          {formatCurrency(totalProfit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    let totGross = 0, totMiles = 0, totFuelMiles = 0, totFuel = 0, totDriverPay = 0
                    let totExpPct = 0, totFixedExp = 0, totVariableExp = 0, totProfit = 0
                    filteredData.forEach((driverData) => {
                      const fuelInfo = fuelByDriver.get(driverData.driver_id)
                      const settings = settingsMap.get(driverData.driver_id)
                      const payType = settings?.pay_type || 'flat'
                      const payRate = Number(settings?.pay_rate) || 0
                      const fuelMiles = fuelInfo?.fuelMiles || 0
                      const driverPay = payType === 'per_mile' ? payRate * fuelMiles : payRate
                      const fuelTotal = fuelInfo?.fuelTotal || 0
                      const fixedExp = 0
                      const variableExp = 0
                      const gross = safeNumber(driverData.totals.gross)
                      const expensePct = gross * 0.02
                      const profit = gross - driverPay - fuelTotal - expensePct - fixedExp - variableExp

                      totGross += gross
                      totMiles += safeNumber(driverData.totals.miles)
                      totFuelMiles += fuelMiles
                      totFuel += fuelTotal
                      totDriverPay += driverPay
                      totExpPct += expensePct
                      totFixedExp += fixedExp
                      totVariableExp += variableExp
                      totProfit += profit
                    })
                    const totFuelPpm = totFuelMiles > 0 ? totFuel / totFuelMiles : 0
                    return (
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                        <td className="px-3 py-3 text-sm">Total</td>
                        <td className="px-3 py-3 text-sm text-right" style={{color: '#1a5f2a'}}>{formatCurrency(totGross)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{formatNumber(totMiles)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{totFuelMiles > 0 ? formatNumber(totFuelMiles) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totFuel > 0 ? formatCurrency(totFuel) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">{totFuelPpm > 0 ? `$${totFuelPpm.toFixed(3)}` : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-500">{formatCurrency(totDriverPay)}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totExpPct > 0 ? formatCurrency(totExpPct) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totFixedExp > 0 ? formatCurrency(totFixedExp) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totVariableExp > 0 ? formatCurrency(totVariableExp) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right" style={{
                          backgroundColor: 'rgba(26, 95, 42, 0.1)',
                          color: totProfit >= 0 ? '#1a5f2a' : '#b91c1c'
                        }}>
                          {formatCurrency(totProfit)}
                        </td>
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        ) : activeTab === 'owners' ? (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Owner Operator</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Total Gross</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Adj. Gross</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Load Miles</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Fuel Miles</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">Fuel Total</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Fuel $/Mi</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Dispatch</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Insurance</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Adj. Ins.</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Trailer</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Parking</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Misc</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Expense %</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Net Pay</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] bg-green-50">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredData.map((driverData) => {
                    const fuelInfo = fuelByDriver.get(driverData.driver_id)
                    const settings = settingsMap.get(driverData.driver_id)
                    const payrollInfo = payrollByDriver.get(driverData.driver_id)
                    const fuelMiles = fuelInfo?.fuelMiles || 0
                    const fuelTotal = fuelInfo?.fuelTotal || 0
                    const fuelPpm = fuelInfo?.pricePerMile || 0

                    const totalGross = safeNumber(driverData.totals.gross)
                    const adjGross = payrollInfo?.adjustedGross || totalGross

                    // All deductions come directly from payroll tab
                    const dispatchTotal = payrollInfo?.dispatch || 0
                    const insTotal = payrollInfo?.insurance || 0
                    const driverTruck = settings?.truck_id ? trucks.find((t: any) => t.id === settings.truck_id) : null
                    const truckInsYearly = driverTruck ? (Number(driverTruck.cargo_insurance) || 0) + (Number(driverTruck.liability_insurance) || 0) + (Number(driverTruck.physical_damage_insurance) || 0) : 0
                    const insWeekly = truckInsYearly / 52
                    const insWeeksOnPayroll = payrollInfo?.insuranceWeeks || 0
                    const adjInsurance = insWeeksOnPayroll > 0 ? insTotal - (insWeekly * insWeeksOnPayroll) : 0
                    const trailerTotal = payrollInfo?.trailer || 0
                    const parkingTotal = payrollInfo?.parking || 0
                    const miscTotal = payrollInfo?.misc || 0
                    const netPay = payrollInfo?.netPay || 0
                    const expensePct = totalGross * 0.02

                    const profit = totalGross - fuelTotal - adjInsurance - parkingTotal - expensePct - netPay

                    return (
                      <tr key={driverData.driver_id} className="border-t border-gray-200 hover:bg-orange-50/30">
                        <td className="px-3 py-3 text-sm font-semibold text-gray-900">{driverData.driver_name}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold" style={{color: '#1a5f2a'}}>{formatCurrency(totalGross)}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold" style={{color: '#1a5f2a'}}>{formatCurrency(adjGross)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{formatNumber(driverData.totals.miles)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{fuelMiles > 0 ? formatNumber(fuelMiles) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{fuelTotal > 0 ? formatCurrency(fuelTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">{fuelPpm > 0 ? `$${fuelPpm.toFixed(3)}` : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{dispatchTotal > 0 ? formatCurrency(dispatchTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{insTotal > 0 ? formatCurrency(insTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{adjInsurance !== 0 ? formatCurrency(adjInsurance) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{trailerTotal > 0 ? formatCurrency(trailerTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{parkingTotal > 0 ? formatCurrency(parkingTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{miscTotal > 0 ? formatCurrency(miscTotal) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{expensePct > 0 ? formatCurrency(expensePct) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600 font-semibold">{netPay > 0 ? formatCurrency(netPay) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right font-bold" style={{
                          backgroundColor: 'rgba(26, 95, 42, 0.1)',
                          color: profit >= 0 ? '#1a5f2a' : '#b91c1c'
                        }}>
                          {formatCurrency(profit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    let totGross = 0, totAdjGross = 0, totMiles = 0, totFuelMiles = 0, totFuel = 0
                    let totDispatch = 0, totIns = 0, totAdjIns = 0, totTrailer = 0, totParking = 0, totMisc = 0, totExpPct = 0, totNetPay = 0, totProfit = 0
                    filteredData.forEach((driverData) => {
                      const fuelInfo = fuelByDriver.get(driverData.driver_id)
                      const settings = settingsMap.get(driverData.driver_id)
                      const payrollInfo = payrollByDriver.get(driverData.driver_id)
                      const totalGross = safeNumber(driverData.totals.gross)
                      const adjGross = payrollInfo?.adjustedGross || totalGross
                      const dispatchTotal = payrollInfo?.dispatch || 0
                      const insTotal = payrollInfo?.insurance || 0
                      const driverTruck = settings?.truck_id ? trucks.find((t: any) => t.id === settings.truck_id) : null
                      const truckInsYearly = driverTruck ? (Number(driverTruck.cargo_insurance) || 0) + (Number(driverTruck.liability_insurance) || 0) + (Number(driverTruck.physical_damage_insurance) || 0) : 0
                      const insWeekly = truckInsYearly / 52
                      const insWeeksOnPayroll = payrollInfo?.insuranceWeeks || 0
                      const adjInsurance = insWeeksOnPayroll > 0 ? insTotal - (insWeekly * insWeeksOnPayroll) : 0
                      const trailerTotal = payrollInfo?.trailer || 0
                      const parkingTotal = payrollInfo?.parking || 0
                      const miscTotal = payrollInfo?.misc || 0
                      const netPay = payrollInfo?.netPay || 0
                      const expensePct = totalGross * 0.02
                      const fuelTotal = fuelInfo?.fuelTotal || 0
                      const profit = totalGross - fuelTotal - adjInsurance - parkingTotal - expensePct - netPay

                      totGross += totalGross
                      totAdjGross += adjGross
                      totMiles += safeNumber(driverData.totals.miles)
                      totFuelMiles += fuelInfo?.fuelMiles || 0
                      totFuel += fuelTotal
                      totDispatch += dispatchTotal
                      totIns += insTotal
                      totAdjIns += adjInsurance
                      totTrailer += trailerTotal
                      totParking += parkingTotal
                      totMisc += miscTotal
                      totExpPct += expensePct
                      totNetPay += netPay
                      totProfit += profit
                    })
                    const totFuelPpm = totFuelMiles > 0 ? totFuel / totFuelMiles : 0
                    return (
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                        <td className="px-3 py-3 text-sm">Total</td>
                        <td className="px-3 py-3 text-sm text-right" style={{color: '#1a5f2a'}}>{formatCurrency(totGross)}</td>
                        <td className="px-3 py-3 text-sm text-right" style={{color: '#1a5f2a'}}>{formatCurrency(totAdjGross)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{formatNumber(totMiles)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700">{totFuelMiles > 0 ? formatNumber(totFuelMiles) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totFuel > 0 ? formatCurrency(totFuel) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">{totFuelPpm > 0 ? `$${totFuelPpm.toFixed(3)}` : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totDispatch > 0 ? formatCurrency(totDispatch) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totIns > 0 ? formatCurrency(totIns) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totAdjIns !== 0 ? formatCurrency(totAdjIns) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totTrailer > 0 ? formatCurrency(totTrailer) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totParking > 0 ? formatCurrency(totParking) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totMisc > 0 ? formatCurrency(totMisc) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totExpPct > 0 ? formatCurrency(totExpPct) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right text-red-600">{totNetPay > 0 ? formatCurrency(totNetPay) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-right" style={{
                          backgroundColor: 'rgba(26, 95, 42, 0.1)',
                          color: totProfit >= 0 ? '#1a5f2a' : '#b91c1c'
                        }}>
                          {formatCurrency(totProfit)}
                        </td>
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        ) : null)}
      </div>
    </Layout>
  )
}
