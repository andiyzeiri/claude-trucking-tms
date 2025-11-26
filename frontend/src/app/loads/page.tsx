'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, ChevronRight, ChevronDown, Edit2, Trash2, Copy, Undo2, X, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useLoads, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useShippers } from '@/hooks/use-shippers'
import { useReceivers } from '@/hooks/use-receivers'
import { Load, Shipper, Receiver } from '@/types'
import toast from 'react-hot-toast'
import { useColumnWidths } from '@/hooks/use-column-widths'
import { ColumnWidthControl } from '@/components/ui/column-width-control'
import { PdfViewer } from '@/components/loads/pdf-viewer'
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete'
import api from '@/lib/api'

interface EditableLoad extends Load {
  isNew?: boolean
  weekNumber?: number
  weekLabel?: string
  weekDateRange?: string
  dayOfWeek?: number
  dayLabel?: string
}

type EditingCell = {
  loadId: number | 'new'
  field: string
} | null

// Helper to get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  // Copy date so we don't mutate the original
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  return weekNum
}

// Helper to get week label with date range
function getWeekLabel(date: Date): string {
  const weekNum = getWeekNumber(date)
  return `Week ${weekNum}`
}

// Helper to get week date range
function getWeekDateRange(date: Date): string {
  const dayOfWeek = date.getDay()
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startMonth = monday.getMonth() + 1
  const startDay = monday.getDate()
  const endMonth = sunday.getMonth() + 1
  const endDay = sunday.getDate()

  return `(${startMonth}/${startDay}-${endMonth}/${endDay})`
}

// Helper to get a date from a week number (ISO 8601)
function getDateFromWeekNumber(weekNumber: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()

  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(currentYear, 0, 4))

  // Get the Monday of week 1
  const dayNum = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum + 1)

  // Add weeks
  const targetDate = new Date(week1Monday)
  targetDate.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7)

  // Convert to local date
  return new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())
}

// Helper to get day label (e.g., "Monday, Dec 18")
function getDayLabel(date: Date): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const dayName = dayNames[date.getDay()]
  const monthName = monthNames[date.getMonth()]
  const dayNum = date.getDate()

  return `${dayName}, ${monthName} ${dayNum}`
}

// Helper to format date and time for display
function formatDateTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Helper to parse location string into components
function parseLocation(location: string): { street: string; city: string; state: string; zip: string } {
  if (!location) return { street: '', city: '', state: '', zip: '' }

  // Try to match pattern: "Street, City, ST Zip" or "City, ST Zip" or "City, ST"
  const zipMatch = location.match(/\b(\d{5})\b\s*$/)
  const zip = zipMatch ? zipMatch[1] : ''

  // Match state (2 capital letters) followed by optional zip or end of string
  const stateMatch = location.match(/\b([A-Z]{2})(?:\s+\d{5})?\s*$/)
  const state = stateMatch ? stateMatch[1] : ''

  // Remove zip and state from the end
  let remaining = location
    .replace(/\s*,?\s*[A-Z]{2}\s*(?:\d{5})?\s*$/, '')
    .trim()

  // Split by comma to separate parts
  const parts = remaining.split(',').map(p => p.trim()).filter(p => p)

  if (parts.length >= 2) {
    // Has street and city: "123 Main St, Chicago" or "123 Main, Chicago, IL"
    const street = parts[0] || ''
    const city = parts.slice(1).join(', ') || ''
    return { street, city, state, zip }
  } else if (parts.length === 1 && parts[0]) {
    // Only one part before state: "Chicago, IL" → city only
    return { street: '', city: parts[0], state, zip }
  } else if (!parts.length && state) {
    // Just state/zip: "IL 60601"
    return { street: '', city: '', state, zip }
  }

  return { street: '', city: '', state, zip }
}

// Helper to combine location components back into string
function combineLocation(street: string, city: string, state: string, zip: string): string {
  const parts: string[] = []
  if (street) parts.push(street)
  if (city) parts.push(city)
  if (state && zip) {
    parts.push(`${state} ${zip}`)
  } else if (state) {
    parts.push(state)
  } else if (zip) {
    parts.push(zip)
  }
  return parts.join(', ')
}

// Helper to format date as MM/DD/YY
function formatDateShort(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

// Helper to format time as HH:MM AM/PM
function formatTimeShort(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

// Helper to parse date input (MM/DD/YY) and combine with existing time
function parseDateInput(dateInput: string, existingDateTime: string): string {
  if (!dateInput) return existingDateTime

  // Parse MM/DD/YY format
  const parts = dateInput.split('/')
  if (parts.length !== 3) return existingDateTime

  const month = parseInt(parts[0]) - 1
  const day = parseInt(parts[1])
  let year = parseInt(parts[2])

  // Handle 2-digit year
  if (year < 100) {
    year += year < 50 ? 2000 : 1900
  }

  // Get existing time or use midnight
  const existingDate = existingDateTime ? new Date(existingDateTime) : new Date()
  const newDate = new Date(year, month, day, existingDate.getHours(), existingDate.getMinutes())

  return newDate.toISOString()
}

// Helper to parse time input (HH:MM AM/PM) and combine with existing date
function parseTimeInput(timeInput: string, existingDateTime: string): string {
  if (!timeInput) return existingDateTime

  // Parse time format like "2:30 PM" or "14:30"
  const match = timeInput.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return existingDateTime

  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const ampm = match[3]?.toUpperCase()

  // Handle 12-hour format
  if (ampm === 'PM' && hours !== 12) {
    hours += 12
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0
  }

  // Get existing date or use today
  const existingDate = existingDateTime ? new Date(existingDateTime) : new Date()
  const newDate = new Date(existingDate.getFullYear(), existingDate.getMonth(), existingDate.getDate(), hours, minutes)

  return newDate.toISOString()
}

export default function LoadsPageInline() {
  const { data: loadsData, isLoading, refetch } = useLoads(1, 1000)
  const loads = loadsData?.items || []
  const createLoad = useCreateLoad()
  const updateLoad = useUpdateLoad()
  const deleteLoad = useDeleteLoad()

  const { data: customersData } = useCustomers()
  const rawCustomers = customersData?.items || []

  // Sort customers alphabetically by name for dropdown
  const customers = useMemo(() => {
    return [...rawCustomers].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    )
  }, [rawCustomers])

  const { data: driversData } = useDrivers()
  const drivers = driversData?.items || []

  const { data: trucksData } = useTrucks()
  const trucks = trucksData?.items || []

  const { data: shippersData } = useShippers()
  const shippers = shippersData?.items || []

  const { data: receiversData } = useReceivers()
  const receivers = receiversData?.items || []

  const [editableLoads, setEditableLoads] = useState<EditableLoad[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  // Removed locationSuggestions - autocomplete disabled
  const [activeGroupings, setActiveGroupings] = useState<Set<'week' | 'day' | 'driver' | 'customer'>>(new Set(['week', 'driver']))
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [upcomingFilter, setUpcomingFilter] = useState<boolean>(false)
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, loadId?: number, type: 'load' | 'general'} | null>(null)
  const [pdfModal, setPdfModal] = useState<{url: string, loadId: number, type: 'pod' | 'ratecon'} | null>(null)
  const [sortField, setSortField] = useState<keyof EditableLoad>('pickup_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const groupMenuRef = useRef<HTMLDivElement>(null)
  const locationEditRef = useRef<HTMLDivElement>(null)
  const hasInitiallyCollapsed = useRef<boolean>(false)

  // Column width management
  const { columnWidths, adjustWidth } = useColumnWidths('loads-table', {
    week: 120,
    date: 100,
    load_number: 120,
    customer: 180,
    driver: 140,
    pickup: 250,
    delivery: 250,
    notes: 150,
    rate: 100,
    miles: 100,
    rpm: 80,
    pod: 100,
    ratecon: 100,
    status: 120
  })

  // Local state for editing location fields
  const [editingLocation, setEditingLocation] = useState<{
    loadId: number | 'new'
    type: 'pickup' | 'delivery'
    street: string
    city: string
    state: string
    zip: string
    date: string
    time: string
  } | null>(null)

  // Sync loads with editable state and add week info
  React.useEffect(() => {
    const loadsWithWeeks = loads.map(load => {
      const pickupDate = new Date(load.pickup_date)
      // Preserve the currently editing load to avoid losing user input
      const existingEditableLoad = editableLoads.find(el => el.id === load.id)
      const isCurrentlyEditingLocation = editingLocation &&
        ((editingLocation.loadId === load.id) || (editingLocation.loadId === 'new' && load.isNew))

      // Check if any field is currently being edited for this load
      const isEditingAnyField = editingCell &&
        ((editingCell.loadId === load.id) || (editingCell.loadId === 'new' && load.isNew))

      return {
        ...load,
        // Preserve location data if location is being edited
        ...(isCurrentlyEditingLocation && existingEditableLoad ? {
          pickup_location: existingEditableLoad.pickup_location,
          delivery_location: existingEditableLoad.delivery_location,
          pickup_date: existingEditableLoad.pickup_date,
          delivery_date: existingEditableLoad.delivery_date
        } : {}),
        // Preserve field being edited to avoid losing user input during typing
        ...(isEditingAnyField && existingEditableLoad ? {
          load_number: existingEditableLoad.load_number,
          notes: existingEditableLoad.notes,
          rate: existingEditableLoad.rate,
          miles: existingEditableLoad.miles
        } : {}),
        weekNumber: getWeekNumber(pickupDate),
        weekLabel: getWeekLabel(pickupDate),
        weekDateRange: getWeekDateRange(pickupDate),
        dayOfWeek: pickupDate.getDay(),
        dayLabel: getDayLabel(pickupDate)
      }
    })
    setEditableLoads(loadsWithWeeks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loads, editingLocation, editingCell])

  // Close group menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setGroupMenuOpen(false)
      }
    }

    if (groupMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [groupMenuOpen])

  // Close location editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is on Google Places autocomplete dropdown
      const target = event.target as HTMLElement
      const isGoogleAutocomplete = target.closest('.pac-container') !== null

      if (locationEditRef.current && !locationEditRef.current.contains(event.target as Node)) {
        // Don't close if clicking on Google autocomplete dropdown
        if (editingLocation && !isGoogleAutocomplete) {
          stopLocationEdit()
        }
      }
    }

    if (editingLocation) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingLocation])

  // Toggle grouping
  const toggleGrouping = (groupType: 'week' | 'day' | 'driver' | 'customer') => {
    const newGroupings = new Set(activeGroupings)
    if (newGroupings.has(groupType)) {
      newGroupings.delete(groupType)
    } else {
      newGroupings.add(groupType)
    }
    setActiveGroupings(newGroupings)
  }

  // Handle sort
  const handleSort = (field: keyof EditableLoad) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter loads based on upcoming and status filters (MOVED BEFORE groupedLoads)
  const filteredLoads = useMemo(() => {
    let filtered = editableLoads

    // Apply upcoming filter (next 7 days)
    if (upcomingFilter) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const sevenDaysLater = new Date(today)
      sevenDaysLater.setDate(today.getDate() + 6)

      filtered = filtered.filter(load => {
        const pickupDate = new Date(load.pickup_date)
        pickupDate.setHours(0, 0, 0, 0)
        return pickupDate.getTime() >= today.getTime() && pickupDate.getTime() <= sevenDaysLater.getTime()
      })
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(load => load.status === statusFilter)
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Handle nested objects
      if (sortField === 'customer_id') {
        aValue = customers.find(c => c.id === a.customer_id)?.name || ''
        bValue = customers.find(c => c.id === b.customer_id)?.name || ''
      } else if (sortField === 'driver_id') {
        aValue = a.driver ? `${a.driver.first_name} ${a.driver.last_name}` : ''
        bValue = b.driver ? `${b.driver.first_name} ${b.driver.last_name}` : ''
      }

      // Handle dates
      if (sortField === 'pickup_date' || sortField === 'delivery_date') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle strings
      const aStr = String(aValue || '').toLowerCase()
      const bStr = String(bValue || '').toLowerCase()

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })

    return filtered
  }, [editableLoads, upcomingFilter, statusFilter, sortField, sortDirection, customers])

  // Group loads - now supports multiple groupings
  const groupedLoads = useMemo(() => {
    if (activeGroupings.size === 0) return null

    // Create nested groups based on active groupings
    const groupingOrder: ('week' | 'day' | 'driver' | 'customer')[] = []
    if (activeGroupings.has('week')) groupingOrder.push('week')
    if (activeGroupings.has('day')) groupingOrder.push('day')
    if (activeGroupings.has('driver')) groupingOrder.push('driver')
    if (activeGroupings.has('customer')) groupingOrder.push('customer')

    const createNestedGroups = (loads: EditableLoad[], level: number): any => {
      if (level >= groupingOrder.length) {
        return loads
      }

      const groupType = groupingOrder[level]
      const groups: Record<string, any> = {}

      loads.forEach(load => {
        let groupKey = ''
        if (groupType === 'week') {
          groupKey = `Week ${load.weekNumber}`
        } else if (groupType === 'day') {
          groupKey = load.dayLabel || 'Unknown'
        } else if (groupType === 'driver') {
          // Normalize driver check - handle null, undefined, and missing driver
          const hasDriver = load.driver && load.driver.first_name && load.driver.last_name
          groupKey = hasDriver ? `${load.driver.first_name} ${load.driver.last_name}` : 'Unassigned'
        } else if (groupType === 'customer') {
          groupKey = customers.find(c => c.id === load.customer_id)?.name || 'N/A'
        }

        if (!groups[groupKey]) {
          groups[groupKey] = []
        }
        groups[groupKey].push(load)
      })

      // Recursively create nested groups
      Object.keys(groups).forEach(key => {
        groups[key] = createNestedGroups(groups[key], level + 1)
      })

      // Sort groups based on type
      const sortedGroups: Record<string, any> = {}
      const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (groupType === 'week') {
          // Sort weeks chronologically by extracting week number
          const weekA = parseInt(a.replace('Week ', ''))
          const weekB = parseInt(b.replace('Week ', ''))
          return weekA - weekB
        } else if (groupType === 'driver') {
          // Sort drivers alphabetically with "Unassigned" always first
          if (a === 'Unassigned') return -1
          if (b === 'Unassigned') return 1
          return a.localeCompare(b)
        } else if (groupType === 'customer') {
          // Sort customers alphabetically
          return a.localeCompare(b)
        }
        return 0
      })

      sortedKeys.forEach(key => {
        sortedGroups[key] = groups[key]
      })

      return sortedGroups
    }

    return createNestedGroups(filteredLoads, 0)
  }, [filteredLoads, activeGroupings, customers])

  // Collapse all groups by default on initial load
  useEffect(() => {
    if (!groupedLoads) return

    const getAllGroupKeys = (data: any): string[] => {
      if (Array.isArray(data)) return []
      const keys: string[] = []
      Object.keys(data).forEach(key => {
        keys.push(key)
        const nestedKeys = getAllGroupKeys(data[key])
        keys.push(...nestedKeys)
      })
      return keys
    }

    // Only set collapsed groups if we haven't manually interacted with them yet
    // Or if this is the first load
    if (!hasInitiallyCollapsed.current) {
      const allGroupKeys = getAllGroupKeys(groupedLoads)
      setCollapsedGroups(new Set(allGroupKeys))
      hasInitiallyCollapsed.current = true
    }
  }, [groupedLoads])

  // Reset the hasInitiallyCollapsed flag when activeGroupings changes
  // This ensures groups are collapsed when switching grouping modes
  useEffect(() => {
    hasInitiallyCollapsed.current = false
  }, [activeGroupings])

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey)
    } else {
      newCollapsed.add(groupKey)
    }
    setCollapsedGroups(newCollapsed)
  }

  // Calculate upcoming loads statistics (next 7 days)
  const upcomingStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(today.getDate() + 6) // Today + 6 more days = 7 days total

    const upcomingLoads = editableLoads.filter(load => {
      const pickupDate = new Date(load.pickup_date)
      pickupDate.setHours(0, 0, 0, 0)
      return pickupDate.getTime() >= today.getTime() && pickupDate.getTime() <= sevenDaysLater.getTime()
    })

    return {
      total: upcomingLoads.length,
      available: upcomingLoads.filter(l => l.status === 'available').length,
      dispatched: upcomingLoads.filter(l => l.status === 'dispatched').length,
      invoiced: upcomingLoads.filter(l => l.status === 'invoiced').length
    }
  }, [editableLoads])

  const handleAddNew = async () => {
    // Validate we have customers
    if (customers.length === 0 || !customers[0]?.id) {
      alert('Please add a customer first before creating loads')
      return
    }

    // Create a new load immediately in the backend
    const backendData: any = {
      load_number: '',
      customer_id: customers[0].id,
      driver_id: null,
      truck_id: null,
      pickup_location: '',
      delivery_location: '',
      pickup_date: new Date().toISOString(),
      delivery_date: new Date().toISOString(),
      miles: 0,
      rate: 0,
      status: 'available'
    }

    try {
      await createLoad.mutateAsync(backendData)
      // React Query will automatically refetch via query invalidation in the mutation's onSuccess
    } catch (error: any) {
      console.error('Failed to create load:', error)
      alert(`Failed to create load: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    // Store the deleted load for undo
    const deletedLoad = editableLoads.find(load => load.id === id)
    if (!deletedLoad) return

    // Immediately remove from UI
    setEditableLoads(editableLoads.filter(load => load.id !== id))

    // Delete from backend immediately
    try {
      await deleteLoad.mutateAsync(id)

      // Show success toast with undo option
      const toastId = toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Load deleted
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {deletedLoad.load_number || 'Untitled load'} has been removed
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={async () => {
                  // Recreate the load in backend
                  try {
                    const backendData: any = {
                      load_number: deletedLoad.load_number,
                      customer_id: deletedLoad.customer_id,
                      driver_id: deletedLoad.driver_id || null,
                      truck_id: null,
                      pickup_location: deletedLoad.pickup_location,
                      delivery_location: deletedLoad.delivery_location,
                      pickup_date: deletedLoad.pickup_date,
                      delivery_date: deletedLoad.delivery_date,
                      miles: deletedLoad.miles || 0,
                      rate: deletedLoad.rate || 0,
                      status: deletedLoad.status
                    }
                    const result = await createLoad.mutateAsync(backendData)

                    // Add back to UI with new ID
                    const pickupDate = new Date(result.pickup_date)
                    const restoredLoad = {
                      ...result,
                      weekNumber: getWeekNumber(pickupDate),
                      weekLabel: getWeekLabel(pickupDate),
                      weekDateRange: getWeekDateRange(pickupDate),
                      dayOfWeek: pickupDate.getDay(),
                      dayLabel: getDayLabel(pickupDate)
                    }
                    setEditableLoads(prev => [...prev, restoredLoad])
                    toast.dismiss(toastId)
                    toast.success('Load restored')
                    refetch()
                  } catch (error: any) {
                    console.error('Failed to restore load:', error)
                    toast.error(`Failed to restore load: ${error.response?.data?.detail || error.message}`)
                  }
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                <Undo2 className="h-5 w-5 mr-2" />
                Undo
              </button>
            </div>
          </div>
        ),
        {
          duration: 5000,
          position: 'bottom-right',
        }
      )
    } catch (error: any) {
      console.error('Failed to delete load from backend:', error)
      // If backend deletion fails, restore the load using functional update
      setEditableLoads(prev => [...prev, deletedLoad])
      toast.error(`Failed to delete load: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDeletePdf = async (loadId: number, field: 'pod_url' | 'ratecon_url') => {
    try {
      // Update the field to null
      await updateField(loadId, field, null)
      setPdfModal(null)
      toast.success(`${field === 'pod_url' ? 'POD' : 'Ratecon'} deleted successfully`)
    } catch (error) {
      console.error('Error deleting PDF:', error)
      toast.error('Failed to delete PDF')
    }
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    loadKey: number | 'new',
    field: 'pod_url' | 'ratecon_url'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed')
      return
    }

    // Create form data
    const formData = new FormData()
    formData.append('file', file)

    const uploadToast = toast.loading('Uploading PDF...')

    try {
      // Upload file using api client (handles auth automatically)
      const response = await api.post('/v1/uploads/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update the field with the returned URL
      await updateField(loadKey, field, response.data.url)

      toast.success('PDF uploaded successfully', { id: uploadToast })
    } catch (error: any) {
      console.error('File upload error:', error)
      const errorMsg = error.response?.data?.detail || 'Failed to upload PDF'
      toast.error(errorMsg, { id: uploadToast })
    }

    // Reset the input
    e.target.value = ''
  }

  const updateField = async (id: number | 'new', field: keyof EditableLoad, value: any) => {
    // Find the load to update
    const load = editableLoads.find(l => (id === 'new' && l.isNew) || l.id === id)
    if (!load) return

    // For new loads, update state locally only
    if (load.isNew) {
      const updatedLoads = editableLoads.map(l => {
        if ((id === 'new' && l.isNew) || l.id === id) {
          const updated = { ...l, [field]: value }

          // Update nested objects when IDs change
          if (field === 'driver_id') {
            updated.driver = value ? drivers.find(d => d.id === value) : undefined
          }

          // Recalculate week info when pickup_date changes
          if (field === 'pickup_date' && value) {
            const pickupDate = new Date(value)
            updated.weekNumber = getWeekNumber(pickupDate)
            updated.weekLabel = getWeekLabel(pickupDate)
            updated.weekDateRange = getWeekDateRange(pickupDate)
            updated.dayOfWeek = pickupDate.getDay()
            updated.dayLabel = getDayLabel(pickupDate)
          }

          return updated
        }
        return l
      })
      setEditableLoads(updatedLoads)
      return
    }

    // For existing loads, update backend directly
    // React Query will automatically refetch via query invalidation in the mutation's onSuccess
    try {
      const backendData: any = {
        load_number: load.load_number,
        customer_id: load.customer_id,
        driver_id: field === 'driver_id' ? (value || null) : (load.driver_id || null),
        truck_id: null,
        pickup_location: field === 'pickup_location' ? value : load.pickup_location,
        delivery_location: field === 'delivery_location' ? value : load.delivery_location,
        pickup_date: field === 'pickup_date' ? value : load.pickup_date,
        delivery_date: field === 'delivery_date' ? value : load.delivery_date,
        miles: field === 'miles' ? value : (load.miles || 0),
        rate: field === 'rate' ? value : (load.rate || 0),
        status: field === 'status' ? value : load.status,
        pod_url: field === 'pod_url' ? value : (load.pod_url || null),
        ratecon_url: field === 'ratecon_url' ? value : (load.ratecon_url || null),
        notes: field === 'notes' ? value : (load.notes || null),
        [field]: value
      }
      await updateLoad.mutateAsync({ id: load.id, data: backendData })
    } catch (error) {
      // Error is already handled by the mutation hook's onError
      // But we need to rethrow to let callers know it failed
      throw error
    }
  }


  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ''
    return dateString.split('T')[0]
  }

  const totals = useMemo(() => {
    const totalRate = editableLoads.reduce((sum, load) => sum + (Number(load.rate) || 0), 0)
    const totalMiles = editableLoads.reduce((sum, load) => sum + (Number(load.miles) || 0), 0)
    return {
      count: editableLoads.filter(l => !l.isNew).length,
      rate: totalRate,
      miles: totalMiles,
      rpm: totalMiles > 0 ? totalRate / totalMiles : 0
    }
  }, [editableLoads])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'dispatched': return 'bg-orange-100 text-orange-800'
      case 'invoiced': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isEditing = (loadId: number | 'new', field: string) => {
    return editingCell?.loadId === loadId && editingCell?.field === field
  }

  const startEdit = (loadId: number | 'new', field: string) => {
    setEditingCell({ loadId, field })
  }

  const stopEdit = () => {
    setEditingCell(null)
  }

  const startLocationEdit = (loadId: number | 'new', type: 'pickup' | 'delivery', load: EditableLoad) => {
    const location = type === 'pickup' ? load.pickup_location : load.delivery_location
    const dateTime = type === 'pickup' ? load.pickup_date : load.delivery_date
    const parsed = parseLocation(location)

    setEditingLocation({
      loadId,
      type,
      street: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      date: formatDateShort(dateTime),
      time: formatTimeShort(dateTime)
    })
    setEditingCell({ loadId, field: type === 'pickup' ? 'pickup_location' : 'delivery_location' })
  }

  const stopLocationEdit = async (overrideValues?: { street?: string; city?: string; state?: string; zip?: string }) => {
    if (editingLocation) {
      const { loadId, type, street: stateStreet, city: stateCity, state: stateState, zip: stateZip, date, time } = editingLocation
      // Use override values if provided, otherwise use state values
      const street = overrideValues?.street ?? stateStreet
      const city = overrideValues?.city ?? stateCity
      const state = overrideValues?.state ?? stateState
      const zip = overrideValues?.zip ?? stateZip

      try {
        // Combine location components
        const locationString = combineLocation(street, city, state, zip)

        // Get the load to update
        const load = editableLoads.find(l => (loadId === 'new' && l.isNew) || l.id === loadId)
        if (!load) {
          console.error('Load not found:', loadId)
          return
        }

        // Parse date/time
        const dateField = type === 'pickup' ? 'pickup_date' : 'delivery_date'
        let dateTime = load[dateField]
        if (date) {
          dateTime = parseDateInput(date, dateTime)
        }
        if (time) {
          dateTime = parseTimeInput(time, dateTime)
        }

        const locationField = type === 'pickup' ? 'pickup_location' : 'delivery_location'

        // For new loads, update local state
        if (load.isNew) {
          const updatedLoads = editableLoads.map(l => {
            if (loadId === 'new' && l.isNew) {
              const updated = {
                ...l,
                [locationField]: locationString,
                [dateField]: dateTime
              }

              // Recalculate week info if pickup_date changed
              if (type === 'pickup' && dateTime) {
                const pickupDate = new Date(dateTime)
                updated.weekNumber = getWeekNumber(pickupDate)
                updated.weekLabel = getWeekLabel(pickupDate)
                updated.weekDateRange = getWeekDateRange(pickupDate)
                updated.dayOfWeek = pickupDate.getDay()
                updated.dayLabel = getDayLabel(pickupDate)
              }

              return updated
            }
            return l
          })
          setEditableLoads(updatedLoads)
          setEditingLocation(null)
          setEditingCell(null)
          return
        }

        // For existing loads, prepare data for backend
        const updatedLocationData = {
          ...load,
          [locationField]: locationString,
          [dateField]: dateTime
        }

        // Calculate miles if both locations are filled
        let calculatedMiles = load.miles || 0
        const pickup = type === 'pickup' ? locationString : load.pickup_location
        const delivery = type === 'delivery' ? locationString : load.delivery_location

        if (pickup && delivery) {
          console.log('[Maps] Attempting to calculate distance from', pickup, 'to', delivery)
          try {
            const response = await api.post('/v1/maps/calculate-distance', {
              origin: pickup,
              destination: delivery,
              unit: 'imperial'
            })

            console.log('[Maps] API response:', response.data)

            if (response.data.status === 'success' && response.data.distance_miles) {
              calculatedMiles = Math.round(response.data.distance_miles)
              toast.success(`Calculated ${calculatedMiles} miles`)
            } else {
              console.warn('[Maps] API returned non-success status:', response.data)
              toast.error(`Could not calculate distance: ${response.data.error || 'Unknown error'}`)
            }
          } catch (error: any) {
            console.error('[Maps] Error calculating miles:', error)
            const errorMsg = error.response?.data?.detail || error.message || 'Unknown error'
            toast.error(`Distance calculation failed: ${errorMsg}`)
          }
        }

        // Update backend with location, date, and miles
        // React Query will automatically refetch via query invalidation
        const backendData: any = {
          load_number: load.load_number,
          customer_id: load.customer_id,
          driver_id: load.driver_id || null,
          truck_id: null,
          pickup_location: type === 'pickup' ? locationString : load.pickup_location,
          delivery_location: type === 'delivery' ? locationString : load.delivery_location,
          pickup_date: type === 'pickup' ? dateTime : load.pickup_date,
          delivery_date: type === 'delivery' ? dateTime : load.delivery_date,
          miles: calculatedMiles,
          rate: load.rate || 0,
          status: load.status,
          pod_url: load.pod_url || null,
          ratecon_url: load.ratecon_url || null,
          notes: load.notes || null
        }
        await updateLoad.mutateAsync({ id: load.id, data: backendData })

        setEditingLocation(null)
        setEditingCell(null)
      } catch (error) {
        console.error('Error saving location:', error)
        toast.error('Failed to save location changes')
      }
    } else {
      setEditingCell(null)
    }
  }

  const updateLocationField = (field: 'street' | 'city' | 'state' | 'zip' | 'date' | 'time', value: string) => {
    if (editingLocation) {
      setEditingLocation(prev => {
        if (!prev) return prev
        return { ...prev, [field]: value }
      })
    }
  }

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent, loadId: number) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      loadId,
      type: 'load'
    })
  }

  const handleGeneralContextMenu = (e: React.MouseEvent) => {
    // Only show general context menu if not clicking on a load row
    const target = e.target as HTMLElement
    if (target.closest('tr[data-load-row="true"]')) {
      return
    }
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'general'
    })
  }

  const expandAllGroups = () => {
    setCollapsedGroups(new Set())
    setContextMenu(null)
  }

  // Helper function to group loads by a specific field
  const groupByField = (loads: EditableLoad[], groupType: 'week' | 'day' | 'driver' | 'customer'): Record<string, EditableLoad[]> => {
    const groups: Record<string, EditableLoad[]> = {}

    loads.forEach(load => {
      let groupKey = ''
      if (groupType === 'week') {
        groupKey = `Week ${load.weekNumber}`
      } else if (groupType === 'day') {
        groupKey = load.dayLabel || 'Unknown'
      } else if (groupType === 'driver') {
        // Normalize driver check - handle null, undefined, and missing driver
        const hasDriver = load.driver && load.driver.first_name && load.driver.last_name
        groupKey = hasDriver ? `${load.driver.first_name} ${load.driver.last_name}` : 'Unassigned'
      } else if (groupType === 'customer') {
        groupKey = customers.find(c => c.id === load.customer_id)?.name || 'N/A'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(load)
    })

    return groups
  }

  const collapseAllGroups = () => {
    const allGroupKeys = new Set<string>()

    // Collect all group keys based on active groupings
    const collectGroupKeys = (loads: EditableLoad[], groupings: ('week' | 'day' | 'driver' | 'customer')[], parentKeys: string[] = []) => {
      if (groupings.length === 0) return

      const [currentGrouping, ...remainingGroupings] = groupings
      const groups = groupByField(loads, currentGrouping)

      Object.keys(groups).forEach(groupKey => {
        const fullKey = [...parentKeys, groupKey].join('-')
        allGroupKeys.add(fullKey)

        if (remainingGroupings.length > 0) {
          collectGroupKeys(groups[groupKey], remainingGroupings, [...parentKeys, groupKey])
        }
      })
    }

    collectGroupKeys(filteredLoads, Array.from(activeGroupings))
    setCollapsedGroups(allGroupKeys)
    setContextMenu(null)
  }

  const handleDuplicate = async (id: number) => {
    const loadToDuplicate = editableLoads.find(l => l.id === id)
    if (!loadToDuplicate) return

    const backendData: any = {
      load_number: '',
      customer_id: loadToDuplicate.customer_id,
      driver_id: loadToDuplicate.driver_id || null,
      truck_id: null,
      pickup_location: loadToDuplicate.pickup_location,
      delivery_location: loadToDuplicate.delivery_location,
      pickup_date: loadToDuplicate.pickup_date,
      delivery_date: loadToDuplicate.delivery_date,
      miles: loadToDuplicate.miles || 0,
      rate: loadToDuplicate.rate || 0,
      status: 'available'
    }

    try {
      const result = await createLoad.mutateAsync(backendData)
      const pickupDate = new Date(result.pickup_date)
      const newLoadWithWeek = {
        ...result,
        weekNumber: getWeekNumber(pickupDate),
        weekLabel: getWeekLabel(pickupDate),
        weekDateRange: getWeekDateRange(pickupDate),
        dayOfWeek: pickupDate.getDay(),
        dayLabel: getDayLabel(pickupDate)
      }
      setEditableLoads([...editableLoads, newLoadWithWeek])
      refetch()
      setContextMenu(null)
    } catch (error: any) {
      console.error('Failed to duplicate load:', error)
      alert(`Failed to duplicate load: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleAddToGroup = async (groupKey: string, parentKeys: string[] = []) => {
    // Determine the customer_id or driver_id based on the grouping
    let customer_id = customers.length > 0 ? customers[0].id : null
    let driver_id = null
    let pickup_date = new Date().toISOString()

    // Check parent keys for week information first
    const weekKey = parentKeys.find(key => key.startsWith('Week ')) || (groupKey.startsWith('Week ') ? groupKey : null)
    if (weekKey) {
      const weekNumberStr = weekKey.replace('Week ', '')
      const weekNumber = parseInt(weekNumberStr)
      if (!isNaN(weekNumber)) {
        // Get the Monday of this week
        const targetDate = getDateFromWeekNumber(weekNumber)
        pickup_date = targetDate.toISOString()
      }
    }

    // Find the customer by name
    const customer = customers.find(c => c.name === groupKey)
    if (customer) {
      customer_id = customer.id
    }

    // Find the driver by name (improved logic with case-insensitive matching)
    if (groupKey !== 'Unassigned' && groupKey.trim().length > 0) {
      // Try to match driver by full name (case-insensitive)
      const driver = drivers.find(d => {
        const driverFullName = `${d.first_name} ${d.last_name}`.toLowerCase()
        return driverFullName === groupKey.toLowerCase()
      })
      if (driver) {
        driver_id = driver.id
      }
    }

    // Parse day label if groupKey is a day (e.g., "Wednesday, Oct 15")
    // Day labels follow format: "DayName, Month Day"
    if (groupKey.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/)) {
      // Find an existing load in this group to get the exact date
      const loadInGroup = filteredLoads.find(load => load.dayLabel === groupKey)
      if (loadInGroup) {
        pickup_date = loadInGroup.pickup_date
      } else {
        // Parse the date from the group key
        // Format: "Wednesday, Oct 15"
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const match = groupKey.match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d+)$/)
        if (match) {
          const monthStr = match[1]
          const day = parseInt(match[2])
          const monthIndex = monthNames.indexOf(monthStr)

          if (monthIndex !== -1) {
            const today = new Date()
            const currentYear = today.getFullYear()
            const targetDate = new Date(currentYear, monthIndex, day)

            // If the date has passed this year, use next year
            if (targetDate < today) {
              targetDate.setFullYear(currentYear + 1)
            }

            pickup_date = targetDate.toISOString()
          }
        }
      }
    }

    // Create a new load with the determined customer/driver/date
    const backendData: any = {
      load_number: '',
      customer_id: customer_id,
      driver_id: driver_id,
      truck_id: null,
      pickup_location: '',
      delivery_location: '',
      pickup_date: pickup_date,
      delivery_date: pickup_date,
      miles: 0,
      rate: 0,
      status: 'available'
    }

    try {
      await createLoad.mutateAsync(backendData)
      // React Query will automatically refetch via query invalidation in the mutation's onSuccess
    } catch (error: any) {
      console.error('Failed to create load:', error)
      console.error('Load data that failed:', backendData)
      alert(`Failed to create load: ${error.response?.data?.detail || error.message}`)
    }
  }

  // Recursive function to render nested groups
  const renderNestedGroups = (data: any, paddingLeft = 0, rowIndexOffset = 0, level = 0, parentKeys: string[] = []): JSX.Element[] => {
    if (Array.isArray(data)) {
      // Base case: render load rows
      return data.map((load, index) => renderLoadRow(load, paddingLeft, rowIndexOffset + index))
    }

    // Recursive case: render group headers and nested content
    const elements: JSX.Element[] = []
    let globalRowIndex = rowIndexOffset

    // Determine grouping order to know what type each level is
    const groupingOrder: ('week' | 'day' | 'driver' | 'customer')[] = []
    if (activeGroupings.has('week')) groupingOrder.push('week')
    if (activeGroupings.has('day')) groupingOrder.push('day')
    if (activeGroupings.has('driver')) groupingOrder.push('driver')
    if (activeGroupings.has('customer')) groupingOrder.push('customer')

    const currentGroupType = groupingOrder[level]

    Object.entries(data).forEach(([groupKey, groupData]) => {
      const isCollapsed = collapsedGroups.has(groupKey)

      // Calculate totals for this group
      const getAllLoads = (d: any): EditableLoad[] => {
        if (Array.isArray(d)) return d
        return Object.values(d).flatMap(getAllLoads)
      }
      const groupLoads = getAllLoads(groupData)
      const groupTotalRate = groupLoads.reduce((sum, l) => sum + (Number(l.rate) || 0), 0)
      const groupTotalMiles = groupLoads.reduce((sum, l) => sum + (Number(l.miles) || 0), 0)
      const groupRPM = groupTotalMiles > 0 ? groupTotalRate / groupTotalMiles : 0

      // Determine icon color and background color based on group type
      let iconColor = 'var(--monday-cornflower)'
      let bgColor = 'var(--monday-bg-secondary)'
      if (currentGroupType === 'week') {
        iconColor = 'var(--monday-blue)'
        bgColor = '#8bc28c'
      } else if (currentGroupType === 'driver') {
        iconColor = 'var(--monday-working)'
        bgColor = '#feae6c'
      } else if (currentGroupType === 'customer') {
        iconColor = 'var(--monday-stuck)'
      }

      // Group header row
      // Use parentKeys to create unique keys for nested groups
      const uniqueGroupKey = [...parentKeys, groupKey].join('-')
      elements.push(
        <tr key={`group-${uniqueGroupKey}`} className="border-b cursor-pointer" style={{ backgroundColor: bgColor, borderColor: 'var(--monday-border-light)' }} onClick={() => toggleGroup(groupKey)}>
          <td colSpan={2} className="px-2 py-2 text-sm font-medium" style={{ paddingLeft: `${paddingLeft + 8}px`, color: 'var(--monday-text-primary)' }}>
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: iconColor }} />
              ) : (
                <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: iconColor }} />
              )}
              <span className="whitespace-nowrap">{groupKey}</span>
              <span className="whitespace-nowrap" style={{ color: 'var(--monday-text-muted)' }}>({groupLoads.length} loads)</span>
            </div>
          </td>
          <td className="px-2 py-2 text-sm" colSpan={6}></td>
          <td className="px-2 py-2 text-sm">
            <div className="mb-0.5">
              <div style={{fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)'}}>
                {formatCurrency(groupTotalRate)}
              </div>
            </div>
            <div className="flex gap-2">
              <div style={{fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: 'var(--monday-blue)'}}>
                {groupTotalMiles.toLocaleString()} mi
              </div>
              <div style={{fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: 'var(--monday-purple)'}}>
                ${groupRPM.toFixed(2)}/mi
              </div>
            </div>
          </td>
          <td className="px-2 py-2 text-sm" colSpan={3}></td>
        </tr>
      )

      // Nested content (if not collapsed)
      if (!isCollapsed) {
        const nestedElements = renderNestedGroups(groupData, paddingLeft + 20, globalRowIndex, level + 1, [...parentKeys, groupKey])
        elements.push(...nestedElements)
        globalRowIndex += nestedElements.length

        // Add load button for leaf groups
        if (Array.isArray(groupData)) {
          elements.push(
            <tr key={`add-${uniqueGroupKey}`} className="border-b transition-colors" style={{borderColor: 'var(--monday-border-light)'}}>
              <td colSpan={11} className="px-2 py-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddToGroup(groupKey, parentKeys)
                  }}
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ marginLeft: `${paddingLeft + 20}px`, color: 'var(--monday-cornflower)' }}
                >
                  <Plus className="h-4 w-4" />
                  <span>Add load to {groupKey}</span>
                </button>
              </td>
            </tr>
          )
        }
      }
    })

    return elements
  }

  const renderLoadRow = (load: EditableLoad, paddingLeft = 0, rowIndex = 0) => {
    const loadKey = load.isNew ? 'new' : load.id
    const rpm = load.miles && load.miles > 0 ? (load.rate || 0) / load.miles : 0
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--monday-bg-primary)' : 'rgba(0, 0, 0, 0.02)'

    return (
      <tr
        key={loadKey}
        data-load-row="true"
        className="border-b transition-colors"
        style={{
          borderColor: 'var(--monday-border-light)',
          backgroundColor: defaultBgColor
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget
          target.style.backgroundColor = 'var(--monday-bg-hover)'
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget
          target.style.backgroundColor = defaultBgColor
        }}
        onContextMenu={(e) => {
          if (!load.isNew) {
            handleContextMenu(e, load.id)
          }
        }}
      >
        {/* Week */}
        <td className="px-3 py-2.5 border-r" style={{ paddingLeft: `${paddingLeft + 12}px`, borderColor: 'var(--monday-border-light)' }}>
          <div>
            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)'}}>{load.weekLabel}</div>
            <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)'}}>{load.weekDateRange}</div>
          </div>
        </td>

        {/* Date */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}} onClick={() => startEdit(loadKey, 'pickup_date')}>
          {isEditing(loadKey, 'pickup_date') ? (
            <Input
              type="date"
              value={formatDateForInput(load.pickup_date)}
              onChange={(e) => updateField(loadKey, 'pickup_date', `${e.target.value}T00:00:00`)}
              onBlur={stopEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  stopEdit()
                }
              }}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)'}}>
              {new Date(load.pickup_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
            </div>
          )}
        </td>

        {/* Load # */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}} onClick={() => startEdit(loadKey, 'load_number')}>
          {isEditing(loadKey, 'load_number') ? (
            <Input
              value={load.load_number || ''}
              onChange={(e) => {
                // Only update local state, not backend
                const value = e.target.value
                setEditableLoads(prev => prev.map(l =>
                  ((loadKey === 'new' && l.isNew) || l.id === loadKey)
                    ? { ...l, load_number: value }
                    : l
                ))
              }}
              onBlur={(e) => {
                updateField(loadKey, 'load_number', e.target.value)
                stopEdit()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateField(loadKey, 'load_number', e.currentTarget.value)
                  stopEdit()
                } else if (e.key === 'Tab' && !e.shiftKey) {
                  e.preventDefault()
                  updateField(loadKey, 'load_number', e.currentTarget.value)
                  stopEdit()
                  // Move to next field (customer)
                  setTimeout(() => startEdit(loadKey, 'customer_id'), 0)
                }
              }}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)'}}>
              {load.load_number}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}} onClick={() => startEdit(loadKey, 'customer_id')}>
          {isEditing(loadKey, 'customer_id') ? (
            <Select
              value={String(load.customer_id)}
              onValueChange={(value) => {
                updateField(loadKey, 'customer_id', Number(value))
                stopEdit()
              }}
              open={true}
              onOpenChange={(open) => !open && stopEdit()}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)'}}>
                {customers.find(c => c.id === load.customer_id)?.name || 'N/A'}
              </div>
              {customers.find(c => c.id === load.customer_id)?.mc && (
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)'}}>
                  MC: {customers.find(c => c.id === load.customer_id)?.mc}
                </div>
              )}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}} onClick={() => startEdit(loadKey, 'driver_id')}>
          {isEditing(loadKey, 'driver_id') ? (
            <Select
              value={load.driver_id ? String(load.driver_id) : 'unassigned'}
              onValueChange={(value) => {
                updateField(loadKey, 'driver_id', value === 'unassigned' ? null : Number(value))
                stopEdit()
              }}
              open={true}
              onOpenChange={(open) => !open && stopEdit()}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {drivers.map(driver => (
                  <SelectItem key={driver.id} value={String(driver.id)}>
                    {driver.first_name} {driver.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.driver ? `${load.driver.first_name} ${load.driver.last_name}` : 'Unassigned'}
            </div>
          )}
        </td>

        {/* Pickup Location */}
        <td
          className="px-3 py-2.5 border-r"
          style={{borderColor: 'var(--monday-border-light)', minWidth: '200px'}}
          onClick={() => startLocationEdit(loadKey, 'pickup', load)}
        >
          {isEditing(loadKey, 'pickup_location') && editingLocation?.type === 'pickup' ? (
            <div ref={locationEditRef} className="space-y-1 relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              {/* Autocomplete field */}
              <div className="mb-1">
                <AddressAutocomplete
                  value={editingLocation?.street || ''}
                  onChange={(addressData) => {
                    console.log('📬 Received address data in loads page:', addressData)

                    // Use structured address components from Google Places API
                    const street = addressData.street_number && addressData.route
                      ? `${addressData.street_number} ${addressData.route}`
                      : addressData.formatted_address.split(',')[0]  // Fallback for manual entry

                    const city = addressData.locality || ''
                    const state = addressData.administrative_area_level_1 || ''
                    const zip = addressData.postal_code || ''

                    console.log('🏘️ Extracted fields:', { street, city, state, zip })

                    // Update all fields at once to avoid race conditions
                    setEditingLocation(prev => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        street,
                        city,
                        state,
                        zip
                      }
                    })

                    // Auto-save immediately with the values we just extracted
                    // Pass values directly to avoid stale state closure issue
                    setTimeout(() => stopLocationEdit({ street, city, state, zip }), 100)
                  }}
                  placeholder="Search address..."
                  className="h-7 text-sm w-full px-2 border rounded"
                />
              </div>
              {/* Top row: City, State, Zip */}
              <div className="flex gap-1">
                <Input
                  value={editingLocation.city}
                  onChange={(e) => updateLocationField('city', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="City"
                  className="h-7 text-sm flex-1"
                  style={{ minWidth: '80px' }}
                />
                <Input
                  value={editingLocation.state}
                  onChange={(e) => updateLocationField('state', e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="ST"
                  maxLength={2}
                  className="h-7 text-sm"
                  style={{ width: '45px' }}
                />
                <Input
                  value={editingLocation.zip}
                  onChange={(e) => updateLocationField('zip', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="Zip"
                  maxLength={5}
                  className="h-7 text-sm"
                  style={{ width: '65px' }}
                />
              </div>
              {/* Bottom row: Street, Date, Time */}
              <div className="flex gap-1">
                <Input
                  value={editingLocation.street}
                  onChange={(e) => updateLocationField('street', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault()
                      stopLocationEdit()
                      setTimeout(() => startLocationEdit(loadKey, 'delivery', load), 0)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="Street"
                  autoFocus
                  className="h-6 text-xs flex-1"
                  style={{ minWidth: '80px', fontSize: '11px' }}
                />
                <Input
                  value={editingLocation.date}
                  onChange={(e) => updateLocationField('date', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="MM/DD/YY"
                  className="h-6 text-xs"
                  style={{ width: '75px', fontSize: '11px' }}
                />
                <Input
                  value={editingLocation.time}
                  onChange={(e) => updateLocationField('time', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="HH:MM AM"
                  className="h-6 text-xs"
                  style={{ width: '75px', fontSize: '11px' }}
                />
              </div>
            </div>
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {/* Top row: City, State, Zip */}
              <div className="flex gap-1 mb-0.5">
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', flex: 1}}>
                  {parseLocation(load.pickup_location).city || 'City'}
                </div>
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', width: '30px'}}>
                  {parseLocation(load.pickup_location).state || 'ST'}
                </div>
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', width: '50px'}}>
                  {parseLocation(load.pickup_location).zip || 'Zip'}
                </div>
              </div>
              {/* Bottom row: Street, Date, Time */}
              <div className="flex gap-1">
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)', flex: 1}}>
                  {parseLocation(load.pickup_location).street || 'Street'}
                </div>
                <div style={{fontSize: '11px', lineHeight: '16px', color: '#22c55e', width: '60px'}}>
                  {formatDateShort(load.pickup_date)}
                </div>
                <div style={{fontSize: '11px', lineHeight: '16px', color: '#22c55e', width: '65px'}}>
                  {formatTimeShort(load.pickup_date)}
                </div>
              </div>
            </div>
          )}
        </td>

        {/* Delivery Location */}
        <td
          className="px-3 py-2.5 border-r"
          style={{borderColor: 'var(--monday-border-light)', minWidth: '200px'}}
          onClick={() => startLocationEdit(loadKey, 'delivery', load)}
        >
          {isEditing(loadKey, 'delivery_location') && editingLocation?.type === 'delivery' ? (
            <div ref={locationEditRef} className="space-y-1 relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              {/* Autocomplete field */}
              <div className="mb-1">
                <AddressAutocomplete
                  value={editingLocation?.street || ''}
                  onChange={(addressData) => {
                    console.log('📬 Received address data in loads page:', addressData)

                    // Use structured address components from Google Places API
                    const street = addressData.street_number && addressData.route
                      ? `${addressData.street_number} ${addressData.route}`
                      : addressData.formatted_address.split(',')[0]  // Fallback for manual entry

                    const city = addressData.locality || ''
                    const state = addressData.administrative_area_level_1 || ''
                    const zip = addressData.postal_code || ''

                    console.log('🏘️ Extracted fields:', { street, city, state, zip })

                    // Update all fields at once to avoid race conditions
                    setEditingLocation(prev => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        street,
                        city,
                        state,
                        zip
                      }
                    })

                    // Auto-save immediately with the values we just extracted
                    // Pass values directly to avoid stale state closure issue
                    setTimeout(() => stopLocationEdit({ street, city, state, zip }), 100)
                  }}
                  placeholder="Search address..."
                  className="h-7 text-sm w-full px-2 border rounded"
                />
              </div>
              {/* Top row: City, State, Zip */}
              <div className="flex gap-1">
                <Input
                  value={editingLocation.city}
                  onChange={(e) => updateLocationField('city', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="City"
                  className="h-7 text-sm flex-1"
                  style={{ minWidth: '80px' }}
                />
                <Input
                  value={editingLocation.state}
                  onChange={(e) => updateLocationField('state', e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="ST"
                  maxLength={2}
                  className="h-7 text-sm"
                  style={{ width: '45px' }}
                />
                <Input
                  value={editingLocation.zip}
                  onChange={(e) => updateLocationField('zip', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="Zip"
                  maxLength={5}
                  className="h-7 text-sm"
                  style={{ width: '65px' }}
                />
              </div>
              {/* Bottom row: Street, Date, Time */}
              <div className="flex gap-1">
                <Input
                  value={editingLocation.street}
                  onChange={(e) => updateLocationField('street', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault()
                      stopLocationEdit()
                      setTimeout(() => startEdit(loadKey, 'rate'), 0)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="Street"
                  autoFocus
                  className="h-6 text-xs flex-1"
                  style={{ minWidth: '80px', fontSize: '11px' }}
                />
                <Input
                  value={editingLocation.date}
                  onChange={(e) => updateLocationField('date', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="MM/DD/YY"
                  className="h-6 text-xs"
                  style={{ width: '75px', fontSize: '11px' }}
                />
                <Input
                  value={editingLocation.time}
                  onChange={(e) => updateLocationField('time', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      stopLocationEdit()
                    }
                  }}
                  placeholder="HH:MM AM"
                  className="h-6 text-xs"
                  style={{ width: '75px', fontSize: '11px' }}
                />
              </div>
            </div>
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {/* Top row: City, State, Zip */}
              <div className="flex gap-1 mb-0.5">
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', flex: 1}}>
                  {parseLocation(load.delivery_location).city || 'City'}
                </div>
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', width: '30px'}}>
                  {parseLocation(load.delivery_location).state || 'ST'}
                </div>
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', width: '50px'}}>
                  {parseLocation(load.delivery_location).zip || 'Zip'}
                </div>
              </div>
              {/* Bottom row: Street, Date, Time */}
              <div className="flex gap-1">
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)', flex: 1}}>
                  {parseLocation(load.delivery_location).street || 'Street'}
                </div>
                <div style={{fontSize: '11px', lineHeight: '16px', color: '#22c55e', width: '60px'}}>
                  {formatDateShort(load.delivery_date)}
                </div>
                <div style={{fontSize: '11px', lineHeight: '16px', color: '#22c55e', width: '65px'}}>
                  {formatTimeShort(load.delivery_date)}
                </div>
              </div>
            </div>
          )}
        </td>

        {/* Notes */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)', minWidth: '150px'}} onClick={() => startEdit(loadKey, 'notes')}>
          {isEditing(loadKey, 'notes') ? (
            <Textarea
              value={load.notes || ''}
              onChange={(e) => {
                // Only update local state, not backend
                const value = e.target.value
                setEditableLoads(prev => prev.map(l =>
                  ((loadKey === 'new' && l.isNew) || l.id === loadKey)
                    ? { ...l, notes: value }
                    : l
                ))
              }}
              onBlur={(e) => {
                updateField(loadKey, 'notes', e.target.value)
                stopEdit()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  updateField(loadKey, 'notes', (e.target as HTMLTextAreaElement).value)
                  stopEdit()
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  updateField(loadKey, 'notes', (e.target as HTMLTextAreaElement).value)
                  stopEdit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  stopEdit()
                }
              }}
              autoFocus
              placeholder="Add notes..."
              className="text-sm min-h-[60px]"
            />
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1 whitespace-pre-wrap">
              {load.notes || 'N/A'}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)', minWidth: '120px'}}>
          {isEditing(loadKey, 'rate') || isEditing(loadKey, 'miles') ? (
            <div className="space-y-1">
              <Input
                type="text"
                inputMode="decimal"
                value={load.rate ?? ''}
                onChange={(e) => {
                  // Keep as string while editing to preserve decimal points and cursor position
                  const value = e.target.value
                  // Allow empty, numbers, and decimal points
                  if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                    setEditableLoads(prev => prev.map(l =>
                      ((loadKey === 'new' && l.isNew) || l.id === loadKey)
                        ? { ...l, rate: value }
                        : l
                    ))
                  }
                }}
                onFocus={() => startEdit(loadKey, 'rate')}
                onBlur={(e) => {
                  const numValue = e.target.value === '' ? 0 : Number(e.target.value)
                  updateField(loadKey, 'rate', numValue)
                  stopEdit()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    const numValue = (e.target as HTMLInputElement).value === '' ? 0 : Number((e.target as HTMLInputElement).value)
                    updateField(loadKey, 'rate', numValue)
                    stopEdit()
                  }
                }}
                placeholder="Rate"
                className="h-7 text-sm"
              />
              <Input
                type="text"
                inputMode="numeric"
                value={load.miles ?? ''}
                onChange={(e) => {
                  // Keep as string while editing
                  const value = e.target.value
                  // Allow empty and integers only
                  if (value === '' || /^\d*$/.test(value)) {
                    setEditableLoads(prev => prev.map(l =>
                      ((loadKey === 'new' && l.isNew) || l.id === loadKey)
                        ? { ...l, miles: value }
                        : l
                    ))
                  }
                }}
                onFocus={() => startEdit(loadKey, 'miles')}
                onBlur={(e) => {
                  const numValue = e.target.value === '' ? 0 : Number(e.target.value)
                  updateField(loadKey, 'miles', numValue)
                  stopEdit()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    const numValue = (e.target as HTMLInputElement).value === '' ? 0 : Number((e.target as HTMLInputElement).value)
                    updateField(loadKey, 'miles', numValue)
                    stopEdit()
                  }
                }}
                placeholder="Miles"
                className="h-6 text-xs"
                style={{fontSize: '11px'}}
              />
            </div>
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-1" onClick={() => startEdit(loadKey, 'rate')}>
              {/* Top row: Rate */}
              <div className="mb-0.5">
                <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', fontWeight: 500}}>
                  {formatCurrency(load.rate)}
                </div>
              </div>
              {/* Bottom row: Miles and RPM */}
              <div className="flex gap-2">
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)'}}>
                  {load.miles?.toLocaleString() || 0} mi
                </div>
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--monday-text-secondary)'}}>
                  ${rpm.toFixed(2)}/mi
                </div>
              </div>
            </div>
          )}
        </td>

        {/* POD */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}}>
          <div className="flex items-center gap-2">
            {load.pod_url ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // Handle both old S3 URLs and new API paths
                    let pdfUrl = load.pod_url
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.absolutetms.com/api'
                    const baseUrl = apiUrl.replace('/api/v1', '').replace('/api', '')

                    console.log('POD Click - Original URL:', pdfUrl)
                    console.log('POD Click - API URL:', apiUrl)
                    console.log('POD Click - Base URL:', baseUrl)

                    if (pdfUrl.includes('s3.amazonaws.com')) {
                      // Old S3 URL - extract filename and use API endpoint
                      const filename = pdfUrl.split('/').pop()
                      pdfUrl = `${baseUrl}/api/v1/uploads/s3/${filename}`
                      console.log('POD Click - Old S3 URL detected, converted to:', pdfUrl)
                    } else if (!pdfUrl.startsWith('http')) {
                      // It's a relative path, construct full API URL
                      pdfUrl = `${baseUrl}${pdfUrl}`
                      console.log('POD Click - Relative path detected, converted to:', pdfUrl)
                    }

                    console.log('POD Click - Final URL:', pdfUrl)

                    setPdfModal({
                      url: pdfUrl,
                      loadId: load.id,
                      type: 'pod'
                    })
                  }}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View
                </button>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e, loadKey, 'pod_url')}
                  className="hidden"
                  id={`pod-upload-${loadKey}`}
                />
                <label
                  htmlFor={`pod-upload-${loadKey}`}
                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Replace
                </label>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e, loadKey, 'pod_url')}
                  className="hidden"
                  id={`pod-upload-${loadKey}`}
                />
                <label
                  htmlFor={`pod-upload-${loadKey}`}
                  className="text-sm text-blue-600 hover:underline cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Upload
                </label>
              </>
            )}
          </div>
        </td>

        {/* Ratecon */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}}>
          <div className="flex items-center gap-2">
            {load.ratecon_url ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // Handle both old S3 URLs and new API paths
                    let pdfUrl = load.ratecon_url
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.absolutetms.com/api'
                    const baseUrl = apiUrl.replace('/api/v1', '').replace('/api', '')

                    console.log('Ratecon Click - Original URL:', pdfUrl)

                    if (pdfUrl.includes('s3.amazonaws.com')) {
                      // Old S3 URL - extract filename and use API endpoint
                      const filename = pdfUrl.split('/').pop()
                      pdfUrl = `${baseUrl}/api/v1/uploads/s3/${filename}`
                      console.log('Ratecon Click - Old S3 URL detected, converted to:', pdfUrl)
                    } else if (!pdfUrl.startsWith('http')) {
                      // It's a relative path, construct full API URL
                      pdfUrl = `${baseUrl}${pdfUrl}`
                      console.log('Ratecon Click - Relative path detected, converted to:', pdfUrl)
                    }

                    console.log('Ratecon Click - Final URL:', pdfUrl)

                    setPdfModal({
                      url: pdfUrl,
                      loadId: load.id,
                      type: 'ratecon'
                    })
                  }}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View
                </button>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e, loadKey, 'ratecon_url')}
                  className="hidden"
                  id={`ratecon-upload-${loadKey}`}
                />
                <label
                  htmlFor={`ratecon-upload-${loadKey}`}
                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Replace
                </label>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e, loadKey, 'ratecon_url')}
                  className="hidden"
                  id={`ratecon-upload-${loadKey}`}
                />
                <label
                  htmlFor={`ratecon-upload-${loadKey}`}
                  className="text-sm text-blue-600 hover:underline cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Upload
                </label>
              </>
            )}
          </div>
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--monday-border-light)'}} onClick={() => startEdit(loadKey, 'status')}>
          {isEditing(loadKey, 'status') ? (
            <Select
              value={load.status}
              onValueChange={(value) => {
                updateField(loadKey, 'status', value)
                stopEdit()
              }}
              open={true}
              onOpenChange={(open) => !open && stopEdit()}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${getStatusColor(load.status)}`}>
              {load.status.replace('_', ' ')}
            </span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="page-loads space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Loads</h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>Manage your shipments and deliveries</p>
          </div>
          <div className="flex gap-2">
            <div className="relative" ref={groupMenuRef}>
              <Button
                variant="outline"
                onClick={() => setGroupMenuOpen(!groupMenuOpen)}
                className="w-40"
              >
                Group by...
                {activeGroupings.size > 0 && (
                  <span className="ml-2 bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs">
                    {activeGroupings.size}
                  </span>
                )}
              </Button>
              {groupMenuOpen && (
                <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                      onClick={() => toggleGrouping('week')}
                    >
                      <span>Week</span>
                      {activeGroupings.has('week') && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                      onClick={() => toggleGrouping('driver')}
                    >
                      <span>Driver</span>
                      {activeGroupings.has('driver') && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                      onClick={() => toggleGrouping('customer')}
                    >
                      <span>Customer</span>
                      {activeGroupings.has('customer') && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                    {activeGroupings.size > 0 && (
                      <>
                        <div className="border-t border-gray-200 my-1"></div>
                        <button
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
                          onClick={() => setActiveGroupings(new Set())}
                        >
                          Clear all
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              className="hover:opacity-90"
              style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }}
              onClick={handleAddNew}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Load
            </Button>
          </div>
        </div>

        {/* Upcoming Load Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className="cursor-pointer transition-all rounded-lg p-4 hover:shadow-md"
            style={{
              backgroundColor: upcomingFilter ? 'rgba(97, 97, 255, 0.1)' : 'var(--monday-bg-primary)',
              border: upcomingFilter ? '2px solid var(--monday-cornflower)' : '1px solid var(--monday-border-light)'
            }}
            onClick={() => {
              const newUpcomingFilter = !upcomingFilter
              setUpcomingFilter(newUpcomingFilter)

              // Automatically enable day grouping when upcoming filter is turned on
              if (newUpcomingFilter) {
                setStatusFilter(null)
                setActiveGroupings(new Set(['day']))
              } else {
                // Clear day grouping when upcoming filter is turned off
                const newGroupings = new Set(activeGroupings)
                newGroupings.delete('day')
                setActiveGroupings(newGroupings)
              }
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Upcoming Loads</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--monday-text-primary)' }}>{upcomingStats.total}</p>
            </div>
          </div>

          <div
            className="cursor-pointer transition-all rounded-lg p-4 hover:shadow-md"
            style={{
              backgroundColor: statusFilter === 'available' ? 'rgba(0, 200, 117, 0.1)' : 'var(--monday-bg-primary)',
              border: statusFilter === 'available' ? '2px solid var(--monday-done)' : '1px solid var(--monday-border-light)'
            }}
            onClick={() => setStatusFilter(statusFilter === 'available' ? null : 'available')}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Available</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--monday-done)' }}>{upcomingStats.available}</p>
            </div>
          </div>

          <div
            className="cursor-pointer transition-all rounded-lg p-4 hover:shadow-md"
            style={{
              backgroundColor: statusFilter === 'dispatched' ? 'rgba(253, 171, 61, 0.1)' : 'var(--monday-bg-primary)',
              border: statusFilter === 'dispatched' ? '2px solid var(--monday-working)' : '1px solid var(--monday-border-light)'
            }}
            onClick={() => setStatusFilter(statusFilter === 'dispatched' ? null : 'dispatched')}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Dispatched</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--monday-working)' }}>{upcomingStats.dispatched}</p>
            </div>
          </div>

          <div
            className="cursor-pointer transition-all rounded-lg p-4 hover:shadow-md"
            style={{
              backgroundColor: statusFilter === 'invoiced' ? 'rgba(162, 93, 220, 0.1)' : 'var(--monday-bg-primary)',
              border: statusFilter === 'invoiced' ? '2px solid var(--monday-purple)' : '1px solid var(--monday-border-light)'
            }}
            onClick={() => setStatusFilter(statusFilter === 'invoiced' ? null : 'invoiced')}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Invoiced</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--monday-purple)' }}>{upcomingStats.invoiced}</p>
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--monday-border-light)'}} onContextMenu={handleGeneralContextMenu}>
          <div className="overflow-x-auto">
            <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
              <thead style={{backgroundColor: 'var(--monday-bg-secondary)'}}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.week}px`, minWidth: `${columnWidths.week}px`}} onClick={() => handleSort('weekNumber')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.week}
                      onAdjust={(delta) => adjustWidth('week', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Week
                      {sortField === 'weekNumber' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.date}px`, minWidth: `${columnWidths.date}px`}} onClick={() => handleSort('pickup_date')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.date}
                      onAdjust={(delta) => adjustWidth('date', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Date
                      {sortField === 'pickup_date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.load_number}px`, minWidth: `${columnWidths.load_number}px`}} onClick={() => handleSort('load_number')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.load_number}
                      onAdjust={(delta) => adjustWidth('load_number', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Load #
                      {sortField === 'load_number' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.customer}px`, minWidth: `${columnWidths.customer}px`}} onClick={() => handleSort('customer_id')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.customer}
                      onAdjust={(delta) => adjustWidth('customer', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Customer
                      {sortField === 'customer_id' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.driver}px`, minWidth: `${columnWidths.driver}px`}} onClick={() => handleSort('driver_id')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.driver}
                      onAdjust={(delta) => adjustWidth('driver', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Driver
                      {sortField === 'driver_id' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.pickup}px`, minWidth: `${columnWidths.pickup}px`}} onClick={() => handleSort('pickup_location')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.pickup}
                      onAdjust={(delta) => adjustWidth('pickup', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Pickup
                      {sortField === 'pickup_location' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.delivery}px`, minWidth: `${columnWidths.delivery}px`}} onClick={() => handleSort('delivery_location')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.delivery}
                      onAdjust={(delta) => adjustWidth('delivery', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Delivery
                      {sortField === 'delivery_location' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.notes}px`, minWidth: `${columnWidths.notes}px`}}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.notes}
                      onAdjust={(delta) => adjustWidth('notes', delta)}
                    />
                    Notes
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.rate}px`, minWidth: `${columnWidths.rate}px`}} onClick={() => handleSort('rate')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.rate}
                      onAdjust={(delta) => adjustWidth('rate', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Rate
                      {sortField === 'rate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.pod}px`, minWidth: `${columnWidths.pod}px`}}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.pod}
                      onAdjust={(delta) => adjustWidth('pod', delta)}
                    />
                    POD
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.ratecon}px`, minWidth: `${columnWidths.ratecon}px`}}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.ratecon}
                      onAdjust={(delta) => adjustWidth('ratecon', delta)}
                    />
                    Ratecon
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none relative group" style={{color: 'var(--monday-text-secondary)', borderColor: 'var(--monday-border-light)', fontWeight: 500, width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`}} onClick={() => handleSort('status')}>
                    <ColumnWidthControl
                      currentWidth={columnWidths.status}
                      onAdjust={(delta) => adjustWidth('status', delta)}
                    />
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white" style={{backgroundColor: 'var(--monday-bg-primary)'}}>
                {activeGroupings.size === 0 ? (
                  filteredLoads.map((load, index) => renderLoadRow(load, 0, index))
                ) : (
                  groupedLoads && renderNestedGroups(groupedLoads, 0, 0)
                )}
              </tbody>
              <tfoot className="sticky bottom-0 shadow-lg" style={{ backgroundColor: 'var(--monday-bg-primary)', borderTop: '2px solid var(--monday-border)' }}>
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm font-medium" style={{ color: 'var(--monday-text-primary)' }}>{totals.count} Loads</td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm">
                    <div className="mb-0.5">
                      <div style={{fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)'}}>
                        {formatCurrency(totals.rate)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div style={{fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: 'var(--monday-blue)'}}>
                        {totals.miles.toLocaleString()} mi
                      </div>
                      <div style={{fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: 'var(--monday-purple)'}}>
                        ${totals.rpm.toFixed(2)}/mi
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'load' && contextMenu.loadId && (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    // Start editing the first editable field (load_number)
                    startEdit(contextMenu.loadId!, 'load_number')
                    setContextMenu(null)
                  }}
                >
                  <Edit2 className="h-4 w-4 text-blue-600" />
                  <span>Edit Load</span>
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    handleDuplicate(contextMenu.loadId!)
                  }}
                >
                  <Copy className="h-4 w-4 text-green-600" />
                  <span>Duplicate Load</span>
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  onClick={() => {
                    handleDelete(contextMenu.loadId!)
                    setContextMenu(null)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Load</span>
                </button>
              </>
            )}
            {contextMenu.type === 'general' && (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={expandAllGroups}
                >
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                  <span>Expand All</span>
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={collapseAllGroups}
                >
                  <ChevronRight className="h-4 w-4 text-blue-600" />
                  <span>Collapse All</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* PDF Viewer Modal */}
        {pdfModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setPdfModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">
                  {pdfModal.type === 'pod' ? 'Proof of Delivery' : 'Rate Confirmation'}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete this ${pdfModal.type === 'pod' ? 'POD' : 'Ratecon'}?`)) {
                        handleDeletePdf(pdfModal.loadId, pdfModal.type === 'pod' ? 'pod_url' : 'ratecon_url')
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <button
                    onClick={() => setPdfModal(null)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 p-4 overflow-hidden">
                <PdfViewer
                  url={pdfModal.url}
                  title={pdfModal.type === 'pod' ? 'POD Viewer' : 'Ratecon Viewer'}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
