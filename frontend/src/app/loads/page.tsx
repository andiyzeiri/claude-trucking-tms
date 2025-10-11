'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, ChevronRight, ChevronDown } from 'lucide-react'
import { useLoads, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Load } from '@/types'

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

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey)
    } else {
      newCollapsed.add(groupKey)
    }
    setCollapsedGroups(newCollapsed)
  }

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
      status: 'pending'
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
    if (confirm('Are you sure you want to delete this load?')) {
      try {
        await deleteLoad.mutateAsync(id)
        setEditableLoads(editableLoads.filter(load => load.id !== id))
      } catch (error: any) {
        console.error('Failed to delete load:', error)
        alert(`Failed to delete load: ${error.response?.data?.detail || error.message}`)
      }
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
      const response = await fetch('http://localhost:8000/api/v1/uploads/', {
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
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'in_transit': return 'bg-blue-100 text-blue-800'
      case 'assigned': return 'bg-yellow-100 text-yellow-800'
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

  const renderLoadRow = (load: EditableLoad, paddingLeft = 0) => {
    const loadKey = load.isNew ? 'new' : load.id
    const rpm = load.miles && load.miles > 0 ? (load.rate || 0) / load.miles : 0

    return (
      <tr
        key={loadKey}
        className="hover:bg-gray-50"
        onContextMenu={(e) => {
          e.preventDefault()
          if (!load.isNew) {
            handleDelete(load.id)
          }
        }}
      >
        {/* Week */}
        <td className="px-2 py-2" style={{ paddingLeft: `${paddingLeft + 8}px` }}>
          <div>
            <div className="text-sm text-gray-900">{load.weekLabel}</div>
            <div className="text-xs text-gray-500">{load.weekDateRange}</div>
          </div>
        </td>

        {/* Date */}
        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'pickup_date')}>
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
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {new Date(load.pickup_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
            </div>
          )}
        </td>

        {/* Load # */}
        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'load_number')}>
          {isEditing(loadKey, 'load_number') ? (
            <Input
              value={load.load_number}
              onChange={(e) => updateField(loadKey, 'load_number', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="text-sm font-medium cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {load.load_number}
            </div>
          )}
        </td>

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'customer_id')}>
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
            <div className="text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-1">
              {customers.find(c => c.id === load.customer_id)?.name || 'N/A'}
            </div>
          )}
        </td>

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'driver_id')}>
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'truck_id')}>
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'pickup_location')}>
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'delivery_location')}>
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'rate')}>
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'miles')}>
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

        <td className="px-2 py-2">
          <div className="text-sm text-gray-600">
            ${rpm.toFixed(2)}
          </div>
        </td>

        {/* POD */}
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            {load.pod_url ? (
              <>
                <a
                  href={`http://localhost:8000${load.pod_url}`}
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
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            {load.ratecon_url ? (
              <>
                <a
                  href={`http://localhost:8000${load.ratecon_url}`}
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

        <td className="px-2 py-2" onClick={() => startEdit(loadKey, 'status')}>
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
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

        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Load #</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Truck</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Miles</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">RPM</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">POD</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ratecon</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {groupBy === 'none' ? (
                  editableLoads.map((load) => renderLoadRow(load))
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
                        {!isCollapsed && groupLoads.map((load) => renderLoadRow(load, 20))}
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
      </div>
    </Layout>
  )
}
