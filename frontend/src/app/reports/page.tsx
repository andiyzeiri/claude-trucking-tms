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
import { Driver } from '@/types'

// Helper to safely convert to number, defaulting to 0 for NaN/null/undefined
function safeNumber(value: any): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

// Helper function to get ISO week number and year
function getISOWeekInfo(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return {
    year: d.getUTCFullYear(),
    week: weekNumber,
    label: `Week ${weekNumber}`
  }
}

// Helper function to get date range for a week
function getWeekDateRange(date: Date) {
  const dayOfWeek = date.getDay()
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday,
    end: sunday,
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
}

// Helper function to check if a driver was employed during a specific year
function wasEmployedDuringYear(driver: Driver, year: number): boolean {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  // If no hire date, assume they were employed
  const hireDate = driver.date_hired ? new Date(driver.date_hired + 'T00:00:00') : null
  const terminationDate = driver.date_terminated ? new Date(driver.date_terminated + 'T00:00:00') : null

  // Driver was employed during the year if:
  // 1. They were hired before or during the year (or no hire date recorded)
  // 2. They were not terminated before the year started (or no termination date)

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

type TabType = 'drivers' | 'owners'

export default function ReportsPage() {
  // Fetch ALL data - use large limit to get everything
  const { data: loadsData, isLoading: loadsLoading } = useLoads(1, 10000)
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(1, 10000)
  const { data: fuelData, isLoading: fuelLoading } = useFuel()

  const loads = loadsData?.items || []
  const drivers = driversData?.items || []
  const expenses = expensesData?.items || []
  const fuel = fuelData || []

  const [activeTab, setActiveTab] = useState<TabType>('drivers')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
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
        const loadDate = new Date(load.pickup_date + 'T00:00:00')
        if (!isNaN(loadDate.getTime())) {
          const weekInfo = getISOWeekInfo(loadDate)
          if (!isNaN(weekInfo.year)) {
            years.add(weekInfo.year)
          }
        }
      }
    })

    expenses.forEach(expense => {
      if (expense.date) {
        const expenseDate = new Date(expense.date + 'T00:00:00')
        if (!isNaN(expenseDate.getTime())) {
          const year = expenseDate.getFullYear()
          if (!isNaN(year)) {
            years.add(year)
          }
        }
      }
    })

    fuel.forEach(f => {
      if (f.date) {
        const fuelDate = new Date(f.date + 'T00:00:00')
        if (!isNaN(fuelDate.getTime())) {
          const year = fuelDate.getFullYear()
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
      const expenseDate = new Date(expense.date + 'T00:00:00')
      if (isNaN(expenseDate.getTime())) return
      const weekInfo = getISOWeekInfo(expenseDate)
      if (isNaN(weekInfo.year) || weekInfo.year !== selectedYear) return
      const key = `${expense.driver_id}-${weekInfo.year}-${weekInfo.week}`
      map.set(key, (map.get(key) || 0) + safeNumber(expense.amount))
    })

    // Add fuel
    fuel.forEach(f => {
      if (!f.driver_id || !f.date) return
      const fuelDate = new Date(f.date + 'T00:00:00')
      if (isNaN(fuelDate.getTime())) return
      const weekInfo = getISOWeekInfo(fuelDate)
      if (isNaN(weekInfo.year) || weekInfo.year !== selectedYear) return
      const key = `${f.driver_id}-${weekInfo.year}-${weekInfo.week}`
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

      const loadDate = new Date(load.pickup_date + 'T00:00:00')
      if (isNaN(loadDate.getTime())) return
      const weekInfo = getISOWeekInfo(loadDate)

      // Filter by selected year (also check for NaN)
      if (isNaN(weekInfo.year) || weekInfo.year !== selectedYear) return

      const weekDateRange = getWeekDateRange(loadDate)
      const driverWeekKey = `${load.driver_id}-${weekInfo.year}-${weekInfo.week}`

      if (!weekMap.has(driverWeekKey)) {
        weekMap.set(driverWeekKey, {
          weekKey: `${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`,
          weekLabel: weekInfo.label,
          weekDateRange: weekDateRange.label,
          weekNumber: weekInfo.week,
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

  // Filter by tab and search - show all drivers who were employed during the year
  const filteredData = useMemo(() => {
    return reportData
      .filter(d => {
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

        {/* Summary Cards */}
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

        {/* Data Table */}
        {filteredData.length === 0 ? (
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
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">
                      {activeTab === 'drivers' ? 'Driver' : 'Owner'} / Week
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Expenses
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] bg-green-50">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredData.map((driverData) => {
                    const isExpanded = expandedDrivers.has(driverData.driver_id)
                    const hasNoLoads = driverData.totals.loadCount === 0

                    return (
                      <React.Fragment key={driverData.driver_id}>
                        {/* Driver Row */}
                        <tr
                          className={`border-t-2 border-gray-300 cursor-pointer hover:bg-groupDriver/80 ${hasNoLoads ? 'bg-gray-50' : 'bg-groupDriver'}`}
                          onClick={() => toggleDriver(driverData.driver_id)}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {driverData.weeks.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )
                              ) : (
                                <span className="w-4" />
                              )}
                              <span className={hasNoLoads ? 'text-gray-500' : ''}>{driverData.driver_name}</span>
                              {hasNoLoads ? (
                                <span className="text-gray-400 font-normal italic">(No loads)</span>
                              ) : (
                                <span className="text-gray-500 font-normal">
                                  ({driverData.totals.loadCount} loads, {driverData.weeks.length} weeks)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{color: hasNoLoads ? '#9ca3af' : '#1a5f2a'}}>
                            {formatCurrency(safeNumber(driverData.totals.gross))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{color: hasNoLoads ? '#9ca3af' : undefined}}>
                            {formatNumber(driverData.totals.miles)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{color: hasNoLoads ? '#9ca3af' : '#dc2626'}}>
                            {formatCurrency(safeNumber(driverData.totals.expenses))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{
                            backgroundColor: hasNoLoads ? 'transparent' : 'rgba(26, 95, 42, 0.1)',
                            color: hasNoLoads ? '#9ca3af' : (safeNumber(driverData.totals.profit) >= 0 ? '#1a5f2a' : '#b91c1c')
                          }}>
                            {formatCurrency(safeNumber(driverData.totals.profit))}
                          </td>
                        </tr>

                        {/* Week Rows */}
                        {isExpanded && driverData.weeks.map((week) => (
                          <tr
                            key={week.weekKey}
                            className="border-t border-gray-200 bg-groupWeek hover:bg-groupWeek/80"
                          >
                            <td className="px-4 py-2 text-sm text-gray-800 pl-12">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{week.weekLabel}</span>
                                <span className="text-gray-500 text-xs">({week.weekDateRange})</span>
                                <span className="text-gray-500">- {week.loadCount} loads</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold" style={{color: '#1a5f2a'}}>
                              {formatCurrency(safeNumber(week.gross))}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                              {formatNumber(week.miles)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">
                              {formatCurrency(safeNumber(week.expenses))}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold" style={{
                              backgroundColor: 'rgba(26, 95, 42, 0.05)',
                              color: safeNumber(week.profit) >= 0 ? '#1a5f2a' : '#b91c1c'
                            }}>
                              {formatCurrency(safeNumber(week.profit))}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
