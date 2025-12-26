'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { useDrivers } from '@/hooks/use-drivers'
import { useLoads } from '@/hooks/use-loads'
import { ChevronLeft, ChevronRight, MapPin, Clock, User, X } from 'lucide-react'
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'

interface DayOffDriver {
  driverId: number
  date: string // ISO date string
}

export default function DispatchBoardPage() {
  const { data: driversData } = useDrivers(1, 100)
  const { data: loadsData } = useLoads(1, 1000) // Get all loads

  const allDrivers = driversData?.items || []
  const loads = loadsData?.items || []

  // Filter out terminated drivers (those with date_terminated set)
  const drivers = useMemo(() => {
    return allDrivers.filter(driver => !driver.date_terminated)
  }, [allDrivers])

  // Track which drivers are marked as off for which days
  const [daysOff, setDaysOff] = useState<DayOffDriver[]>([])

  // Current week start date
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))

  // Generate 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  // Navigate weeks
  const goToPreviousWeek = () => setWeekStart(addDays(weekStart, -7))
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7))
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))

  // Check if a driver is off on a specific day
  const isDriverOff = (driverId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return daysOff.some(d => d.driverId === driverId && d.date === dateStr)
  }

  // Toggle driver day off
  const toggleDriverDayOff = (driverId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setDaysOff(prev => {
      const exists = prev.some(d => d.driverId === driverId && d.date === dateStr)
      if (exists) {
        return prev.filter(d => !(d.driverId === driverId && d.date === dateStr))
      } else {
        return [...prev, { driverId, date: dateStr }]
      }
    })
  }

  // Get loads for a specific driver on a specific day
  const getLoadsForDriverOnDay = (driverId: number, date: Date) => {
    return loads.filter(load => {
      if (load.driver_id !== driverId) return false

      // Check if pickup or delivery falls on this day
      const pickupDate = load.pickup_date ? parseISO(load.pickup_date) : null
      const deliveryDate = load.delivery_date ? parseISO(load.delivery_date) : null

      const isPickupDay = pickupDate && isSameDay(pickupDate, date)
      const isDeliveryDay = deliveryDate && isSameDay(deliveryDate, date)

      return isPickupDay || isDeliveryDay
    })
  }

  // Format time from datetime string
  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    try {
      const date = parseISO(dateStr)
      return format(date, 'h:mm a')
    } catch {
      return ''
    }
  }

  // Get short location (city, state)
  const getShortLocation = (location: string) => {
    if (!location) return ''
    // Try to extract city, state from address
    const parts = location.split(',')
    if (parts.length >= 2) {
      return `${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim().substring(0, 2)}`
    }
    return location.length > 15 ? location.substring(0, 15) + '...' : location
  }

  return (
    <Layout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
              Dispatch Board
            </h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>
              Weekly driver schedule and load assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-4 text-lg font-medium" style={{ color: 'var(--monday-text-primary)' }}>
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        {/* Dispatch Table */}
        <div className="border rounded-lg bg-white overflow-hidden" style={{ borderColor: 'var(--cell-borderColor)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--cell-background-header)' }}>
                  <th
                    className="px-4 py-3 text-left text-sm font-semibold border-b border-r sticky left-0 z-10"
                    style={{
                      color: 'var(--colors-foreground-default)',
                      borderColor: 'var(--cell-borderColor)',
                      backgroundColor: 'var(--cell-background-header)',
                      minWidth: '180px'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Driver
                    </div>
                  </th>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <th
                        key={day.toISOString()}
                        className="px-3 py-3 text-center text-sm font-semibold border-b border-r"
                        style={{
                          color: isToday ? '#2563eb' : 'var(--colors-foreground-default)',
                          borderColor: 'var(--cell-borderColor)',
                          backgroundColor: isToday ? 'rgba(37, 99, 235, 0.08)' : 'var(--cell-background-header)',
                          minWidth: '140px'
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--colors-foreground-muted)' }}>
                            {format(day, 'EEE')}
                          </span>
                          <span className={`text-lg ${isToday ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                            {format(day, 'd')}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                      No active drivers found
                    </td>
                  </tr>
                ) : (
                  drivers.map((driver, driverIndex) => {
                    const isEvenRow = driverIndex % 2 === 0
                    const rowBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

                    return (
                      <tr
                        key={driver.id}
                        className="transition-colors hover:bg-blue-50"
                        style={{ backgroundColor: rowBgColor }}
                      >
                        {/* Driver Name Column */}
                        <td
                          className="px-4 py-3 border-b border-r sticky left-0 z-10"
                          style={{
                            borderColor: 'var(--cell-borderColor)',
                            backgroundColor: rowBgColor
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                              style={{ backgroundColor: '#3b82f6' }}
                            >
                              {driver.first_name?.charAt(0)}{driver.last_name?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-sm" style={{ color: 'var(--colors-foreground-default)' }}>
                                {driver.first_name} {driver.last_name}
                              </div>
                              {driver.truck && (
                                <div className="text-xs" style={{ color: 'var(--colors-foreground-muted)' }}>
                                  Truck #{driver.truck.truck_number}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Day Cells */}
                        {weekDays.map((day) => {
                          const isToday = isSameDay(day, new Date())
                          const isOff = isDriverOff(driver.id, day)
                          const driverLoads = getLoadsForDriverOnDay(driver.id, day)

                          return (
                            <td
                              key={day.toISOString()}
                              className="px-2 py-2 border-b border-r align-top"
                              style={{
                                borderColor: 'var(--cell-borderColor)',
                                backgroundColor: isToday ? 'rgba(37, 99, 235, 0.04)' : undefined,
                                minHeight: '80px'
                              }}
                            >
                              <div className="min-h-[70px]">
                                {isOff ? (
                                  <div
                                    className="h-full flex items-center justify-center rounded-lg bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                                    style={{ minHeight: '70px' }}
                                    onClick={() => toggleDriverDayOff(driver.id, day)}
                                    title="Click to mark as working"
                                  >
                                    <span className="text-sm text-gray-500 italic">Day Off</span>
                                  </div>
                                ) : driverLoads.length === 0 ? (
                                  <div
                                    className="h-full flex items-center justify-center rounded-lg bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                                    style={{ minHeight: '70px' }}
                                    onClick={() => toggleDriverDayOff(driver.id, day)}
                                    title="Click to mark as day off"
                                  >
                                    <span className="text-sm text-green-600 font-medium">Available</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {driverLoads.map((load) => {
                                      const pickupDate = load.pickup_date ? parseISO(load.pickup_date) : null
                                      const deliveryDate = load.delivery_date ? parseISO(load.delivery_date) : null
                                      const isPickupDay = pickupDate && isSameDay(pickupDate, day)
                                      const isDeliveryDay = deliveryDate && isSameDay(deliveryDate, day)

                                      return (
                                        <div
                                          key={load.id}
                                          className="rounded-lg p-2 bg-blue-50 border border-blue-200 text-xs"
                                        >
                                          <div className="font-semibold text-blue-700 mb-1">
                                            #{load.load_number}
                                          </div>
                                          {isPickupDay && (
                                            <div className="flex items-center gap-1 text-green-700">
                                              <MapPin className="h-3 w-3 flex-shrink-0" />
                                              <span className="truncate">P: {getShortLocation(load.pickup_location)}</span>
                                              {load.pickup_date && (
                                                <span className="ml-auto flex items-center gap-0.5 text-xs whitespace-nowrap">
                                                  <Clock className="h-2.5 w-2.5" />
                                                  {formatTime(load.pickup_date)}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          {isDeliveryDay && (
                                            <div className="flex items-center gap-1 text-red-700">
                                              <MapPin className="h-3 w-3 flex-shrink-0" />
                                              <span className="truncate">D: {getShortLocation(load.delivery_location)}</span>
                                              {load.delivery_date && (
                                                <span className="ml-auto flex items-center gap-0.5 text-xs whitespace-nowrap">
                                                  <Clock className="h-2.5 w-2.5" />
                                                  {formatTime(load.delivery_date)}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                    {/* Add day off toggle button for cells with loads */}
                                    <button
                                      onClick={() => toggleDriverDayOff(driver.id, day)}
                                      className="w-full text-xs text-gray-400 hover:text-red-500 py-1 transition-colors"
                                      title="Mark as day off"
                                    >
                                      <X className="h-3 w-3 mx-auto" />
                                    </button>
                                  </div>
                                )}
                              </div>
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
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-50 border border-green-200"></div>
            <span style={{ color: 'var(--monday-text-secondary)' }}>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200"></div>
            <span style={{ color: 'var(--monday-text-secondary)' }}>Has Loads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100"></div>
            <span style={{ color: 'var(--monday-text-secondary)' }}>Day Off</span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
