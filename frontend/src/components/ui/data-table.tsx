'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronUp, ChevronDown, Search, Filter, Group, ChevronRight, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  width?: string
  className?: string
  getGroupValue?: (row: T) => string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
  searchable?: boolean
  onRowClick?: (row: T) => void
  onRowRightClick?: (row: T, event: React.MouseEvent) => void
  calculateGroupTotals?: (rows: T[]) => { [key: string]: any }
}

export function DataTable<T>({
  data,
  columns,
  className,
  searchable = true,
  onRowClick,
  onRowRightClick,
  calculateGroupTotals
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [groupBy, setGroupBy] = useState<(keyof T)[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const toggleGroup = (groupValue: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupValue)) {
      newCollapsed.delete(groupValue)
    } else {
      newCollapsed.add(groupValue)
    }
    setCollapsedGroups(newCollapsed)
  }

  const getGroupValue = (row: T, column: keyof T) => {
    const columnDef = columns.find(col => col.key === column)
    if (columnDef?.getGroupValue) {
      return columnDef.getGroupValue(row)
    }
    const value = (row as any)[column]
    if (typeof value === 'object' && value?.name) {
      return value.name
    }
    return String(value)
  }

  const addGroupLevel = (column: keyof T) => {
    if (!groupBy.includes(column)) {
      setGroupBy([...groupBy, column])
    }
  }

  const removeGroupLevel = (column: keyof T) => {
    setGroupBy(groupBy.filter(g => g !== column))
  }

  const clearGrouping = () => {
    setGroupBy([])
    setCollapsedGroups(new Set())
  }

  const createNestedGroups = (data: T[], groupLevels: (keyof T)[]): any => {
    if (groupLevels.length === 0) return data

    const [currentLevel, ...remainingLevels] = groupLevels
    const grouped = data.reduce((acc, row) => {
      const groupValue = getGroupValue(row, currentLevel)
      if (!acc[groupValue]) {
        acc[groupValue] = []
      }
      acc[groupValue].push(row)
      return acc
    }, {} as Record<string, T[]>)

    return Object.entries(grouped).map(([groupValue, rows]) => ({
      groupValue,
      groupLevel: currentLevel,
      rows: remainingLevels.length > 0 ? createNestedGroups(rows, remainingLevels) : rows,
      isGroup: true,
      level: groupLevels.length - remainingLevels.length - 1
    }))
  }

  const processedData = useMemo(() => {
    let filtered = [...data]

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row as any).some(value => {
          if (typeof value === 'object' && value?.name) {
            return value.name.toLowerCase().includes(searchTerm.toLowerCase())
          }
          return String(value).toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Column filters
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(row => {
          const value = (row as any)[column]
          if (typeof value === 'object' && value?.name) {
            return value.name.toLowerCase().includes(filterValue.toLowerCase())
          }
          return String(value).toLowerCase().includes(filterValue.toLowerCase())
        })
      }
    })

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = (a as any)[sortColumn]
        const bVal = (b as any)[sortColumn]

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    // Grouping
    if (groupBy.length > 0) {
      return createNestedGroups(filtered, groupBy)
    }

    return filtered
  }, [data, sortColumn, sortDirection, searchTerm, columnFilters, groupBy, columns])

  const groupableColumns = columns.filter(col => col.groupable)

  const renderNestedGroups = (groups: any[], level: number = 0): React.ReactNode => {
    return groups.map((item, index) => {
      if (item.isGroup) {
        const groupKey = `${level}-${item.groupValue}-${index}`
        const isCollapsed = collapsedGroups.has(groupKey)
        const paddingLeft = level * 20

        // Get all rows in this group (flatten nested groups if needed)
        const getAllRowsInGroup = (groupItem: any): any[] => {
          if (Array.isArray(groupItem.rows) && !groupItem.rows[0]?.isGroup) {
            return groupItem.rows
          }
          if (Array.isArray(groupItem.rows)) {
            return groupItem.rows.flatMap((subItem: any) => getAllRowsInGroup(subItem))
          }
          return []
        }

        const allRowsInGroup = getAllRowsInGroup(item)
        const groupTotals = calculateGroupTotals ? calculateGroupTotals(allRowsInGroup) : null

        return (
          <React.Fragment key={groupKey}>
            <tr className="bg-gray-100 border-b border-gray-200">
              {columns.map((column, colIndex) => {
                if (colIndex === 0) {
                  // First column - show group name and chevron
                  return (
                    <td
                      key={String(column.key)}
                      className="px-3 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      style={{
                        paddingLeft: `${paddingLeft + 12}px`,
                        width: column.width,
                        minWidth: column.width
                      }}
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            !isCollapsed && "rotate-90"
                          )}
                        />
                        <span>{item.groupValue}</span>
                        <span className="text-gray-500">({allRowsInGroup.length})</span>
                      </div>
                    </td>
                  )
                }

                // Show group totals in appropriate columns
                const showTotal = groupTotals && groupTotals[String(column.key)]
                return (
                  <td
                    key={String(column.key)}
                    className="px-3 py-3 text-sm font-medium text-gray-600"
                    style={{
                      width: column.width,
                      minWidth: column.width
                    }}
                  >
                    {showTotal || ''}
                  </td>
                )
              })}
            </tr>
            {!isCollapsed && (
              <>
                {Array.isArray(item.rows) && !item.rows[0]?.isGroup ? (
                  // Leaf level - render actual rows
                  item.rows.map((row: T, rowIndex: number) => (
                    <tr
                      key={`${groupKey}-row-${rowIndex}`}
                      className={cn(
                        "group border-b border-gray-100 hover:bg-gray-50 transition-colors",
                        (onRowClick || onRowRightClick) && "cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        onRowRightClick?.(row, e)
                      }}
                    >
                      {columns.map((column) => (
                        <td
                          key={String(column.key)}
                          className={cn(
                            "px-3 py-2 text-sm border-r border-gray-100 last:border-r-0",
                            column.className
                          )}
                          style={{
                            width: column.width,
                            minWidth: column.width,
                            paddingLeft: String(column.key) === String(columns[0].key) ? `${paddingLeft + 32}px` : undefined
                          }}
                        >
                          {column.render ? (
                            column.render((row as any)[column.key], row)
                          ) : (
                            String((row as any)[column.key] || '')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  // Nested groups
                  renderNestedGroups(item.rows, level + 1)
                )}
              </>
            )}
          </React.Fragment>
        )
      }
      return null
    })
  }

  return (
    <div className={cn("border border-gray-200 rounded-lg bg-white", className)} style={{ minWidth: '1400px', width: '100%' }}>
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
          )}
          {groupableColumns.length > 0 && (
            <div className="flex items-center gap-2">
              <Group className="h-4 w-4 text-gray-500" />
              <div className="flex flex-wrap items-center gap-2">
                {groupBy.map((group, index) => {
                  const column = columns.find(c => c.key === group)
                  return (
                    <div key={String(group)} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                      <span>{index + 1}. {column?.label}</span>
                      <button
                        onClick={() => removeGroupLevel(group)}
                        className="hover:bg-blue-200 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
                {groupBy.length > 0 && (
                  <button
                    onClick={clearGrouping}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                )}
                <Select value="" onValueChange={(value) => addGroupLevel(value as keyof T)}>
                  <SelectTrigger className="w-40 bg-white">
                    <SelectValue placeholder={groupBy.length === 0 ? "Group by..." : "Add group..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupableColumns
                      .filter(column => !groupBy.includes(column.key))
                      .map((column) => (
                        <SelectItem key={String(column.key)} value={String(column.key)}>
                          {column.label}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <table className="w-full table-auto">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0",
                    column.className
                  )}
                  style={{ width: column.width, minWidth: column.width }}
                >
                  <div className="flex items-center justify-between min-w-0">
                    <span className="truncate">{column.label}</span>
                    <div className="flex items-center space-x-1 ml-1">
                      {column.sortable !== false && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 flex-shrink-0"
                          onClick={() => handleSort(column.key)}
                        >
                          {sortColumn === column.key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="flex flex-col">
                              <ChevronUp className="h-2 w-2 opacity-50" />
                              <ChevronDown className="h-2 w-2 opacity-50" />
                            </div>
                          )}
                        </Button>
                      )}
                      {column.filterable && (
                        <Filter className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  {column.filterable && (
                    <div className="mt-2">
                      <Input
                        placeholder="Filter..."
                        value={columnFilters[String(column.key)] || ''}
                        onChange={(e) => setColumnFilters(prev => ({
                          ...prev,
                          [String(column.key)]: e.target.value
                        }))}
                        className="h-6 text-xs"
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {groupBy.length > 0 ? (
              // Grouped view
              renderNestedGroups(processedData as any[])
            ) : (
              // Regular view
              (processedData as T[]).map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    "group border-b border-gray-100 hover:bg-gray-50 transition-colors",
                    (onRowClick || onRowRightClick) && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onRowRightClick?.(row, e)
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn(
                        "px-3 py-2 text-sm border-r border-gray-100 last:border-r-0",
                        column.className
                      )}
                      style={{ width: column.width, minWidth: column.width }}
                    >
                      {column.render ? (
                        column.render((row as any)[column.key], row)
                      ) : (
                        String((row as any)[column.key] || '')
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(groupBy.length > 0 ? (processedData as any[]).length === 0 : (processedData as T[]).length === 0) && (
        <div className="text-center py-8 text-gray-500">
          No data found
        </div>
      )}
    </div>
  )
}