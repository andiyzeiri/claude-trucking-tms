'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDrivers } from '@/hooks/use-drivers'
import { useLoads, useUpdateLoad, useCreateLoad } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, MapPin, Clock, User, X, Truck, Plus, DollarSign, Route, Package, FileText, Calendar } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
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
import api from '@/lib/api'
import { useQuery, useMutation, useQueryClient as useQueryClientHook } from '@tanstack/react-query'

// Backend stores wall-clock time as UTC (e.g., 6 AM local is stored as T06:00:00Z)
// This normalizes datetime strings to ensure they're treated as UTC
function normalizeDateTime(dateString: string): string {
  if (!dateString) return dateString
  // If already has timezone info (Z or +/-offset), return as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return dateString
  }
  // Append Z to treat as UTC
  return dateString + 'Z'
}

// Compare if two dates are the same day using UTC (wall-clock time)
function isSameDayUTC(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate()
}

// Get a date as UTC from a local date (for comparing with stored UTC wall-clock times)
function toUTCDate(localDate: Date): Date {
  return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()))
}

interface DayOffDriver {
  driverId: number
  date: string // ISO date string
}

// Load Details Tooltip Content - Compact version
function LoadDetailsTooltipContent({ load, formatDateTime }: {
  load: Load
  formatDateTime: (dateStr: string | undefined) => string
}) {
  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'dispatched': return 'bg-indigo-100 text-indigo-800'
      case 'in_transit': return 'bg-amber-100 text-amber-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-1.5 text-[10px]">
      {/* Header with Load Number and Status */}
      <div className="flex items-center justify-between border-b pb-1">
        <span className="font-bold text-xs text-slate-800">{load.load_number}</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getStatusColor(load.status)}`}>
          {formatStatus(load.status)}
        </span>
      </div>

      {/* Customer */}
      {load.customer && (
        <div className="flex items-center gap-1">
          <Package className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
          <span className="text-slate-500">Customer:</span>
          <span className="font-medium text-slate-700 truncate">{load.customer.name}</span>
        </div>
      )}

      {/* Pickup */}
      <div className="flex items-start gap-1">
        <div className="w-2.5 h-2.5 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin className="h-1.5 w-1.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-700 truncate">{load.pickup_location || '-'}</div>
          <div className="text-slate-400">{formatDateTime(load.pickup_date)}</div>
        </div>
      </div>

      {/* Delivery */}
      <div className="flex items-start gap-1">
        <div className="w-2.5 h-2.5 rounded bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin className="h-1.5 w-1.5 text-rose-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-700 truncate">{load.delivery_location || '-'}</div>
          <div className="text-slate-400">{formatDateTime(load.delivery_date)}</div>
        </div>
      </div>

      {/* Financial Info */}
      <div className="flex items-center gap-3 pt-1 border-t">
        <div className="flex items-center gap-1">
          <Route className="h-2.5 w-2.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{load.miles?.toLocaleString() || '-'} mi</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="h-2.5 w-2.5 text-slate-400" />
          <span className="font-semibold text-emerald-600">{formatCurrency(load.rate)}</span>
        </div>
        {load.miles && load.rate && load.miles > 0 && (
          <span className="text-slate-400">({formatCurrency(load.rate / load.miles)}/mi)</span>
        )}
      </div>

      {/* Driver & Truck */}
      {(load.driver || load.truck) && (
        <div className="flex items-center gap-2 pt-1 border-t text-slate-500">
          {load.driver && (
            <span><User className="h-2.5 w-2.5 inline mr-0.5" />{load.driver.first_name} {load.driver.last_name}</span>
          )}
          {load.truck && (
            <span><Truck className="h-2.5 w-2.5 inline mr-0.5" />#{load.truck.truck_number}</span>
          )}
        </div>
      )}

      {/* Notes */}
      {load.notes && (
        <div className="pt-1 border-t text-slate-500 truncate">
          <FileText className="h-2.5 w-2.5 inline mr-0.5" />{load.notes}
        </div>
      )}
    </div>
  )
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
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={`rounded-lg p-2.5 bg-white border border-slate-200 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:border-slate-300 transition-all ${isDragging ? 'opacity-50' : ''}`}
          {...listeners}
          {...attributes}
        >
          <div className="font-semibold text-slate-700 mb-1.5">{load.load_number}</div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5 text-slate-600">
              <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-2.5 w-2.5 text-emerald-600" />
              </div>
              <div>
                <div className="font-medium text-slate-700">{getShortLocation(load.pickup_location)}</div>
                <div className="text-slate-400 text-[10px]">{formatDateTime(load.pickup_date)}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-slate-600">
              <div className="w-4 h-4 rounded bg-rose-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-2.5 w-2.5 text-rose-500" />
              </div>
              <div>
                <div className="font-medium text-slate-700">{getShortLocation(load.delivery_location)}</div>
                <div className="text-slate-400 text-[10px]">{formatDateTime(load.delivery_date)}</div>
              </div>
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-52 p-2">
        <LoadDetailsTooltipContent load={load} formatDateTime={formatDateTime} />
      </HoverCardContent>
    </HoverCard>
  )
}

// Draggable Assigned Load Component (for driver cells)
function DraggableAssignedLoad({ load, day, formatTime, formatDateTime, getShortLocation, onUnassign, fillCell }: {
  load: Load
  day: Date
  formatTime: (dateStr: string | undefined) => string
  formatDateTime: (dateStr: string | undefined) => string
  getShortLocation: (location: string) => string
  onUnassign: (loadId: number) => void
  fillCell?: boolean
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
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            ...style,
            ...(fillCell ? { minHeight: '70px', height: '100%' } : {})
          }}
          className={`relative rounded-lg p-2 bg-white border border-slate-200 text-xs cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-300 transition-all group flex flex-col justify-center ${isDragging ? 'opacity-50' : ''}`}
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
            className="absolute -top-1 -right-1 w-4 h-4 bg-slate-400 hover:bg-slate-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            title="Unassign load"
          >
            <X className="h-2.5 w-2.5" />
          </button>
          <div className="font-semibold text-slate-700 mb-1">{load.load_number}</div>
          {isPickupDay && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <div className="w-3.5 h-3.5 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-2 w-2 text-emerald-600" />
              </div>
              <span className="truncate font-medium">{getShortLocation(load.pickup_location)}</span>
              {load.pickup_date && (
                <span className="ml-auto flex items-center gap-0.5 text-slate-400 whitespace-nowrap">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTime(load.pickup_date)}
                </span>
              )}
            </div>
          )}
          {isDeliveryDay && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <div className="w-3.5 h-3.5 rounded bg-rose-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-2 w-2 text-rose-500" />
              </div>
              <span className="truncate font-medium">{getShortLocation(load.delivery_location)}</span>
              {load.delivery_date && (
                <span className="ml-auto flex items-center gap-0.5 text-slate-400 whitespace-nowrap">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTime(load.delivery_date)}
                </span>
              )}
            </div>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-52 p-2">
        <LoadDetailsTooltipContent load={load} formatDateTime={formatDateTime} />
      </HoverCardContent>
    </HoverCard>
  )
}

// Overlay card shown while dragging
function DragOverlayCard({ load, formatDateTime, getShortLocation }: {
  load: Load
  formatDateTime: (dateStr: string | undefined) => string
  getShortLocation: (location: string) => string
}) {
  return (
    <div className="rounded-lg p-2.5 bg-white border-2 border-indigo-400 text-xs shadow-xl w-48">
      <div className="font-semibold text-slate-700 mb-1.5">{load.load_number}</div>
      <div className="space-y-1.5">
        <div className="flex items-start gap-1.5 text-slate-600">
          <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-2.5 w-2.5 text-emerald-600" />
          </div>
          <div>
            <div className="font-medium text-slate-700">{getShortLocation(load.pickup_location)}</div>
            <div className="text-slate-400 text-[10px]">{formatDateTime(load.pickup_date)}</div>
          </div>
        </div>
        <div className="flex items-start gap-1.5 text-slate-600">
          <div className="w-4 h-4 rounded bg-rose-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-2.5 w-2.5 text-rose-500" />
          </div>
          <div>
            <div className="font-medium text-slate-700">{getShortLocation(load.delivery_location)}</div>
            <div className="text-slate-400 text-[10px]">{formatDateTime(load.delivery_date)}</div>
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
      className={`p-2 space-y-2 overflow-y-auto flex-1 transition-colors ${isOver ? 'bg-indigo-50' : ''}`}
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
      className={`transition-colors ${isOver ? '' : 'hover:bg-slate-50'}`}
      style={{ backgroundColor: isOver ? 'rgba(99, 102, 241, 0.08)' : undefined }}
    >
      {children}
    </tr>
  )
}

// New Load Form Data interface
interface NewLoadFormData {
  load_number: string
  customer_id: number | null
  pickup_location: string
  delivery_location: string
  pickup_date: string
  pickup_time: string
  delivery_date: string
  delivery_time: string
  miles: number
  rate: number
}

export default function DispatchBoardPage() {
  const queryClient = useQueryClient()
  const { data: driversData } = useDrivers(1, 100)
  const { data: loadsData } = useLoads(1, 10000) // Get all loads
  const { data: customersData } = useCustomers(1, 100)
  const updateLoad = useUpdateLoad()
  const createLoad = useCreateLoad()

  const customers = customersData?.items || []

  // Optimistic update helper - instantly updates the cache
  const optimisticUpdateLoad = (loadId: number, newDriverId: number | null) => {
    queryClient.setQueryData(['loads', 1, 10000], (oldData: any) => {
      if (!oldData?.items) return oldData
      return {
        ...oldData,
        items: oldData.items.map((load: Load) =>
          load.id === loadId ? { ...load, driver_id: newDriverId } : load
        )
      }
    })
  }

  const allDrivers = driversData?.items || []
  const loads = loadsData?.items || []

  // Filter out terminated drivers and "Outside Carrier" driver (brokerage loads)
  const drivers = useMemo(() => {
    return allDrivers.filter(driver => {
      if (driver.date_terminated) return false
      // Exclude "Outside Carrier" driver - those loads are brokerage and shouldn't show on dispatch board
      const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase()
      if (fullName.includes('outside carrier')) return false
      return true
    })
  }, [allDrivers])

  // Track which drivers are marked as off for which days
  // Fetch from API so it persists across all users/computers
  const { data: daysOffData } = useQuery({
    queryKey: ['driver-days-off'],
    queryFn: async () => {
      const response = await api.get('/v1/driver-days-off/')
      return response.data as { id: number; driver_id: number; date: string }[]
    },
  })

  // Convert API data to local format
  const daysOff: DayOffDriver[] = useMemo(() => {
    if (!daysOffData) return []
    return daysOffData.map(d => ({
      driverId: d.driver_id,
      date: d.date // Already in YYYY-MM-DD format from API
    }))
  }, [daysOffData])

  // Mutation to toggle day off
  const toggleDayOffMutation = useMutation({
    mutationFn: async ({ driverId, date }: { driverId: number; date: string }) => {
      const response = await api.post('/v1/driver-days-off/toggle', {
        driver_id: driverId,
        date: date
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-days-off'] })
    },
  })

  // Current week start date (Monday)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // New Load Dialog state
  const [newLoadDialogOpen, setNewLoadDialogOpen] = useState(false)
  const [newLoadTargetDriver, setNewLoadTargetDriver] = useState<number | null>(null)
  const [newLoadTargetDate, setNewLoadTargetDate] = useState<Date | null>(null)
  const [newLoadForm, setNewLoadForm] = useState<NewLoadFormData>({
    load_number: '',
    customer_id: null,
    pickup_location: '',
    delivery_location: '',
    pickup_date: '',
    pickup_time: '00:00',  // Default to midnight
    delivery_date: '',
    delivery_time: '23:59',  // Default to end of day
    miles: 0,
    rate: 0,
  })
  const [isCreatingLoad, setIsCreatingLoad] = useState(false)

  // Open new load dialog for a specific driver and date
  const openNewLoadDialog = (driverId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    // Find default customer (Absolute Trucking Inc)
    const absoluteTrucking = customers.find(c =>
      c.name?.toLowerCase().includes('absolute trucking')
    )
    const defaultCustomerId = absoluteTrucking?.id || customers[0]?.id || null

    setNewLoadTargetDriver(driverId)
    setNewLoadTargetDate(date)
    setNewLoadForm({
      load_number: '',
      customer_id: defaultCustomerId,
      pickup_location: '',
      delivery_location: '',
      pickup_date: dateStr,
      pickup_time: '00:00',  // Default to midnight (12:00 AM)
      delivery_date: dateStr,
      delivery_time: '23:59',  // Default to end of day
      miles: 0,
      rate: 0,
    })
    setNewLoadDialogOpen(true)
  }

  // Handle creating new load
  const handleCreateNewLoad = async () => {
    if (!newLoadTargetDriver) return

    setIsCreatingLoad(true)
    try {
      // Combine date and time for ISO format with Z suffix (store as UTC wall-clock time)
      const pickupDateTime = `${newLoadForm.pickup_date}T${newLoadForm.pickup_time}:00.000Z`
      const deliveryDateTime = `${newLoadForm.delivery_date}T${newLoadForm.delivery_time}:00.000Z`

      const backendData: any = {
        load_number: newLoadForm.load_number || '',
        customer_id: newLoadForm.customer_id,
        driver_id: newLoadTargetDriver,
        truck_id: null,
        pickup_location: newLoadForm.pickup_location,
        delivery_location: newLoadForm.delivery_location,
        pickup_date: pickupDateTime,
        delivery_date: deliveryDateTime,
        miles: newLoadForm.miles || 0,
        rate: newLoadForm.rate || 0,
        status: 'dispatched',
      }

      await createLoad.mutateAsync(backendData)
      setNewLoadDialogOpen(false)
    } catch (error: any) {
      console.error('Failed to create load:', error)
    } finally {
      setIsCreatingLoad(false)
    }
  }

  // Get unassigned loads for the current week using UTC comparison
  const unassignedLoads = useMemo(() => {
    const weekStartUTC = toUTCDate(weekStart)
    const weekEndUTC = toUTCDate(addDays(weekStart, 6))

    return loads
      .filter(load => {
        if (load.driver_id) return false

        // Check if pickup or delivery falls within the current week (using UTC)
        const pickupDate = load.pickup_date ? new Date(normalizeDateTime(load.pickup_date)) : null
        const deliveryDate = load.delivery_date ? new Date(normalizeDateTime(load.delivery_date)) : null

        const pickupDateUTC = pickupDate ? new Date(Date.UTC(pickupDate.getUTCFullYear(), pickupDate.getUTCMonth(), pickupDate.getUTCDate())) : null
        const deliveryDateUTC = deliveryDate ? new Date(Date.UTC(deliveryDate.getUTCFullYear(), deliveryDate.getUTCMonth(), deliveryDate.getUTCDate())) : null

        const isPickupInWeek = pickupDateUTC && pickupDateUTC >= weekStartUTC && pickupDateUTC <= weekEndUTC
        const isDeliveryInWeek = deliveryDateUTC && deliveryDateUTC >= weekStartUTC && deliveryDateUTC <= weekEndUTC

        return isPickupInWeek || isDeliveryInWeek
      })
      .sort((a, b) => {
        const dateA = a.pickup_date ? new Date(normalizeDateTime(a.pickup_date)).getTime() : 0
        const dateB = b.pickup_date ? new Date(normalizeDateTime(b.pickup_date)).getTime() : 0
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

  // Toggle driver day off - uses API to persist
  const toggleDriverDayOff = (driverId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    toggleDayOffMutation.mutate({ driverId, date: dateStr })
  }

  // Toggle entire week off for a driver
  const toggleDriverWeekOff = async (driverId: number) => {
    const weekDates = weekDays.map(day => format(day, 'yyyy-MM-dd'))
    // Check if all days of the week are already off
    const allDaysOff = weekDates.every(dateStr =>
      daysOff.some(d => d.driverId === driverId && d.date === dateStr)
    )

    // Toggle each day - the API will add if not exists, remove if exists
    // For simplicity, we'll toggle each day that needs changing
    for (const dateStr of weekDates) {
      const isCurrentlyOff = daysOff.some(d => d.driverId === driverId && d.date === dateStr)
      // If all days are off, we want to remove them (toggle off -> on)
      // If not all days are off, we want to add the missing ones (toggle on -> off for those not off)
      if (allDaysOff || !isCurrentlyOff) {
        await api.post('/v1/driver-days-off/toggle', {
          driver_id: driverId,
          date: dateStr
        })
      }
    }
    queryClient.invalidateQueries({ queryKey: ['driver-days-off'] })
  }

  // Get loads for a specific driver on a specific day (pickup or delivery day)
  // Sorted by pickup time
  // Uses UTC comparison because backend stores wall-clock time as UTC
  const getLoadsForDriverOnDay = (driverId: number, date: Date) => {
    const dateUTC = toUTCDate(date)

    return loads
      .filter(load => {
        if (load.driver_id !== driverId) return false

        // Check if pickup or delivery falls on this day (using UTC comparison)
        const pickupDate = load.pickup_date ? new Date(normalizeDateTime(load.pickup_date)) : null
        const deliveryDate = load.delivery_date ? new Date(normalizeDateTime(load.delivery_date)) : null

        const isPickupDay = pickupDate && isSameDayUTC(pickupDate, dateUTC)
        const isDeliveryDay = deliveryDate && isSameDayUTC(deliveryDate, dateUTC)

        return isPickupDay || isDeliveryDay
      })
      .sort((a, b) => {
        // Sort by pickup time (using UTC)
        const aTime = a.pickup_date ? new Date(normalizeDateTime(a.pickup_date)).getTime() : 0
        const bTime = b.pickup_date ? new Date(normalizeDateTime(b.pickup_date)).getTime() : 0
        return aTime - bTime
      })
  }

  // Get loads where driver is "loaded" (in transit) on a specific day
  // This is for multi-day loads where pickup was before this day and delivery is after this day
  // Uses UTC comparison because backend stores wall-clock time as UTC
  const getLoadedLoadsForDriverOnDay = (driverId: number, date: Date) => {
    const dateUTC = toUTCDate(date)

    return loads.filter(load => {
      if (load.driver_id !== driverId) return false

      const pickupDate = load.pickup_date ? new Date(normalizeDateTime(load.pickup_date)) : null
      const deliveryDate = load.delivery_date ? new Date(normalizeDateTime(load.delivery_date)) : null

      if (!pickupDate || !deliveryDate) return false

      // Get just the date parts in UTC for comparison
      const pickupDateOnly = new Date(Date.UTC(pickupDate.getUTCFullYear(), pickupDate.getUTCMonth(), pickupDate.getUTCDate()))
      const deliveryDateOnly = new Date(Date.UTC(deliveryDate.getUTCFullYear(), deliveryDate.getUTCMonth(), deliveryDate.getUTCDate()))

      // Check if this day is between pickup and delivery (exclusive of pickup/delivery days)
      // Pickup must be before this day and delivery must be after this day
      const isAfterPickup = dateUTC > pickupDateOnly
      const isBeforeDelivery = dateUTC < deliveryDateOnly

      return isAfterPickup && isBeforeDelivery
    })
  }

  // Get weekly stats for a driver (total gross, miles, rate per mile)
  // Uses same calculation as loads page: Number(load.rate) and Number(load.miles)
  // Uses UTC comparison because backend stores wall-clock time as UTC
  const getDriverWeeklyStats = (driverId: number) => {
    const weekStartUTC = toUTCDate(weekStart)
    const weekEndUTC = toUTCDate(addDays(weekStart, 6))

    // Get all loads for this driver that have pickup within the current week
    const driverLoads = loads.filter(load => {
      if (load.driver_id !== driverId) return false

      const pickupDate = load.pickup_date ? new Date(normalizeDateTime(load.pickup_date)) : null
      if (!pickupDate) return false

      const pickupDateUTC = new Date(Date.UTC(pickupDate.getUTCFullYear(), pickupDate.getUTCMonth(), pickupDate.getUTCDate()))
      return pickupDateUTC >= weekStartUTC && pickupDateUTC <= weekEndUTC
    })

    // Use Number() to convert like the loads page does
    const totalGross = driverLoads.reduce((sum, load) => sum + (Number(load.rate) || 0), 0)
    const totalMiles = driverLoads.reduce((sum, load) => sum + (Number(load.miles) || 0), 0)
    const ratePerMile = totalMiles > 0 ? totalGross / totalMiles : 0

    return { totalGross, totalMiles, ratePerMile, loadCount: driverLoads.length }
  }

  // Format date and time together using UTC (wall-clock time)
  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    try {
      const date = new Date(normalizeDateTime(dateStr))
      const month = date.getUTCMonth() + 1
      const day = date.getUTCDate()
      let hours = date.getUTCHours()
      const minutes = String(date.getUTCMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      return `${month}/${day} ${hours}:${minutes} ${ampm}`
    } catch {
      return ''
    }
  }

  // Format time from datetime string using UTC (wall-clock time)
  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    try {
      const date = new Date(normalizeDateTime(dateStr))
      let hours = date.getUTCHours()
      const minutes = String(date.getUTCMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      return `${hours}:${minutes} ${ampm}`
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
        const previousDriverId = load.driver_id
        // Optimistic update - instant UI feedback
        optimisticUpdateLoad(load.id, null)

        updateLoad.mutate(
          { id: load.id, data: { driver_id: null as any } },
          {
            onSuccess: () => {
              toast.success(`Load #${load.load_number} unassigned`)
            },
            onError: () => {
              // Revert on error
              optimisticUpdateLoad(load.id, previousDriverId)
              toast.error('Failed to unassign load')
            },
          }
        )
      }
      return
    }

    // Dropping on a driver row - assign driver
    if (driverId && driverId !== load.driver_id) {
      const previousDriverId = load.driver_id
      // Optimistic update - instant UI feedback
      optimisticUpdateLoad(load.id, driverId)

      updateLoad.mutate(
        { id: load.id, data: { driver_id: driverId } },
        {
          onSuccess: () => {
            toast.success(`Load #${load.load_number} assigned to driver`)
          },
          onError: () => {
            // Revert on error
            optimisticUpdateLoad(load.id, previousDriverId ?? null)
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

    const previousDriverId = load.driver_id
    // Optimistic update - instant UI feedback
    optimisticUpdateLoad(loadId, null)

    updateLoad.mutate(
      { id: loadId, data: { driver_id: null as any } },
      {
        onSuccess: () => {
          toast.success(`Load #${load.load_number} unassigned`)
        },
        onError: () => {
          // Revert on error
          optimisticUpdateLoad(loadId, previousDriverId ?? null)
          toast.error('Failed to unassign load')
        },
      }
    )
  }

  // Context menu state - can be for driver row or day cell
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    driverId: number
    date?: Date  // If date is present, it's a day cell context menu
  } | null>(null)

  // Handle right-click on driver name (for OFF entire week)
  const handleDriverContextMenu = (e: React.MouseEvent, driverId: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, driverId })
  }

  // Handle right-click on day cell (for Add Load)
  const handleCellContextMenu = (e: React.MouseEvent, driverId: number, date: Date) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, driverId, date })
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
                        const weeklyStats = getDriverWeeklyStats(driver.id)

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
                                {/* Weekly Stats */}
                                <div className="mt-1.5 pt-1.5 border-t border-slate-200 space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--colors-foreground-muted)' }}>Gross:</span>
                                    <span className="font-semibold text-emerald-600">
                                      ${weeklyStats.totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--colors-foreground-muted)' }}>Miles:</span>
                                    <span className="font-medium" style={{ color: 'var(--colors-foreground-default)' }}>
                                      {weeklyStats.totalMiles.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--colors-foreground-muted)' }}>$/Mile:</span>
                                    <span className="font-medium" style={{ color: weeklyStats.ratePerMile >= 3 ? '#16a34a' : weeklyStats.ratePerMile >= 2 ? '#ca8a04' : '#dc2626' }}>
                                      ${weeklyStats.ratePerMile.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Day Cells */}
                            {weekDays.map((day) => {
                              const isToday = isSameDay(day, new Date())
                              const isOff = isDriverOff(driver.id, day)
                              const driverLoads = getLoadsForDriverOnDay(driver.id, day)
                              const loadedLoads = getLoadedLoadsForDriverOnDay(driver.id, day)
                              const isLoaded = loadedLoads.length > 0

                              return (
                                <td
                                  key={day.toISOString()}
                                  className="px-2 py-2 border-b border-r align-top"
                                  style={{
                                    borderColor: 'var(--cell-borderColor)',
                                    backgroundColor: isToday ? 'rgba(99, 102, 241, 0.06)' : undefined,
                                    minHeight: '80px'
                                  }}
                                >
                                  <div className="min-h-[70px]">
                                    {isOff ? (
                                      <div
                                        className="h-full flex items-center justify-center rounded-lg bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                                        style={{ minHeight: '70px' }}
                                        onClick={() => toggleDriverDayOff(driver.id, day)}
                                        title="Click to mark as working"
                                      >
                                        <span className="text-sm text-slate-400 font-medium">OFF</span>
                                      </div>
                                    ) : isLoaded && driverLoads.length === 0 ? (
                                      // Driver is in transit (loaded) on a multi-day trip
                                      <div
                                        className="h-full flex items-center justify-center rounded-lg bg-amber-50 border border-amber-200"
                                        style={{ minHeight: '70px' }}
                                        onContextMenu={(e) => handleCellContextMenu(e, driver.id, day)}
                                        title={`In transit: Load #${loadedLoads[0].load_number}`}
                                      >
                                        <span className="text-sm text-amber-600 font-medium">In Transit</span>
                                      </div>
                                    ) : driverLoads.length === 0 ? (
                                      <div
                                        className="h-full flex items-center justify-center rounded-lg bg-slate-50 border border-slate-300 border-dashed cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition-all"
                                        style={{ minHeight: '70px' }}
                                        onClick={() => toggleDriverDayOff(driver.id, day)}
                                        onContextMenu={(e) => handleCellContextMenu(e, driver.id, day)}
                                        title="Click to mark as off, right-click for options"
                                      >
                                        <span className="text-sm text-emerald-500 font-medium">Available</span>
                                      </div>
                                    ) : (
                                      <div
                                        className={driverLoads.length === 1 ? 'h-full' : 'space-y-1'}
                                        onContextMenu={(e) => handleCellContextMenu(e, driver.id, day)}
                                      >
                                        {driverLoads.map((load) => (
                                          <DraggableAssignedLoad
                                            key={load.id}
                                            load={load}
                                            day={day}
                                            formatTime={formatTime}
                                            formatDateTime={formatDateTime}
                                            getShortLocation={getShortLocation}
                                            onUnassign={handleUnassign}
                                            fillCell={driverLoads.length === 1}
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
              <div className="w-4 h-4 rounded bg-slate-50 border border-slate-300 border-dashed"></div>
              <span className="text-slate-500">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-white border border-slate-200 shadow-sm"></div>
              <span className="text-slate-500">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div>
              <span className="text-slate-500">In Transit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100"></div>
              <span className="text-slate-500">OFF</span>
            </div>
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
              <span className="text-slate-400 text-xs">Right-click for options • Drag to reassign</span>
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
              className="fixed z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.date ? (
                // Day cell context menu
                <>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      openNewLoadDialog(contextMenu.driverId, contextMenu.date!)
                      closeContextMenu()
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Load
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      toggleDriverDayOff(contextMenu.driverId, contextMenu.date!)
                      closeContextMenu()
                    }}
                  >
                    <X className="h-4 w-4" />
                    Mark as OFF
                  </button>
                </>
              ) : (
                // Driver row context menu
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
              )}
            </div>
          </>
        )}

        {/* New Load Dialog */}
        <Dialog open={newLoadDialogOpen} onOpenChange={setNewLoadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Add New Load
                {newLoadTargetDate && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    for {format(newLoadTargetDate, 'EEEE, MMM d, yyyy')}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Row 1: Load Number and Customer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="load_number">Load Number</Label>
                  <Input
                    id="load_number"
                    value={newLoadForm.load_number}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, load_number: e.target.value })}
                    placeholder="Auto-generated if blank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer/Broker</Label>
                  <Select
                    value={newLoadForm.customer_id?.toString() || ''}
                    onValueChange={(value) => setNewLoadForm({ ...newLoadForm, customer_id: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Pickup Location */}
              <div className="space-y-2">
                <Label htmlFor="pickup_location">Pickup Location</Label>
                <AddressAutocomplete
                  value={newLoadForm.pickup_location}
                  onChange={(data) => setNewLoadForm({ ...newLoadForm, pickup_location: data.formatted_address })}
                  placeholder="Enter pickup address"
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Row 3: Pickup Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickup_date">Pickup Date</Label>
                  <Input
                    id="pickup_date"
                    type="date"
                    value={newLoadForm.pickup_date}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, pickup_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickup_time">Pickup Time</Label>
                  <Input
                    id="pickup_time"
                    type="time"
                    value={newLoadForm.pickup_time}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, pickup_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 4: Delivery Location */}
              <div className="space-y-2">
                <Label htmlFor="delivery_location">Delivery Location</Label>
                <AddressAutocomplete
                  value={newLoadForm.delivery_location}
                  onChange={(data) => setNewLoadForm({ ...newLoadForm, delivery_location: data.formatted_address })}
                  placeholder="Enter delivery address"
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Row 5: Delivery Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={newLoadForm.delivery_date}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, delivery_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Delivery Time</Label>
                  <Input
                    id="delivery_time"
                    type="time"
                    value={newLoadForm.delivery_time}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, delivery_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 6: Miles and Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="miles">Miles</Label>
                  <Input
                    id="miles"
                    type="number"
                    value={newLoadForm.miles || ''}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, miles: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate ($)</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={newLoadForm.rate || ''}
                    onChange={(e) => setNewLoadForm({ ...newLoadForm, rate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNewLoadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNewLoad} disabled={isCreatingLoad}>
                {isCreatingLoad ? 'Creating...' : 'Create Load'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DndContext>
    </Layout>
  )
}
