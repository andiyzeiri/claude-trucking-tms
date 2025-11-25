'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

// Local storage key for fuel data
const FUEL_STORAGE_KEY = 'tms-fuel-data'

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

type EditingCell = {
  weekNumber: number
  driverId: number
  field: string
} | null

// Get week date range
function getWeekDateRange(weekNumber: number, year?: number): string {
  const currentYear = year || new Date().getFullYear()
  const jan4 = new Date(Date.UTC(currentYear, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum + 1)
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startMonth = monday.getMonth() + 1
  const startDay = monday.getDate()
  const endMonth = sunday.getMonth() + 1
  const endDay = sunday.getDate()

  return `(${startMonth}/${startDay}-${endMonth}/${endDay})`
}

export default function FuelPage() {
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: trucksData } = useTrucks()

  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []

  // Load fuel data from localStorage
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())
  const hasInitiallyCollapsed = useRef(false)

  const currentYear = new Date().getFullYear()

  // Load from localStorage on mount
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

  // Save to localStorage when entries change
  useEffect(() => {
    if (fuelEntries.length > 0) {
      localStorage.setItem(FUEL_STORAGE_KEY, JSON.stringify(fuelEntries))
    }
  }, [fuelEntries])

  // Generate all 52 weeks
  const allWeeks = useMemo(() => {
    const weeks = []
    for (let i = 1; i <= 52; i++) {
      weeks.push(i)
    }
    return weeks
  }, [])

  // Group fuel entries by week and driver
  const fuelByWeekAndDriver = useMemo(() => {
    const grouped: Record<number, Record<number, FuelEntry | null>> = {}

    allWeeks.forEach(weekNum => {
      grouped[weekNum] = {}
      drivers.forEach(driver => {
        grouped[weekNum][driver.id] = null
      })
    })

    fuelEntries.forEach(entry => {
      if (grouped[entry.weekNumber] && entry.driverId) {
        grouped[entry.weekNumber][entry.driverId] = entry
      }
    })

    return grouped
  }, [fuelEntries, drivers, allWeeks])

  // Initially collapse all weeks
  useEffect(() => {
    if (!hasInitiallyCollapsed.current && allWeeks.length > 0) {
      setCollapsedWeeks(new Set(allWeeks))
      hasInitiallyCollapsed.current = true
    }
  }, [allWeeks])

  const toggleWeek = (weekNum: number) => {
    const newCollapsed = new Set(collapsedWeeks)
    if (newCollapsed.has(weekNum)) {
      newCollapsed.delete(weekNum)
    } else {
      newCollapsed.add(weekNum)
    }
    setCollapsedWeeks(newCollapsed)
  }

  const handleCellClick = (weekNumber: number, driverId: number, field: string) => {
    const existing = fuelByWeekAndDriver[weekNumber]?.[driverId]
    setEditingCell({ weekNumber, driverId, field })
    if (existing) {
      setEditValues({ ...existing })
    } else {
      setEditValues({
        weekNumber,
        driverId,
        truckId: null,
        gallons: 0,
        pricePerGallon: 0,
        defGallons: 0,
        defPrice: 0,
        totalAmount: 0,
      })
    }
  }

  const handleCellChange = (field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCellBlur = () => {
    if (!editingCell) return

    const { weekNumber, driverId } = editingCell
    const existing = fuelByWeekAndDriver[weekNumber]?.[driverId]

    // Check if there's any meaningful data
    const hasData = editValues.gallons > 0 || editValues.totalAmount > 0 || editValues.defGallons > 0

    if (hasData) {
      if (existing) {
        // Update existing
        setFuelEntries(prev => prev.map(e =>
          e.id === existing.id ? { ...e, ...editValues } : e
        ))
      } else {
        // Create new
        const newEntry: FuelEntry = {
          id: `${weekNumber}-${driverId}-${Date.now()}`,
          weekNumber,
          driverId,
          truckId: editValues.truckId || null,
          gallons: editValues.gallons || 0,
          pricePerGallon: editValues.pricePerGallon || 0,
          defGallons: editValues.defGallons || 0,
          defPrice: editValues.defPrice || 0,
          totalAmount: editValues.totalAmount || 0,
        }
        setFuelEntries(prev => [...prev, newEntry])
      }
    }

    setEditingCell(null)
  }

  const handleDeleteRow = (weekNumber: number, driverId: number) => {
    const entry = fuelByWeekAndDriver[weekNumber]?.[driverId]
    if (entry && confirm('Delete this fuel entry?')) {
      setFuelEntries(prev => prev.filter(e => e.id !== entry.id))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  if (driversLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  const renderFuelRow = (weekNum: number, driver: any, rowIndex: number) => {
    const entry = fuelByWeekAndDriver[weekNum]?.[driver.id]
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    const isEditingField = (field: string) =>
      editingCell?.weekNumber === weekNum &&
      editingCell?.driverId === driver.id &&
      editingCell?.field === field

    const getValue = (field: string) => {
      if (isEditingField(field)) {
        return editValues[field]
      }
      return entry?.[field as keyof FuelEntry]
    }

    return (
      <tr
        key={`${weekNum}-${driver.id}`}
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
      >
        {/* Empty cell for indent */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)', width: '20px' }}></td>

        {/* Driver */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)' }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}>
            {driver.first_name} {driver.last_name}
          </div>
        </td>

        {/* Truck */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('truckId') ? (
            <select
              className="w-full px-2 py-1 border rounded text-sm"
              value={editValues.truckId || ''}
              onChange={(e) => handleCellChange('truckId', parseInt(e.target.value) || null)}
              onBlur={handleCellBlur}
              autoFocus
            >
              <option value="">Select</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truck_number}
                </option>
              ))}
            </select>
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'truckId')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {trucks.find(t => t.id === entry?.truckId)?.truck_number || '-'}
            </div>
          )}
        </td>

        {/* Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('gallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.gallons || ''}
              onChange={(e) => handleCellChange('gallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'gallons')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {entry?.gallons ? entry.gallons.toFixed(1) : '-'}
            </div>
          )}
        </td>

        {/* Price/Gal */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('pricePerGallon') ? (
            <input
              type="number"
              step="0.001"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.pricePerGallon || ''}
              onChange={(e) => handleCellChange('pricePerGallon', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'pricePerGallon')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {entry?.pricePerGallon ? `$${entry.pricePerGallon.toFixed(3)}` : '-'}
            </div>
          )}
        </td>

        {/* DEF Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('defGallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.defGallons || ''}
              onChange={(e) => handleCellChange('defGallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'defGallons')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {entry?.defGallons ? entry.defGallons.toFixed(1) : '-'}
            </div>
          )}
        </td>

        {/* DEF Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('defPrice') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.defPrice || ''}
              onChange={(e) => handleCellChange('defPrice', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'defPrice')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {entry?.defPrice ? `$${entry.defPrice.toFixed(2)}` : '-'}
            </div>
          )}
        </td>

        {/* Total */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('totalAmount') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.totalAmount || ''}
              onChange={(e) => handleCellChange('totalAmount', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'totalAmount')}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: '#16a34a' }}
            >
              {entry?.totalAmount ? formatCurrency(entry.totalAmount) : '-'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {entry && (
            <button
              onClick={() => handleDeleteRow(weekNum, driver.id)}
              className="p-1 hover:bg-red-100 rounded"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--colors-foreground-default)' }}>Fuel</h1>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--cell-background-header)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)', width: '20px' }}></th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Driver</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Truck</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Gallons</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Price/Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>DEF Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>DEF Price</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Total</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allWeeks.map((weekNum) => {
                const isCollapsed = collapsedWeeks.has(weekNum)
                const weekEntries = fuelEntries.filter(e => e.weekNumber === weekNum)
                const weekTotal = weekEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0)
                const weekGallons = weekEntries.reduce((sum, e) => sum + (e.gallons || 0), 0)

                return (
                  <React.Fragment key={weekNum}>
                    {/* Week Header */}
                    <tr
                      className="bg-cyan-50 border-b cursor-pointer"
                      style={{ borderColor: 'var(--cell-borderColor)' }}
                      onClick={() => toggleWeek(weekNum)}
                    >
                      <td colSpan={2} className="px-2 py-2" style={{ paddingLeft: '8px' }}>
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--colors-foreground-default)' }}>
                            Week {weekNum} {getWeekDateRange(weekNum, currentYear)}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--colors-foreground-muted)' }}>
                            ({weekEntries.length} entries)
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2" colSpan={5}></td>
                      <td className="px-2 py-2">
                        <div className="mb-0.5">
                          <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: '#16a34a' }}>
                            {formatCurrency(weekTotal)}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: '#2563eb' }}>
                          {weekGallons.toFixed(1)} gal
                        </div>
                      </td>
                      <td className="px-2 py-2"></td>
                    </tr>

                    {/* Driver Rows */}
                    {!isCollapsed && drivers.map((driver, driverIndex) =>
                      renderFuelRow(weekNum, driver, driverIndex)
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
