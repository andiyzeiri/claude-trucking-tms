'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ChevronRight, ChevronDown } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'

// Generate 52 weeks starting from Monday, December 30, 2024
function generateWeeks() {
  const weeks = []
  // Use Date constructor to avoid timezone issues (2024, 11=December, 30)
  const startDate = new Date(2024, 11, 30) // Monday, December 30, 2024

  for (let i = 0; i < 52; i++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(startDate.getDate() + (i * 7))

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Sunday

    const weekNumber = i + 1
    const year = weekStart.getFullYear()

    weeks.push({
      weekNumber,
      year,
      startDate: weekStart,
      endDate: weekEnd,
      label: `Week ${weekNumber} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
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

export default function PayrollPage() {
  const { data: driversData, isLoading } = useDrivers()
  const drivers = driversData?.items || []
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])) // Week 1 expanded by default

  const weeks = useMemo(() => generateWeeks(), [])

  // Mock payroll data - in real app, this would come from API
  const payrollData: DriverPayrollData[] = useMemo(() => {
    return drivers.map(driver => ({
      driver_id: driver.id,
      driver_name: `${driver.first_name} ${driver.last_name}`,
      weeks: {} // Empty for now - will be populated by API
    }))
  }, [drivers])

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

  // Calculate week totals
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

    payrollData.forEach(driverData => {
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

  return (
    <Layout>
      <div className="page-payroll space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="text-gray-600">52-week driver payroll overview</p>
          </div>
          <div className="flex gap-2">
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

        {/* Grand Totals Summary */}
        {drivers.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider min-w-[300px]">
                      52-Week Totals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider min-w-[200px]">
                      All Drivers
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Extra
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[110px]">
                      Dispatch Fee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Insurance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Parking
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Trailer
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Misc
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[90px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[120px]">
                      Total Pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white border-b-2 border-gray-300">
                    <td className="px-4 py-4 text-sm font-bold text-gray-900">
                      Year 2025
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-blue-600">
                      {payrollData.length} drivers
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.dispatch_fee)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.insurance)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.fuel)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.parking)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.trailer)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.misc)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {grandTotals.miles.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-lg font-bold text-right text-green-700">
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
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[300px]">
                      Week
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Extra
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                      Dispatch Fee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Insurance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Parking
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Trailer
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Misc
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] bg-green-50">
                      Pay
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {weeks.map((week) => {
                    const isExpanded = expandedWeeks.has(week.weekNumber)
                    const weekTotals = getWeekTotals(week.weekNumber)
                    const hasData = weekTotals.check_amount > 0

                    return (
                      <React.Fragment key={week.weekNumber}>
                        {/* Week Header Row */}
                        <tr
                          id={`week-${week.weekNumber}`}
                          className={`border-t-2 border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors ${
                            hasData ? 'bg-blue-50' : 'bg-gray-50'
                          }`}
                          onClick={() => toggleWeek(week.weekNumber)}
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 z-10 bg-inherit">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              )}
                              <span>{week.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-600">
                            {payrollData.length} drivers
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.gross)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.extra)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.dispatch_fee)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.insurance)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.fuel)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.parking)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.trailer)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(weekTotals.misc)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {weekTotals.miles.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-700 bg-green-100">
                            {formatCurrency(weekTotals.check_amount)}
                          </td>
                        </tr>

                        {/* Driver Rows (shown when expanded) */}
                        {isExpanded && payrollData.map((driverData) => {
                          const weekData = driverData.weeks[week.weekNumber]

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="hover:bg-gray-50 border-b border-gray-100"
                            >
                              <td className="px-4 py-2 text-sm text-gray-500 sticky left-0 bg-white hover:bg-gray-50">
                                {/* Empty for driver rows */}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-blue-600 pl-8">
                                {driverData.driver_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.gross) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.extra) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.dispatch_fee) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.insurance) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.fuel) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.parking) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.trailer) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? formatCurrency(weekData.misc) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                {weekData ? weekData.miles.toLocaleString() : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-green-600 bg-green-50">
                                {weekData ? formatCurrency(weekData.check_amount) : '-'}
                              </td>
                            </tr>
                          )
                        })}
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
