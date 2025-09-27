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
import { ChevronUp, ChevronDown, Search, Filter, Group, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LaneGroup {
  lane: string
  pickup_location: string
  delivery_location: string
  brokers: any[]
  isExpanded: boolean
}

interface ExpandableLanesTableProps {
  laneGroups: LaneGroup[]
  onToggleLane: (laneKey: string) => void
  onBrokerRightClick?: (broker: any, event: React.MouseEvent) => void
  searchTerm: string
  onSearchChange: (search: string) => void
  className?: string
}

export function ExpandableLanesTable({
  laneGroups,
  onToggleLane,
  onBrokerRightClick,
  searchTerm,
  onSearchChange,
  className
}: ExpandableLanesTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedGroups = useMemo(() => {
    let filtered = [...laneGroups]

    // Column filters
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(group => {
          if (column === 'route') {
            return group.lane.toLowerCase().includes(filterValue.toLowerCase())
          } else if (column === 'brokers') {
            return group.brokers.some(broker =>
              broker.broker.toLowerCase().includes(filterValue.toLowerCase()) ||
              broker.email.toLowerCase().includes(filterValue.toLowerCase()) ||
              broker.phone.toLowerCase().includes(filterValue.toLowerCase())
            )
          }
          return true
        })
      }
    })

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any, bVal: any

        if (sortColumn === 'route') {
          aVal = a.lane
          bVal = b.lane
        } else if (sortColumn === 'brokers') {
          aVal = a.brokers.length
          bVal = b.brokers.length
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [laneGroups, columnFilters, sortColumn, sortDirection])

  const columns = [
    {
      key: 'route',
      label: 'Lane Route',
      width: '60%',
      sortable: true,
      filterable: true
    },
    {
      key: 'brokers',
      label: 'Brokers',
      width: '40%',
      sortable: true,
      filterable: true
    }
  ]

  return (
    <div className={cn("bg-white rounded-lg shadow border", className)} style={{ minWidth: '1400px', width: '100%' }}>
      <div className="p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search lanes, brokers, emails..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white border-gray-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Group className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Grouped by Route</span>
          </div>
        </div>
      </div>

      <div>
        <table className="w-full table-auto">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-100 last:border-r-0"
                  style={{ width: column.width }}
                >
                  <div className="flex items-center justify-between min-w-0">
                    <span className="truncate">{column.label}</span>
                    <div className="flex items-center space-x-1 ml-1">
                      {column.sortable && (
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
                        value={columnFilters[column.key] || ''}
                        onChange={(e) => setColumnFilters(prev => ({
                          ...prev,
                          [column.key]: e.target.value
                        }))}
                        className="h-6 text-xs border-gray-200"
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredAndSortedGroups.map((group) => (
              <React.Fragment key={group.lane}>
                {/* Lane Group Header Row */}
                <tr
                  className="group border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer bg-gray-50"
                  onClick={() => onToggleLane(group.lane)}
                >
                  <td className="px-4 py-3 text-sm border-r border-gray-100" style={{ width: '60%' }}>
                    <div className="flex items-center">
                      <ChevronRight
                        className={`h-4 w-4 text-gray-500 transition-transform mr-3 ${
                          group.isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            📍 {group.pickup_location}
                          </span>
                        </div>
                        <span className="text-gray-500 font-bold">→</span>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            🎯 {group.delivery_location}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ width: '40%' }}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {group.brokers.length} broker{group.brokers.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-500">
                        Click to {group.isExpanded ? 'collapse' : 'expand'}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Expanded Broker Rows */}
                {group.isExpanded && group.brokers.map((broker, brokerIndex) => (
                  <tr
                    key={`${group.lane}-${broker.id}`}
                    className="group border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    onContextMenu={(e) => onBrokerRightClick?.(broker, e)}
                  >
                    <td className="px-4 py-3 text-sm border-r border-gray-100 pl-12" style={{ width: '60%' }}>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          <span className="font-medium text-gray-900">{broker.broker}</span>
                        </div>
                        {broker.notes && (
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            {broker.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ width: '40%' }}>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">📧</span>
                          <a
                            href={`mailto:${broker.email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {broker.email}
                          </a>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">📞</span>
                          <a
                            href={`tel:${broker.phone}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {broker.phone}
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedGroups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No lanes found{searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}
    </div>
  )
}