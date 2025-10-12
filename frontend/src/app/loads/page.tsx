'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, ChevronRight, ChevronDown, Edit2, Trash2, Copy, Undo2 } from 'lucide-react'
import { useLoads, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Load } from '@/types'
import toast from 'react-hot-toast'

interface EditableLoad extends Load {
  isNew?: boolean
  weekNumber?: number
  weekLabel?: string
  weekDateRange?: string
}

type EditingCell = {
  loadId: number | 'new'
  field: string
} | null

// Helper to get week number from date
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
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

export default function LoadsPageInline() {
  const { data: loadsData, isLoading, refetch } = useLoads(1, 1000)
  const loads = loadsData?.items || []
  const createLoad = useCreateLoad()
  const updateLoad = useUpdateLoad()
  const deleteLoad = useDeleteLoad()

  const { data: customersData } = useCustomers()
  const customers = customersData?.items || []

  const { data: driversData } = useDrivers()
  const drivers = driversData?.items || []

  const { data: trucksData } = useTrucks()
  const trucks = trucksData?.items || []

  const [editableLoads, setEditableLoads] = useState<EditableLoad[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [groupBy, setGroupBy] = useState<'none' | 'week' | 'driver' | 'customer'>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [upcomingFilter, setUpcomingFilter] = useState<boolean>(false)
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, loadId: number} | null>(null)

  // Sync loads with editable state and add week info
  React.useEffect(() => {
    // Only update if the loads have actually changed
    const loadIds = loads.map(l => l.id).sort().join(',')
    const editableIds = editableLoads.map(l => l.id).sort().join(',')

    if (loadIds !== editableIds) {
      const loadsWithWeeks = loads.map(load => {
        const pickupDate = new Date(load.pickup_date)
        return {
          ...load,
          weekNumber: getWeekNumber(pickupDate),
          weekLabel: getWeekLabel(pickupDate),
          weekDateRange: getWeekDateRange(pickupDate)
        }
      })
      setEditableLoads(loadsWithWeeks)
    }
  }, [loads, loads.length, editableLoads])

  // Group loads
  const groupedLoads = useMemo(() => {
    if (groupBy === 'none') return null

    const groups: Record<string, EditableLoad[]> = {}
    editableLoads.forEach(load => {
      let groupKey = ''
      if (groupBy === 'week') {
        groupKey = `Week ${load.weekNumber}`
      } else if (groupBy === 'driver') {
        groupKey = load.driver ? `${load.driver.first_name} ${load.driver.last_name}` : 'Unassigned'
      } else if (groupBy === 'customer') {
        groupKey = customers.find(c => c.id === load.customer_id)?.name || 'N/A'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(load)
    })

    return groups
  }, [editableLoads, groupBy, customers])

  // Filter loads based on upcoming and status filters
  const filteredLoads = useMemo(() => {
    let filtered = editableLoads

    // Apply upcoming filter (today and tomorrow)
    if (upcomingFilter) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      filtered = filtered.filter(load => {
        const pickupDate = new Date(load.pickup_date)
        pickupDate.setHours(0, 0, 0, 0)
        return pickupDate.getTime() === today.getTime() || pickupDate.getTime() === tomorrow.getTime()
      })
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(load => load.status === statusFilter)
    }

    return filtered
  }, [editableLoads, upcomingFilter, statusFilter])

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey)
    } else {
      newCollapsed.add(groupKey)
    }
    setCollapsedGroups(newCollapsed)
  }

  // Calculate upcoming loads statistics (today and tomorrow)
  const upcomingStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const upcomingLoads = editableLoads.filter(load => {
      const pickupDate = new Date(load.pickup_date)
      pickupDate.setHours(0, 0, 0, 0)
      return pickupDate.getTime() === today.getTime() || pickupDate.getTime() === tomorrow.getTime()
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
      const result = await createLoad.mutateAsync(backendData)

      // Immediately add the new load to the local state
      const pickupDate = new Date(result.pickup_date)
      const newLoadWithWeek = {
        ...result,
        weekNumber: getWeekNumber(pickupDate),
        weekLabel: getWeekLabel(pickupDate),
        weekDateRange: getWeekDateRange(pickupDate)
      }

      setEditableLoads([...editableLoads, newLoadWithWeek])

      // Also refetch to sync with backend
      refetch()
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
                      truck_id: deletedLoad.truck_id || null,
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
                      weekDateRange: getWeekDateRange(pickupDate)
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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    loadKey: number | 'new',
    field: 'pod_url' | 'ratecon_url'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed')
      return
    }

    // Create form data
    const formData = new FormData()
    formData.append('file', file)

    try {
      // Get token from cookie
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
      }
      const token = getCookie('auth-token')

      // Upload file
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      const response = await fetch(`${apiUrl}/v1/uploads/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      // Update the field with the returned URL
      await updateField(loadKey, field, data.url)
    } catch (error) {
      console.error('File upload error:', error)
      alert('Failed to upload file')
    }

    // Reset the input
    e.target.value = ''
  }

  const updateField = async (id: number | 'new', field: keyof EditableLoad, value: any) => {
    const updatedLoads = editableLoads.map(load => {
      if ((id === 'new' && load.isNew) || load.id === id) {
        const updated = { ...load, [field]: value }

        // Update nested objects when IDs change
        if (field === 'driver_id') {
          updated.driver = value ? drivers.find(d => d.id === value) : undefined
        } else if (field === 'truck_id') {
          updated.truck = value ? trucks.find(t => t.id === value) : undefined
        }

        return updated
      }
      return load
    })
    setEditableLoads(updatedLoads)

    // Auto-save to backend if not a new load
    const load = updatedLoads.find(l => (id === 'new' && l.isNew) || l.id === id)
    if (load && !load.isNew) {
      const backendData: any = {
        load_number: load.load_number,
        customer_id: load.customer_id,
        driver_id: load.driver_id || null,
        truck_id: load.truck_id || null,
        pickup_location: load.pickup_location,
        delivery_location: load.delivery_location,
        pickup_date: load.pickup_date,
        delivery_date: load.delivery_date,
        miles: load.miles || 0,
        rate: load.rate || 0,
        status: load.status
      }
      await updateLoad.mutateAsync({ id: load.id, data: backendData })
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
      loadId
    })
  }

  const handleDuplicate = async (id: number) => {
    const loadToDuplicate = editableLoads.find(l => l.id === id)
    if (!loadToDuplicate) return

    const backendData: any = {
      load_number: '',
      customer_id: loadToDuplicate.customer_id,
      driver_id: loadToDuplicate.driver_id || null,
      truck_id: loadToDuplicate.truck_id || null,
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
        weekDateRange: getWeekDateRange(pickupDate)
      }
      setEditableLoads([...editableLoads, newLoadWithWeek])
      refetch()
      setContextMenu(null)
    } catch (error: any) {
      console.error('Failed to duplicate load:', error)
      alert(`Failed to duplicate load: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleAddToGroup = async (groupKey: string) => {
    // Determine the customer_id or driver_id based on the grouping
    let customer_id = customers.length > 0 ? customers[0].id : null
    let driver_id = null

    if (groupBy === 'customer') {
      // Find the customer by name
      const customer = customers.find(c => c.name === groupKey)
      if (customer) {
        customer_id = customer.id
      }
    } else if (groupBy === 'driver') {
      // Find the driver by name
      if (groupKey !== 'Unassigned') {
        const [firstName, lastName] = groupKey.split(' ')
        const driver = drivers.find(d => d.first_name === firstName && d.last_name === lastName)
        if (driver) {
          driver_id = driver.id
        }
      }
    }

    // Create a new load with the determined customer/driver
    const backendData: any = {
      load_number: '',
      customer_id: customer_id,
      driver_id: driver_id,
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
      const result = await createLoad.mutateAsync(backendData)
      const pickupDate = new Date(result.pickup_date)
      const newLoadWithWeek = {
        ...result,
        weekNumber: getWeekNumber(pickupDate),
        weekLabel: getWeekLabel(pickupDate),
        weekDateRange: getWeekDateRange(pickupDate)
      }
      setEditableLoads([...editableLoads, newLoadWithWeek])
      refetch()
    } catch (error: any) {
      console.error('Failed to create load:', error)
      alert(`Failed to create load: ${error.response?.data?.detail || error.message}`)
    }
  }

  const renderLoadRow = (load: EditableLoad, paddingLeft = 0, rowIndex = 0) => {
    const loadKey = load.isNew ? 'new' : load.id
    const rpm = load.miles && load.miles > 0 ? (load.rate || 0) / load.miles : 0
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    return (
      <tr
        key={loadKey}
        className="border-b transition-colors"
        style={{
          borderColor: 'var(--cell-borderColor)',
          backgroundColor: defaultBgColor
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget
          target.style.backgroundColor = 'var(--row-background-cursor)'
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
        <td className="px-3 py-2.5 border-r" style={{ paddingLeft: `${paddingLeft + 12}px`, borderColor: 'var(--cell-borderColor)' }}>
          <div>
            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>{load.weekLabel}</div>
            <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--colors-foreground-muted)'}}>{load.weekDateRange}</div>
          </div>
        </td>

        {/* Date */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'pickup_date')}>
          {isEditing(loadKey, 'pickup_date') ? (
            <Input
              type="date"
              value={formatDateForInput(load.pickup_date)}
              onChange={(e) => updateField(loadKey, 'pickup_date', `${e.target.value}T00:00:00`)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {new Date(load.pickup_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
            </div>
          )}
        </td>

        {/* Load # */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'load_number')}>
          {isEditing(loadKey, 'load_number') ? (
            <Input
              value={load.load_number}
              onChange={(e) => updateField(loadKey, 'load_number', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {load.load_number}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'customer_id')}>
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
              <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                {customers.find(c => c.id === load.customer_id)?.name || 'N/A'}
              </div>
              {customers.find(c => c.id === load.customer_id)?.mc && (
                <div style={{fontSize: '11px', lineHeight: '16px', color: 'var(--colors-foreground-muted)'}}>
                  MC: {customers.find(c => c.id === load.customer_id)?.mc}
                </div>
              )}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'driver_id')}>
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

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'truck_id')}>
          {isEditing(loadKey, 'truck_id') ? (
            <Select
              value={load.truck_id ? String(load.truck_id) : 'unassigned'}
              onValueChange={(value) => {
                updateField(loadKey, 'truck_id', value === 'unassigned' ? null : Number(value))
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
                {trucks.map(truck => (
                  <SelectItem key={truck.id} value={String(truck.id)}>
                    {truck.truck_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.truck ? load.truck.truck_number : 'Unassigned'}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'pickup_location')}>
          {isEditing(loadKey, 'pickup_location') ? (
            <Input
              value={load.pickup_location}
              onChange={(e) => updateField(loadKey, 'pickup_location', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="City, ST"
              className="h-8 text-sm"
            />
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.pickup_location || 'N/A'}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'delivery_location')}>
          {isEditing(loadKey, 'delivery_location') ? (
            <Input
              value={load.delivery_location}
              onChange={(e) => updateField(loadKey, 'delivery_location', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="City, ST"
              className="h-8 text-sm"
            />
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.delivery_location || 'N/A'}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'rate')}>
          {isEditing(loadKey, 'rate') ? (
            <Input
              type="number"
              value={load.rate}
              onChange={(e) => updateField(loadKey, 'rate', Number(e.target.value))}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm text-right"
            />
          ) : (
            <div className="text-sm font-medium cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {formatCurrency(load.rate)}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'miles')}>
          {isEditing(loadKey, 'miles') ? (
            <Input
              type="number"
              value={load.miles}
              onChange={(e) => updateField(loadKey, 'miles', Number(e.target.value))}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm text-right"
            />
          ) : (
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.miles?.toLocaleString() || 0}
            </div>
          )}
        </td>

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="text-sm text-gray-600">
            ${rpm.toFixed(2)}
          </div>
        </td>

        {/* POD */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="flex items-center gap-2">
            {load.pod_url ? (
              <>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${load.pod_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  View
                </a>
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
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="flex items-center gap-2">
            {load.ratecon_url ? (
              <>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${load.ratecon_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  View
                </a>
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

        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(loadKey, 'status')}>
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
            <h1 className="text-2xl font-semibold text-gray-900">Loads</h1>
            <p className="text-gray-600">Manage your shipments and deliveries</p>
          </div>
          <div className="flex gap-2">
            <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Group by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
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
            className={`cursor-pointer transition-all ${upcomingFilter ? 'bg-blue-50 border-blue-500 border-2' : 'bg-white border border-gray-200'} rounded-lg p-4 hover:shadow-md`}
            onClick={() => {
              setUpcomingFilter(!upcomingFilter)
              if (!upcomingFilter) setStatusFilter(null)
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Loads</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div
            className={`cursor-pointer transition-all ${statusFilter === 'available' ? 'bg-green-50 border-green-500 border-2' : 'bg-white border border-gray-200'} rounded-lg p-4 hover:shadow-md`}
            onClick={() => setStatusFilter(statusFilter === 'available' ? null : 'available')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{upcomingStats.available}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            className={`cursor-pointer transition-all ${statusFilter === 'dispatched' ? 'bg-orange-50 border-orange-500 border-2' : 'bg-white border border-gray-200'} rounded-lg p-4 hover:shadow-md`}
            onClick={() => setStatusFilter(statusFilter === 'dispatched' ? null : 'dispatched')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Dispatched</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{upcomingStats.dispatched}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            className={`cursor-pointer transition-all ${statusFilter === 'invoiced' ? 'bg-purple-50 border-purple-500 border-2' : 'bg-white border border-gray-200'} rounded-lg p-4 hover:shadow-md`}
            onClick={() => setStatusFilter(statusFilter === 'invoiced' ? null : 'invoiced')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Invoiced</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{upcomingStats.invoiced}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="overflow-x-auto">
            <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
              <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Week</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Load #</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Customer</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Driver</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Truck</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Pickup</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Delivery</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Rate</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Miles</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>RPM</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>POD</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Ratecon</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Status</th>
                </tr>
              </thead>
              <tbody className="bg-white" style={{backgroundColor: 'var(--cell-background-base)'}}>
                {groupBy === 'none' ? (
                  filteredLoads.map((load, index) => renderLoadRow(load, 0, index))
                ) : (
                  groupedLoads && Object.entries(groupedLoads).map(([groupKey, groupLoads]) => {
                    const isCollapsed = collapsedGroups.has(groupKey)
                    const groupTotalRate = groupLoads.reduce((sum, l) => sum + (Number(l.rate) || 0), 0)
                    const groupTotalMiles = groupLoads.reduce((sum, l) => sum + (Number(l.miles) || 0), 0)
                    const groupRPM = groupTotalMiles > 0 ? groupTotalRate / groupTotalMiles : 0

                    return (
                      <React.Fragment key={groupKey}>
                        {/* Group Header Row */}
                        <tr className="bg-gray-100 border-b border-gray-200 cursor-pointer" onClick={() => toggleGroup(groupKey)}>
                          <td colSpan={2} className="px-2 py-2 text-sm font-medium text-gray-700">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <span>{groupKey}</span>
                              <span className="text-gray-500">({groupLoads.length} loads)</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-sm" colSpan={7}></td>
                          <td className="px-2 py-2 text-sm font-medium text-green-700">
                            {formatCurrency(groupTotalRate)}
                          </td>
                          <td className="px-2 py-2 text-sm font-medium text-blue-700">
                            {groupTotalMiles.toLocaleString()} mi
                          </td>
                          <td className="px-2 py-2 text-sm font-medium text-purple-700">
                            ${groupRPM.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-sm" colSpan={3}></td>
                        </tr>
                        {/* Group Loads */}
                        {!isCollapsed && groupLoads.map((load, index) => renderLoadRow(load, 20, index))}
                        {/* Add Load Button Row */}
                        {!isCollapsed && (
                          <tr className="border-b hover:bg-gray-50 transition-colors" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <td colSpan={14} className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddToGroup(groupKey)
                                }}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium ml-5"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Add load to {groupKey}</span>
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg">
                <tr className="bg-gray-50">
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm font-medium">{totals.count} Loads</td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm"></td>
                  <td className="px-2 py-2 text-sm font-medium text-green-700">
                    {formatCurrency(totals.rate)}
                  </td>
                  <td className="px-2 py-2 text-sm font-medium text-blue-700">
                    {totals.miles.toLocaleString()} mi
                  </td>
                  <td className="px-2 py-2 text-sm font-medium text-purple-700">
                    ${totals.rpm.toFixed(2)}
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
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                // Start editing the first editable field (load_number)
                startEdit(contextMenu.loadId, 'load_number')
                setContextMenu(null)
              }}
            >
              <Edit2 className="h-4 w-4 text-blue-600" />
              <span>Edit Load</span>
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                handleDuplicate(contextMenu.loadId)
              }}
            >
              <Copy className="h-4 w-4 text-green-600" />
              <span>Duplicate Load</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
              onClick={() => {
                handleDelete(contextMenu.loadId)
                setContextMenu(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Load</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
