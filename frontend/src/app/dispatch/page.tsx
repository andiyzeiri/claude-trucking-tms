'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { useDrivers } from '@/hooks/use-drivers'
import { useLoads, useUpdateLoad } from '@/hooks/use-loads'
import { ChevronLeft, ChevronRight, MapPin, Clock, User, X, Truck, GripVertical } from 'lucide-react'
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Load } from '@/types'
import toast from 'react-hot-toast'

interface DayOffDriver {
  driverId: number
  date: string // ISO date string
}

// Draggable Trip Card Component (for unassigned column)
function DraggableTripCard({ load, formatDateTime, getShortLocation }: {
  load: Load
  formatDateTime: (dateStr: string | undefined) => string
  getShortLocation: (location: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `load-${load.id}`,
    data: { load },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg p-2 bg-white border border-gray-200 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="font-semibold text-blue-700">#{load.load_number}</span>
      </div>
      <div className="space-y-1 ml-4">
        <div className="flex items-start gap-1 text-green-700">
          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{getShortLocation(load.pickup_location)}</div>
            <div className="text-gray-500 text-[10px]">{formatDateTime(load.pickup_date)}</div>
          </div>
        </div>
        <div className="flex items-start gap-1 text-red-700">
          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{getShortLocation(load.delivery_location)}</div>
            <div className="text-gray-500 text-[10px]">{formatDateTime(load.delivery_date)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Draggable Assigned Load Component (for driver cells)
function DraggableAssignedLoad({ load, day, formatTime, getShortLocation, onUnassign }: {
  load: Load
  day: Date
  formatTime: (dateStr: string | undefined) => string
  getShortLocation: (location: string) => string
  onUnassign: (loadId: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `load-${load.id}`,
    data: { load },
  })

  const pickupDate = load.pickup_date ? parseISO(load.pickup_date) : null
  const deliveryDate = load.delivery_date ? parseISO(load.delivery_date) : null
  const isPickupDay = pickupDate && isSameDay(pickupDate, day)
  const isDeliveryDay = deliveryDate && isSameDay(deliveryDate, day)

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg p-2 bg-blue-50 border border-blue-200 text-xs cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      {/* Unassign X button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onUnassign(load.id)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Unassign load"
      >
        <X className="h-2.5 w-2.5" />
      </button>
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="font-semibold text-blue-700">#{load.load_number}</span>
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
}

// Overlay card shown while dragging
function DragOverlayCard({ load, formatDateTime, getShortLocation }: {
  load: Load
  formatDateTime: (dateStr: string | undefined) => string
  getShortLocation: (location: string) => string
}) {
  return (
    <div className="rounded-lg p-2 bg-white border-2 border-blue-400 text-xs shadow-lg w-48">
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="font-semibold text-blue-700">#{load.load_number}</span>
      </div>
      <div className="space-y-1 ml-4">
        <div className="flex items-start gap-1 text-green-700">
          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{getShortLocation(load.pickup_location)}</div>
            <div className="text-gray-500 text-[10px]">{formatDateTime(load.pickup_date)}</div>
          </div>
        </div>
        <div className="flex items-start gap-1 text-red-700">
          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{getShortLocation(load.delivery_location)}</div>
            <div className="text-gray-500 text-[10px]">{formatDateTime(load.delivery_date)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Droppable Unassigned Column
function DroppableUnassignedColumn({ children, isOver }: { children: React.ReactNode, isOver: boolean }) {
  return (
    <div
      className={`p-2 space-y-2 overflow-y-auto flex-1 transition-colors ${isOver ? 'bg-orange-50' : ''}`}
      style={{ minHeight: '200px' }}
    >
      {children}
    </div>
  )
}

// Droppable Driver Row Component
function DroppableDriverRow({ driverId, children }: { driverId: number, children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `driver-${driverId}`,
    data: { driverId },
  })

  return (
    <tr
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
      style={{ backgroundColor: isOver ? 'rgba(59, 130, 246, 0.15)' : undefined }}
    >
      {children}
    </tr>
  )
}

export default function DispatchBoardPage() {
  const { data: driversData } = useDrivers(1, 100)
  const { data: loadsData, refetch: refetchLoads } = useLoads(1, 10000) // Get all loads
  const updateLoad = useUpdateLoad()

  const allDrivers = driversData?.items || []
  const loads = loadsData?.items || []

  // Filter out terminated drivers (those with date_terminated set)
  const drivers = useMemo(() => {
    return allDrivers.filter(driver => !driver.date_terminated)
  }, [allDrivers])

  // Track which drivers are marked as off for which days
  const [daysOff, setDaysOff] = useState<DayOffDriver[]>([])

  // Current week start date (Monday)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Get unassigned loads (no driver assigned) for the current week, sorted by pickup date
  const unassignedLoads = useMemo(() => {
    const weekStartDay = startOfDay(weekStart)
    const weekEndDay = endOfDay(addDays(weekStart, 6))

    return loads
      .filter(load => {
        if (load.driver_id) return false

        // Check if pickup or delivery falls within the current week
        const pickupDate = load.pickup_date ? startOfDay(parseISO(load.pickup_date)) : null
        const deliveryDate = load.delivery_date ? startOfDay(parseISO(load.delivery_date)) : null

        const isPickupInWeek = pickupDate && pickupDate >= weekStartDay && pickupDate <= weekEndDay
        const isDeliveryInWeek = deliveryDate && deliveryDate >= weekStartDay && deliveryDate <= weekEndDay

        return isPickupInWeek || isDeliveryInWeek
      })
      .sort((a, b) => {
        const dateA = a.pickup_date ? new Date(a.pickup_date).getTime() : 0
        const dateB = b.pickup_date ? new Date(b.pickup_date).getTime() : 0
        return dateA - dateB
      })
  }, [loads, weekStart])

  // Drag state for overlay
  const [activeLoad, setActiveLoad] = useState<Load | null>(null)

  // Configure sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Generate 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  // Navigate weeks
  const goToPreviousWeek = () => setWeekStart(addDays(weekStart, -7))
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7))
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

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

  // Toggle entire week off for a driver
  const toggleDriverWeekOff = (driverId: number) => {
    const weekDates = weekDays.map(day => format(day, 'yyyy-MM-dd'))
    setDaysOff(prev => {
      // Check if all days of the week are already off
      const allDaysOff = weekDates.every(dateStr =>
        prev.some(d => d.driverId === driverId && d.date === dateStr)
      )

      if (allDaysOff) {
        // Remove all days of this week for this driver
        return prev.filter(d => !(d.driverId === driverId && weekDates.includes(d.date)))
      } else {
        // Add all days of this week for this driver (that aren't already off)
        const newDaysOff = [...prev]
        weekDates.forEach(dateStr => {
          if (!newDaysOff.some(d => d.driverId === driverId && d.date === dateStr)) {
            newDaysOff.push({ driverId, date: dateStr })
          }
        })
        return newDaysOff
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

  // Format date and time together
  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    try {
      const date = parseISO(dateStr)
      return format(date, 'M/d h:mm a')
    } catch {
      return ''
    }
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
      const city = parts[parts.length - 2].trim()
      const stateZip = parts[parts.length - 1].trim()
      const state = stateZip.substring(0, 2).toUpperCase()
      return `${city}, ${state}`
    }
    return location.length > 15 ? location.substring(0, 15) + '...' : location
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const load = active.data.current?.load as Load
    if (load) {
      setActiveLoad(load)
    }
  }

  // Droppable for unassigned column
  const { isOver: isOverUnassigned, setNodeRef: setUnassignedRef } = useDroppable({
    id: 'unassigned',
    data: { unassigned: true },
  })

  // Handle drag end - assign or unassign driver
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLoad(null)

    if (!over) return

    const load = active.data.current?.load as Load
    const driverId = over.data.current?.driverId as number | undefined
    const isUnassigned = over.data.current?.unassigned as boolean | undefined

    if (!load) return

    // Dropping on unassigned column - remove driver
    if (isUnassigned) {
      if (load.driver_id) {
        updateLoad.mutate(
          { id: load.id, data: { driver_id: null as any } },
          {
            onSuccess: () => {
              toast.success(`Load #${load.load_number} unassigned`)
              refetchLoads()
            },
            onError: () => {
              toast.error('Failed to unassign load')
            },
          }
        )
      }
      return
    }

    // Dropping on a driver row - assign driver
    if (driverId && driverId !== load.driver_id) {
      updateLoad.mutate(
        { id: load.id, data: { driver_id: driverId } },
        {
          onSuccess: () => {
            toast.success(`Load #${load.load_number} assigned to driver`)
            refetchLoads()
          },
          onError: () => {
            toast.error('Failed to assign load to driver')
          },
        }
      )
    }
  }

  // Handle unassign load via X button
  const handleUnassign = (loadId: number) => {
    const load = loads.find(l => l.id === loadId)
    if (!load) return

    updateLoad.mutate(
      { id: loadId, data: { driver_id: null as any } },
      {
        onSuccess: () => {
          toast.success(`Load #${load.load_number} unassigned`)
          refetchLoads()
        },
        onError: () => {
          toast.error('Failed to unassign load')
        },
      }
    )
  }

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; driverId: number } | null>(null)

  // Handle right-click on driver
  const handleDriverContextMenu = (e: React.MouseEvent, driverId: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, driverId })
  }

  // Close context menu
  const closeContextMenu = () => setContextMenu(null)

  return (
    <Layout>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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

          {/* Main Layout with Trips Sidebar and Dispatch Table */}
          <div className="flex gap-4">
            {/* Trips Column - Unassigned Loads (Droppable) */}
            <div
              className="w-56 flex-shrink-0 border rounded-lg bg-white overflow-hidden flex flex-col"
              style={{ borderColor: 'var(--cell-borderColor)', maxHeight: 'calc(100vh - 200px)' }}
            >
              <div
                className="px-3 py-3 border-b sticky top-0 z-10"
                style={{
                  backgroundColor: 'var(--cell-background-header)',
                  borderColor: 'var(--cell-borderColor)'
                }}
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span className="font-semibold text-sm" style={{ color: 'var(--colors-foreground-default)' }}>
                    Unassigned Trips
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--colors-foreground-muted)' }}>
                  {unassignedLoads.length} {unassignedLoads.length === 1 ? 'load' : 'loads'} to assign
                </div>
              </div>
              <div
                ref={setUnassignedRef}
                className={`p-2 space-y-2 overflow-y-auto flex-1 transition-colors ${isOverUnassigned ? 'bg-orange-50 border-2 border-dashed border-orange-300' : ''}`}
                style={{ minHeight: '200px' }}
              >
                {unassignedLoads.length === 0 && !isOverUnassigned ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--monday-text-muted)' }}>
                    No unassigned loads
                  </div>
                ) : (
                  <>
                    {unassignedLoads.map((load) => (
                      <DraggableTripCard
                        key={load.id}
                        load={load}
                        formatDateTime={formatDateTime}
                        getShortLocation={getShortLocation}
                      />
                    ))}
                    {isOverUnassigned && unassignedLoads.length === 0 && (
                      <div className="text-center py-4 text-sm text-orange-600">
                        Drop here to unassign
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Dispatch Table */}
            <div className="flex-1 border rounded-lg bg-white overflow-hidden" style={{ borderColor: 'var(--cell-borderColor)' }}>
              <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead className="sticky top-0 z-20">
                    <tr style={{ backgroundColor: 'var(--cell-background-header)' }}>
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold border-b border-r sticky left-0 z-30"
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
                          <DroppableDriverRow key={driver.id} driverId={driver.id}>
                            {/* Driver Name Column */}
                            <td
                              className="px-4 py-3 border-b border-r sticky left-0 z-10 cursor-context-menu"
                              style={{
                                borderColor: 'var(--cell-borderColor)',
                                backgroundColor: rowBgColor
                              }}
                              onContextMenu={(e) => handleDriverContextMenu(e, driver.id)}
                            >
                              <div>
                                <div className="font-medium text-sm" style={{ color: 'var(--colors-foreground-default)' }}>
                                  {driver.first_name} {driver.last_name}
                                </div>
                                {driver.phone && (
                                  <div className="text-xs" style={{ color: 'var(--colors-foreground-muted)' }}>
                                    {driver.phone}
                                  </div>
                                )}
                                <div className="flex gap-2 text-xs" style={{ color: 'var(--colors-foreground-muted)' }}>
                                  {driver.truck && (
                                    <span>T: {driver.truck.truck_number}</span>
                                  )}
                                  {driver.trailer && (
                                    <span>TR: {driver.trailer.truck_number}</span>
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
                                        <span className="text-sm text-gray-500 font-medium">OFF</span>
                                      </div>
                                    ) : driverLoads.length === 0 ? (
                                      <div
                                        className="h-full flex items-center justify-center rounded-lg bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                                        style={{ minHeight: '70px' }}
                                        onClick={() => toggleDriverDayOff(driver.id, day)}
                                        title="Click to mark as off"
                                      >
                                        <span className="text-sm text-green-600 font-medium">Available</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        {driverLoads.map((load) => (
                                          <DraggableAssignedLoad
                                            key={load.id}
                                            load={load}
                                            day={day}
                                            formatTime={formatTime}
                                            getShortLocation={getShortLocation}
                                            onUnassign={handleUnassign}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </DroppableDriverRow>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
              <span style={{ color: 'var(--monday-text-secondary)' }}>OFF</span>
            </div>
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span style={{ color: 'var(--monday-text-secondary)' }}>Drag to assign/reassign</span>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeLoad ? (
            <DragOverlayCard
              load={activeLoad}
              formatDateTime={formatDateTime}
              getShortLocation={getShortLocation}
            />
          ) : null}
        </DragOverlay>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={closeContextMenu}
            />
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[160px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  toggleDriverWeekOff(contextMenu.driverId)
                  closeContextMenu()
                }}
              >
                <X className="h-4 w-4" />
                OFF Entire Week
              </button>
            </div>
          </>
        )}
      </DndContext>
    </Layout>
  )
}
