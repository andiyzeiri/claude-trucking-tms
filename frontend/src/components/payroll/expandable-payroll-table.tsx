'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronRight, Search, Edit, Trash2 } from 'lucide-react'
import { PayrollData } from './payroll-modal'

// Helper function to generate all 52 weeks
const generateAllWeeks = () => {
  const weeks = []
  const firstWeekStart = new Date(2024, 11, 30) // December 30, 2024

  for (let i = 1; i <= 52; i++) {
    const weekStart = new Date(firstWeekStart)
    weekStart.setDate(firstWeekStart.getDate() + (i - 1) * 7)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    weeks.push(`Week ${i} (${startStr} - ${endStr})`)
  }

  return weeks
}

interface ExpandablePayrollTableProps {
  data: PayrollData[]
  drivers: string[] // List of all drivers
  onRowRightClick?: (row: PayrollData, event: React.MouseEvent) => void
  searchPlaceholder?: string
  showSearch?: boolean
  className?: string
}

export function ExpandablePayrollTable({
  data,
  drivers,
  onRowRightClick,
  searchPlaceholder = "Search payroll entries...",
  showSearch = true,
  className = ""
}: ExpandablePayrollTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  // Group data by week and ensure every driver appears in every week
  const groupedData = useMemo(() => {
    const allWeeks = generateAllWeeks()
    const grouped: Record<string, PayrollData[]> = {}

    // Initialize all weeks with all drivers (with default zero values)
    allWeeks.forEach(week => {
      grouped[week] = drivers.map(driver => {
        // Check if this driver has actual data for this week
        const existingEntry = data.find(entry => entry.week === week && entry.driver === driver)

        if (existingEntry) {
          return existingEntry
        } else {
          // Create default entry with zero values
          return {
            id: Math.random(), // Temporary ID for display purposes
            week,
            driver,
            type: 'company' as const, // Default type
            gross: 0,
            dispatch_fee: 0,
            insurance: 0,
            fuel: 0,
            parking: 0,
            trailer: 0,
            misc: 0,
            miles: 0,
            check: 0,
            rpm: 0,
            escrow: 0
          }
        }
      })
    })

    return grouped
  }, [data, drivers])

  // Filter based on search term
  const filteredGroupedData = useMemo(() => {
    if (!searchTerm) return groupedData

    const filtered: Record<string, PayrollData[]> = {}
    Object.entries(groupedData).forEach(([week, entries]) => {
      const filteredEntries = entries.filter(entry =>
        entry.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        week.toLowerCase().includes(searchTerm.toLowerCase())
      )
      if (filteredEntries.length > 0 || week.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[week] = filteredEntries
      }
    })

    return filtered
  }, [groupedData, searchTerm])

  const toggleWeek = (week: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(week)) {
      newExpanded.delete(week)
    } else {
      newExpanded.add(week)
    }
    setExpandedWeeks(newExpanded)
  }

  const expandAll = () => {
    setExpandedWeeks(new Set(Object.keys(filteredGroupedData)))
  }

  const collapseAll = () => {
    setExpandedWeeks(new Set())
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Controls */}
      {showSearch && (
        <div className="flex items-center justify-between space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      )}

      {/* Expandable Table */}
      <div className="bg-white rounded-lg border shadow">
        <div className="overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 border-b px-6 py-3">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-2">Week</div>
              <div className="col-span-2">Driver</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Gross</div>
              <div className="col-span-1">Deductions</div>
              <div className="col-span-1">Miles</div>
              <div className="col-span-2">Check</div>
              <div className="col-span-1">RPM</div>
              <div className="col-span-1">Escrow</div>
            </div>
          </div>

          {/* Expandable Rows */}
          <div className="divide-y divide-gray-200">
            {Object.entries(filteredGroupedData).map(([week, entries]) => (
              <div key={week}>
                {/* Week Header Row */}
                <div
                  className="px-6 py-3 hover:bg-gray-50 cursor-pointer border-l-4 border-blue-500"
                  onClick={() => toggleWeek(week)}
                >
                  <div className="flex items-center space-x-2">
                    {expandedWeeks.has(week) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">{week}</span>
                    <span className="text-sm text-gray-500">({entries.length} drivers)</span>
                  </div>
                </div>

                {/* Driver Rows (Expandable Content) */}
                {expandedWeeks.has(week) && (
                  <div className="bg-gray-50/50">
                    {entries.map((entry) => {
                      const totalDeductions = entry.dispatch_fee + entry.insurance + entry.fuel +
                                            entry.parking + entry.trailer + entry.misc

                      // Check if this is a zero-value entry (no actual data)
                      const isEmptyEntry = entry.gross === 0 && entry.miles === 0 && totalDeductions === 0

                      return (
                        <div
                          key={`${entry.week}-${entry.driver}`}
                          className={`px-12 py-3 cursor-pointer border-l-4 border-transparent ${
                            isEmptyEntry
                              ? 'hover:bg-gray-100 text-gray-400'
                              : 'hover:bg-white hover:border-gray-300'
                          }`}
                          onContextMenu={(e) => onRowRightClick?.(entry, e)}
                        >
                          <div className="grid grid-cols-12 gap-4 text-sm">
                            <div className="col-span-2"></div>
                            <div className={`col-span-2 font-medium ${isEmptyEntry ? 'text-gray-400' : 'text-gray-900'}`}>
                              {entry.driver}
                            </div>
                            <div className="col-span-1">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                entry.type === 'company'
                                  ? isEmptyEntry ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-800'
                                  : isEmptyEntry ? 'bg-gray-100 text-gray-400' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {entry.type === 'company' ? 'Company' : 'Owner Op'}
                              </span>
                            </div>
                            <div className={`col-span-1 font-medium ${isEmptyEntry ? 'text-gray-400' : 'text-green-600'}`}>
                              {formatCurrency(entry.gross)}
                            </div>
                            <div className={`col-span-1 ${isEmptyEntry ? 'text-gray-400' : 'text-red-600'}`}>
                              {formatCurrency(totalDeductions)}
                            </div>
                            <div className={`col-span-1 font-medium ${isEmptyEntry ? 'text-gray-400' : 'text-gray-900'}`}>
                              {entry.miles.toLocaleString()}
                            </div>
                            <div className={`col-span-2 font-medium ${isEmptyEntry ? 'text-gray-400' : 'text-green-700'}`}>
                              {formatCurrency(entry.check)}
                            </div>
                            <div className={`col-span-1 font-medium ${isEmptyEntry ? 'text-gray-400' : 'text-blue-600'}`}>
                              ${entry.rpm.toFixed(2)}
                            </div>
                            <div className={`col-span-1 ${isEmptyEntry ? 'text-gray-400' : 'text-yellow-600'}`}>
                              {formatCurrency(entry.escrow)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {Object.keys(filteredGroupedData).length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No payroll entries found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}