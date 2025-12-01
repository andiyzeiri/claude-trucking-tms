'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDrivers } from '@/hooks/use-drivers'
import { useLoads } from '@/hooks/use-loads'
import { ChevronLeft, ChevronRight, X, MapPin, Clock, User, Calendar } from 'lucide-react'
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
    return location.length > 20 ? location.substring(0, 20) + '...' : location
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
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
          </div>
        </div>

        {/* Week Range Display */}
        <div className="text-center">
          <h2 className="text-lg font-medium" style={{ color: 'var(--monday-text-primary)' }}>
            {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
          </h2>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date())
            const dayName = format(day, 'EEE')
            const dayNumber = format(day, 'd')

            return (
              <Card
                key={day.toISOString()}
                className="min-h-[500px]"
                style={{
                  borderColor: isToday ? 'var(--monday-cornflower)' : 'var(--monday-border-light)',
                  borderWidth: isToday ? '2px' : '1px'
                }}
              >
                {/* Day Header */}
                <div
                  className="p-3 text-center border-b"
                  style={{
                    backgroundColor: isToday ? 'rgba(97, 97, 255, 0.1)' : 'var(--monday-bg-secondary)',
                    borderColor: 'var(--monday-border-light)'
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>
                    {dayName}
                  </div>
                  <div
                    className={`text-2xl font-bold ${isToday ? 'text-white bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center mx-auto' : ''}`}
                    style={{ color: isToday ? undefined : 'var(--monday-text-primary)' }}
                  >
                    {dayNumber}
                  </div>
                </div>

                {/* Driver Assignments */}
                <CardContent className="p-2 space-y-2 overflow-y-auto max-h-[430px]">
                  {drivers.length === 0 ? (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--monday-text-muted)' }}>
                      No drivers
                    </div>
                  ) : (
                    drivers.map((driver) => {
                      const isOff = isDriverOff(driver.id, day)
                      const driverLoads = getLoadsForDriverOnDay(driver.id, day)

                      return (
                        <div
                          key={driver.id}
                          className={`rounded-lg p-2 text-xs transition-all ${
                            isOff
                              ? 'bg-gray-100 opacity-50'
                              : driverLoads.length > 0
                                ? 'bg-blue-50 border border-blue-200'
                                : 'bg-green-50 border border-green-200'
                          }`}
                        >
                          {/* Driver Header */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" style={{ color: 'var(--monday-cornflower)' }} />
                              <span className="font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
                                {driver.first_name} {driver.last_name?.charAt(0)}.
                              </span>
                            </div>
                            <button
                              onClick={() => toggleDriverDayOff(driver.id, day)}
                              className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                              title={isOff ? 'Mark as working' : 'Mark as day off'}
                            >
                              <X className={`h-3 w-3 ${isOff ? 'text-green-600' : 'text-red-500'}`} />
                            </button>
                          </div>

                          {isOff ? (
                            <div className="text-center py-1 text-gray-500 italic">
                              Day Off
                            </div>
                          ) : driverLoads.length === 0 ? (
                            <div className="text-center py-1 text-green-600">
                              Available
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {driverLoads.map((load) => {
                                const pickupDate = load.pickup_date ? parseISO(load.pickup_date) : null
                                const deliveryDate = load.delivery_date ? parseISO(load.delivery_date) : null
                                const isPickupDay = pickupDate && isSameDay(pickupDate, day)
                                const isDeliveryDay = deliveryDate && isSameDay(deliveryDate, day)

                                return (
                                  <div key={load.id} className="bg-white rounded p-1.5 border border-gray-200">
                                    <div className="font-medium text-blue-600 mb-1">
                                      #{load.load_number}
                                    </div>
                                    {isPickupDay && (
                                      <div className="flex items-center gap-1 text-green-700">
                                        <MapPin className="h-2.5 w-2.5" />
                                        <span>P: {getShortLocation(load.pickup_location)}</span>
                                        {load.pickup_date && (
                                          <span className="ml-auto flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatTime(load.pickup_date)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {isDeliveryDay && (
                                      <div className="flex items-center gap-1 text-red-700">
                                        <MapPin className="h-2.5 w-2.5" />
                                        <span>D: {getShortLocation(load.delivery_location)}</span>
                                        {load.delivery_date && (
                                          <span className="ml-auto flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatTime(load.delivery_date)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          })}
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
