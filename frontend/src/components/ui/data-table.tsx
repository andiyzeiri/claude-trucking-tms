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
import { useColumnWidths } from '@/hooks/use-column-widths'
import { ColumnWidthControl } from '@/components/ui/column-width-control'

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
  tableId?: string
  /**
   * Rows matching this predicate are always pushed to the bottom, even when
   * the user sorts by a column. Used to keep terminated drivers below active
   * ones regardless of how the table is ordered.
   */
  pinLast?: (row: T) => boolean
  /** Base style for a row, e.g. a highlight background. */
  rowStyle?: (row: T) => React.CSSProperties | undefined
  /** Background applied while hovering. Falls back to the standard hover. */
  rowHoverBackground?: (row: T) => string | undefined
}

export function DataTable<T>({
  data,
  columns,
  className,
  searchable = true,
  onRowClick,
  onRowRightClick,
  calculateGroupTotals,
  tableId = 'data-table',
  pinLast,
  rowStyle,
  rowHoverBackground
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  // Set up column width management
  const defaultWidths = useMemo(() => {
    const widths: Record<string, number> = {}
    columns.forEach(col => {
      widths[String(col.key)] = col.width ? parseInt(col.width) : 150
    })
    return widths
  }, [columns])

  const { columnWidths, adjustWidth } = useColumnWidths(tableId, defaultWidths)
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
          if (typeof value === 'object' && value && 'name' in value) {
            return String((value as any).name).toLowerCase().includes(searchTerm.toLowerCase())
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

    // Sorting. Runs whenever there is a sort column OR a pin predicate, so
    // pinned rows stay at the bottom even with no column sort active.
    if (sortColumn || pinLast) {
      filtered.sort((a, b) => {
        // Pin wins over the column sort - pinned rows sink regardless.
        if (pinLast) {
          const aPinned = pinLast(a) ? 1 : 0
          const bPinned = pinLast(b) ? 1 : 0
          if (aPinned !== bPinned) return aPinned - bPinned
        }

        if (!sortColumn) return 0  // Array.sort is stable, so order is kept

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
  }, [data, sortColumn, sortDirection, searchTerm, columnFilters, groupBy, columns, pinLast])

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
            <tr className="border-b" style={{ backgroundColor: 'var(--monday-bg-secondary)', borderColor: 'var(--monday-border-light)' }}>
              {columns.map((column, colIndex) => {
                const currentWidth = columnWidths[String(column.key)] || defaultWidths[String(column.key)]
                if (colIndex === 0) {
                  // First column - show group name and chevron
                  return (
                    <td
                      key={String(column.key)}
                      className="px-3 py-3 text-sm font-medium cursor-pointer transition-colors"
                      style={{
                        paddingLeft: `${paddingLeft + 12}px`,
                        width: `${currentWidth}px`,
                        minWidth: `${currentWidth}px`,
                        color: 'var(--monday-text-primary)'
                      }}
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            !isCollapsed && "rotate-90"
                          )}
                          style={{ color: 'var(--monday-cornflower)' }}
                        />
                        <span>{item.groupValue}</span>
                        <span style={{ color: 'var(--monday-text-secondary)' }}>({allRowsInGroup.length})</span>
                      </div>
                    </td>
                  )
                }

                // Show group totals in appropriate columns
                const showTotal = groupTotals && groupTotals[String(column.key)]
                return (
                  <td
                    key={String(column.key)}
                    className="px-3 py-3 text-sm font-medium"
                    style={{
                      width: `${currentWidth}px`,
                      minWidth: `${currentWidth}px`,
                      color: 'var(--monday-text-secondary)'
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
                        "group border-b transition-colors",
                        (onRowClick || onRowRightClick) && "cursor-pointer"
                      )}
                      style={{ borderColor: 'var(--monday-border-light)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => onRowClick?.(row)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        onRowRightClick?.(row, e)
                      }}
                    >
                      {columns.map((column) => {
                        const currentWidth = columnWidths[String(column.key)] || defaultWidths[String(column.key)]
                        return (
                          <td
                            key={String(column.key)}
                            className={cn(
                              "px-3 text-sm border-r last:border-r-0",
                              column.className
                            )}
                            style={{
                              width: `${currentWidth}px`,
                              minWidth: `${currentWidth}px`,
                              paddingTop: '6px',
                              paddingBottom: '6px',
                              paddingLeft: String(column.key) === String(columns[0].key) ? `${paddingLeft + 32}px` : undefined,
                              borderColor: 'var(--monday-border-light)',
                              color: 'var(--monday-text-primary)'
                            }}
                          >
                            {column.render ? (
                              column.render((row as any)[column.key], row)
                            ) : (
                              String((row as any)[column.key] || '')
                            )}
                          </td>
                        )
                      })}
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
    <div className={cn("border rounded-lg bg-white shadow-sm", className)} style={{ minWidth: '1400px', width: '100%', borderColor: 'var(--monday-border-light)' }}>
      <div className="p-4 border-b" style={{ backgroundColor: 'var(--monday-bg-secondary)', borderColor: 'var(--monday-border-light)' }}>
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--monday-text-muted)' }} />
              <Input
                placeholder="Search all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border focus:ring-2 focus:ring-offset-0"
                style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
              />
            </div>
          )}
          {groupableColumns.length > 0 && (
            <div className="flex items-center gap-2">
              <Group className="h-4 w-4" style={{ color: 'var(--monday-text-secondary)' }} />
              <div className="flex flex-wrap items-center gap-2">
                {groupBy.map((group, index) => {
                  const column = columns.find(c => c.key === group)
                  return (
                    <div key={String(group)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: 'rgba(27, 42, 65, 0.1)', color: 'var(--monday-cornflower)' }}>
                      <span>{index + 1}. {column?.label}</span>
                      <button
                        onClick={() => removeGroupLevel(group)}
                        className="hover:opacity-70 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
                {groupBy.length > 0 && (
                  <button
                    onClick={clearGrouping}
                    className="text-xs hover:opacity-70"
                    style={{ color: 'var(--monday-text-secondary)' }}
                  >
                    Clear all
                  </button>
                )}
                {groupableColumns.filter(column => !groupBy.includes(column.key)).length > 0 && (
                  <Select value={undefined} onValueChange={(value) => addGroupLevel(value as keyof T)}>
                    <SelectTrigger className="w-40 bg-white" style={{ borderColor: 'var(--monday-border)' }}>
                      <SelectValue placeholder={groupBy.length === 0 ? "Group by..." : "Add group..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {groupableColumns
                        .filter(column => !groupBy.includes(column.key))
                        .map((column, index) => {
                          const value = column.key ? String(column.key) : `column-${index}`
                          return (
                            <SelectItem key={value} value={value}>
                              {column.label}
                            </SelectItem>
                          )
                        })
                      }
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <table className="w-full table-auto">
          <thead className="border-b" style={{ backgroundColor: 'var(--monday-bg-secondary)', borderColor: 'var(--monday-border-light)' }}>
            <tr>
              {columns.map((column) => {
                const currentWidth = columnWidths[String(column.key)] || defaultWidths[String(column.key)]
                return (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "px-3 py-3 text-left text-xs font-medium uppercase tracking-wider border-r last:border-r-0 relative group",
                      column.className
                    )}
                    style={{
                      width: `${currentWidth}px`,
                      minWidth: `${currentWidth}px`,
                      color: 'var(--monday-text-secondary)',
                      borderColor: 'var(--monday-border-light)'
                    }}
                  >
                    <ColumnWidthControl
                      currentWidth={currentWidth}
                      onAdjust={(delta) => adjustWidth(String(column.key), delta)}
                    />
                    <div className="flex items-center justify-between min-w-0">
                      <span className="truncate">{column.label}</span>
                      <div className="flex items-center space-x-1 ml-1">
                        {column.sortable !== false && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0"
                            style={{ color: 'var(--monday-text-secondary)' }}
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
                          <Filter className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--monday-text-muted)' }} />
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
                          style={{ borderColor: 'var(--monday-border-light)' }}
                        />
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--monday-bg-primary)' }}>
            {groupBy.length > 0 ? (
              // Grouped view
              renderNestedGroups(processedData as any[])
            ) : (
              // Regular view
              (processedData as T[]).map((row, index) => {
                // Captured so onMouseLeave can restore the row's own colour.
                // It previously reset to 'transparent', which would have
                // permanently wiped any row highlight after the first hover.
                const base = rowStyle?.(row)
                const baseBg = (base?.backgroundColor as string) ?? 'transparent'
                const hoverBg = rowHoverBackground?.(row) ?? 'var(--monday-bg-hover)'
                return (
                <tr
                  key={index}
                  className={cn(
                    "group border-b transition-colors",
                    (onRowClick || onRowRightClick) && "cursor-pointer"
                  )}
                  style={{ borderColor: 'var(--monday-border-light)', ...base }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = baseBg}
                  onClick={() => onRowClick?.(row)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onRowRightClick?.(row, e)
                  }}
                >
                  {columns.map((column) => {
                    const currentWidth = columnWidths[String(column.key)] || defaultWidths[String(column.key)]
                    return (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "px-3 text-sm border-r last:border-r-0",
                          column.className
                        )}
                        style={{
                          width: `${currentWidth}px`,
                          minWidth: `${currentWidth}px`,
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          borderColor: 'var(--monday-border-light)',
                          color: 'var(--monday-text-primary)'
                        }}
                      >
                        {column.render ? (
                          column.render((row as any)[column.key], row)
                        ) : (
                          String((row as any)[column.key] || '')
                        )}
                      </td>
                    )
                  })}
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {(groupBy.length > 0 ? (processedData as any[]).length === 0 : (processedData as T[]).length === 0) && (
        <div className="text-center py-8" style={{ color: 'var(--monday-text-muted)' }}>
          No data found
        </div>
      )}
    </div>
  )
}