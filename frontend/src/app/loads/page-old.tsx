'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { LoadModal, LoadData } from '@/components/loads/load-modal'
import { DocumentModal } from '@/components/loads/document-modal'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { Plus, Package, MapPin, DollarSign, FileText, CheckCircle, X, User, Edit, Trash2, Upload, FolderOpen } from 'lucide-react'
import { useLoads, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'

export default function LoadsPage() {
  // Fetch real loads from API
  const { data: loadsData, isLoading } = useLoads()
  const loads = loadsData?.items || []
  const createLoad = useCreateLoad()
  const updateLoad = useUpdateLoad()
  const deleteLoad = useDeleteLoad()

  // Fetch customers to display names instead of IDs
  const { data: customersData } = useCustomers()
  const customers = customersData?.items || []
  const customerMap = useMemo(() => {
    const map: Record<number, string> = {}
    customers.forEach(c => {
      map[c.id] = c.name
    })
    return map
  }, [customers])

  // Fetch drivers to display names instead of IDs
  const { data: driversData } = useDrivers()
  const drivers = driversData?.items || []
  const driverMap = useMemo(() => {
    const map: Record<number, string> = {}
    drivers.forEach(d => {
      const firstName = d.first_name.charAt(0).toUpperCase() + d.first_name.slice(1).toLowerCase()
      const lastName = d.last_name.charAt(0).toUpperCase() + d.last_name.slice(1).toLowerCase()
      map[d.id] = `${firstName} ${lastName}`
    })
    return map
  }, [drivers])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLoad, setEditingLoad] = useState<LoadData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Document management state
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false)
  const [documentLoad, setDocumentLoad] = useState<LoadData | null>(null)

  // Load documents from localStorage on mount
  const [loadDocuments, setLoadDocuments] = useState<Record<number, {
    ratecon: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
    pod: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
  }>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('loadDocuments')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Convert date strings back to Date objects
          Object.keys(parsed).forEach(key => {
            parsed[key].ratecon = parsed[key].ratecon.map((doc: any) => ({
              ...doc,
              uploadedAt: new Date(doc.uploadedAt)
            }))
            parsed[key].pod = parsed[key].pod.map((doc: any) => ({
              ...doc,
              uploadedAt: new Date(doc.uploadedAt)
            }))
          })
          return parsed
        } catch (e) {
          console.error('Failed to parse stored documents:', e)
        }
      }
    }
    return {
      1: {
        ratecon: [
          { id: 'demo-1', name: 'Rate_Confirmation_TMS001.pdf', size: 245760, type: 'application/pdf', url: '#', uploadedAt: new Date('2024-01-15') }
        ],
        pod: []
      },
      2: {
        ratecon: [
          { id: 'demo-2', name: 'Rate_Confirmation_TMS002.pdf', size: 189440, type: 'application/pdf', url: '#', uploadedAt: new Date('2024-01-14') }
        ],
        pod: [
          { id: 'demo-3', name: 'POD_TMS002.pdf', size: 345600, type: 'application/pdf', url: '#', uploadedAt: new Date('2024-01-15') }
        ]
      },
      3: { ratecon: [], pod: [] }
    }
  })

  // Save documents to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('loadDocuments', JSON.stringify(loadDocuments))
    }
  }, [loadDocuments])

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: LoadData | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // CRUD operations
  const handleCreateLoad = () => {
    setEditingLoad(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditLoad = (load: LoadData) => {
    // Transform backend data to frontend format for editing
    const formattedLoad = {
      ...load,
      pickup_date: load.pickup_date ? load.pickup_date.split('T')[0] : '',
      pickup_time: load.pickup_date ? load.pickup_date.split('T')[1]?.substring(0, 5) || '00:00' : '00:00',
      delivery_date: load.delivery_date ? load.delivery_date.split('T')[0] : '',
      delivery_time: load.delivery_date ? load.delivery_date.split('T')[1]?.substring(0, 5) || '00:00' : '00:00',
    }

    // If load has description but no pickup/delivery locations, parse the description
    if (load.description && !load.pickup_location && !load.delivery_location) {
      const parts = load.description.split(' to ')
      if (parts.length === 2) {
        formattedLoad.pickup_location = parts[0].trim()
        formattedLoad.delivery_location = parts[1].trim()
      }
    }

    console.log('handleEditLoad - formattedLoad:', JSON.stringify(formattedLoad, null, 2))
    setEditingLoad(formattedLoad)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleRowClick = (load: LoadData) => {
    handleEditLoad(load)
  }

  const handleDeleteLoad = (loadId: number) => {
    if (confirm('Are you sure you want to delete this load?')) {
      deleteLoad.mutate(loadId)
    }
  }

  const handleSaveLoad = (loadData: LoadData) => {
    console.log('handleSaveLoad - loadData received:', JSON.stringify(loadData, null, 2))

    // Transform frontend data to backend format
    const backendData: any = {
      load_number: loadData.load_number || `TMS${Date.now()}`,
      status: loadData.status || 'pending',
      rate: loadData.rate !== undefined ? loadData.rate : null,
      customer_id: loadData.customer_id || 2, // Default to customer 2 if not selected
      driver_id: loadData.driver_id || null,
      truck_id: null,
      pickup_location: loadData.pickup_location || null,
      delivery_location: loadData.delivery_location || null,
      miles: loadData.miles !== undefined ? loadData.miles : null,
      notes: loadData.notes || null
    }

    if (loadData.pickup_location || loadData.delivery_location) {
      backendData.description = `${loadData.pickup_location || ''} to ${loadData.delivery_location || ''}`.trim()
    }

    if (loadData.pickup_date && loadData.pickup_time) {
      backendData.pickup_date = `${loadData.pickup_date}T${loadData.pickup_time}:00`
    }

    if (loadData.delivery_date && loadData.delivery_time) {
      backendData.delivery_date = `${loadData.delivery_date}T${loadData.delivery_time}:00`
    }

    console.log('handleSaveLoad - backendData to send:', JSON.stringify(backendData, null, 2))

    if (modalMode === 'create') {
      createLoad.mutate(backendData)
    } else if (editingLoad?.id) {
      updateLoad.mutate({ id: editingLoad.id, data: backendData })
    }
    setIsModalOpen(false)
  }

  // Context menu handlers
  const handleRowRightClick = (row: LoadData, event: React.MouseEvent) => {
    setContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row
    })
  }

  const closeContextMenu = () => {
    setContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  }

  const handleContextEdit = () => {
    if (contextMenu.row) {
      handleEditLoad(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeleteLoad(contextMenu.row.id!)
    }
    closeContextMenu()
  }

  // Document management handlers
  const handleManageDocuments = (load: LoadData) => {
    setDocumentLoad(load)
    setIsDocumentModalOpen(true)
    closeContextMenu()
  }

  const handleDocumentsChange = (loadId: number, documents: {
    ratecon: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
    pod: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
  }) => {
    setLoadDocuments(prev => ({
      ...prev,
      [loadId]: documents
    }))
  }

  const closeDocumentModal = () => {
    setIsDocumentModalOpen(false)
    setDocumentLoad(null)
  }

  // Calculate group totals for display in group headers
  const calculateGroupTotals = (rows: LoadData[]) => {
    const totalRate = rows.reduce((sum, row) => sum + Number(row.rate || 0), 0)
    const totalMiles = rows.reduce((sum, row) => sum + Number(row.miles || 0), 0)
    const averageRPM = totalMiles > 0 ? totalRate / totalMiles : 0

    return {
      'load_number': (
        <span className="text-sm font-medium text-gray-900">
          {rows.length} load{rows.length !== 1 ? 's' : ''}
        </span>
      ),
      'rate': (
        <div className="text-sm font-medium text-green-700">
          ${totalRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
      'miles': (
        <span className="text-sm font-medium text-blue-700">
          {totalMiles.toLocaleString()} mi
        </span>
      ),
      'rpm': (
        <span className="text-sm font-medium text-purple-700">
          ${averageRPM.toFixed(2)}
        </span>
      )
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'in_transit': return 'bg-blue-100 text-blue-800'
      case 'assigned': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateRPM = (rate: number, miles: number) => {
    return miles > 0 ? (rate / miles).toFixed(2) : '0.00'
  }

  // Calculate totals for the floating row
  const totals = useMemo(() => {
    const totalLoads = loads.length
    const totalRate = loads.reduce((sum, load) => sum + Number(load.rate || 0), 0)
    const totalMiles = loads.reduce((sum, load) => sum + Number(load.miles || 0), 0)
    const averageRPM = totalMiles > 0 ? totalRate / totalMiles : 0

    return {
      totalLoads,
      totalRate,
      totalMiles,
      averageRPM
    }
  }, [loads])

  const columns: Column<LoadData>[] = [
    {
      key: 'pickup_date',
      label: 'Date',
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    {
      key: 'load_number',
      label: 'Load #',
      width: '120px',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'driver_id',
      label: 'Driver',
      width: '150px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center text-sm">
          <User className="h-3 w-3 mr-1 text-gray-400" />
          {value ? (driverMap[value] || `Driver #${value}`) : 'Unassigned'}
        </div>
      )
    },
    {
      key: 'customer_id',
      label: 'Customer',
      width: '200px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">{customerMap[value] || `Customer #${value}` || 'N/A'}</div>
        </div>
      )
    },
    {
      key: 'pickup_location',
      label: 'Pickup',
      width: '180px',
      filterable: true,
      groupable: true,
      render: (value, row) => {
        // Fallback: parse description if pickup_location doesn't exist
        let pickupLocation = value
        if (!pickupLocation && row.description) {
          const parts = row.description.split(' to ')
          pickupLocation = parts[0] || 'N/A'
        }
        // Format: Capitalize city, uppercase state
        const formatLocation = (loc: string) => {
          if (!loc || loc === 'N/A') return loc
          const parts = loc.split(',').map(p => p.trim())
          if (parts.length === 2) {
            const city = parts[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            const state = parts[1].toUpperCase()
            return `${city}, ${state}`
          }
          return loc
        }
        const formatted = formatLocation(pickupLocation)

        // Format time
        const formatTime = (dateTime: string) => {
          const date = new Date(dateTime)
          const hours = date.getHours()
          const minutes = date.getMinutes()
          const ampm = hours >= 12 ? 'PM' : 'AM'
          const displayHour = hours % 12 || 12
          return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
        }

        return (
          <div className="space-y-0.5">
            <div className="text-gray-900">{formatted}</div>
            <div className="text-xs text-gray-500">
              {row.pickup_date ? (
                <>
                  {new Date(row.pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' • '}
                  {formatTime(row.pickup_date)}
                </>
              ) : 'No date'}
            </div>
          </div>
        )
      }
    },
    {
      key: 'delivery_location',
      label: 'Delivery',
      width: '180px',
      filterable: true,
      groupable: true,
      render: (value, row) => {
        // Fallback: parse description if delivery_location doesn't exist
        let deliveryLocation = value
        if (!deliveryLocation && row.description) {
          const parts = row.description.split(' to ')
          deliveryLocation = parts[1] || 'N/A'
        }
        // Format: Capitalize city, uppercase state
        const formatLocation = (loc: string) => {
          if (!loc || loc === 'N/A') return loc
          const parts = loc.split(',').map(p => p.trim())
          if (parts.length === 2) {
            const city = parts[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            const state = parts[1].toUpperCase()
            return `${city}, ${state}`
          }
          return loc
        }
        const formatted = formatLocation(deliveryLocation)

        // Format time
        const formatTime = (dateTime: string) => {
          const date = new Date(dateTime)
          const hours = date.getHours()
          const minutes = date.getMinutes()
          const ampm = hours >= 12 ? 'PM' : 'AM'
          const displayHour = hours % 12 || 12
          return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
        }

        return (
          <div className="space-y-0.5">
            <div className="text-gray-900">{formatted}</div>
            <div className="text-xs text-gray-500">
              {row.delivery_date ? (
                <>
                  {new Date(row.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' • '}
                  {formatTime(row.delivery_date)}
                </>
              ) : 'No date'}
            </div>
          </div>
        )
      }
    },
    {
      key: 'notes',
      label: 'Notes',
      width: '200px',
      render: (value, row) => (
        <div className="text-sm text-gray-600 truncate">
          {row.notes || '-'}
        </div>
      )
    },
    {
      key: 'rate',
      label: 'Rate',
      width: '120px',
      render: (value) => (
        <div className="font-medium text-gray-900">
          ${value ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </div>
      )
    },
    {
      key: 'miles',
      label: 'Miles',
      width: '100px',
      render: (value) => (
        <div className="text-gray-900">
          {value ? Number(value).toLocaleString() : '0'}
        </div>
      )
    },
    {
      key: 'rpm',
      label: 'RPM',
      width: '100px',
      render: (value, row) => {
        const miles = row.miles || 0
        const rate = row.rate || 0
        const rpm = miles > 0 ? rate / miles : 0
        return (
          <div className="text-gray-900">
            ${rpm.toFixed(2)}
          </div>
        )
      }
    },
    {
      key: 'ratecon',
      label: 'Ratecon',
      width: '120px',
      render: (value, row) => {
        const docCount = row.id ? loadDocuments[row.id]?.ratecon.length || 0 : 0
        return (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation()
                handleManageDocuments(row)
              }}
            >
              {docCount > 0 ? (
                <div className="flex items-center text-green-600">
                  <FileText className="h-4 w-4 mr-1" />
                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {docCount}
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-gray-400 hover:text-blue-600">
                  <Upload className="h-4 w-4 mr-1" />
                  <span className="text-xs">Add</span>
                </div>
              )}
            </Button>
          </div>
        )
      }
    },
    {
      key: 'pod',
      label: 'POD',
      width: '120px',
      render: (value, row) => {
        const docCount = row.id ? loadDocuments[row.id]?.pod.length || 0 : 0
        return (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation()
                handleManageDocuments(row)
              }}
            >
              {docCount > 0 ? (
                <div className="flex items-center text-green-600">
                  <Package className="h-4 w-4 mr-1" />
                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {docCount}
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-gray-400 hover:text-blue-600">
                  <Upload className="h-4 w-4 mr-1" />
                  <span className="text-xs">Add</span>
                </div>
              )}
            </Button>
          </div>
        )
      }
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      filterable: true,
      groupable: true,
      getGroupValue: (row) => row.status.replace('_', ' '),
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value.replace('_', ' ')}
        </span>
      )
    },
  ]

  return (
    <Layout>
      <div className="page-loads space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Loads</h1>
            <p className="text-gray-600">Manage your shipments and deliveries</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateLoad}>
            <Plus className="mr-2 h-4 w-4" />
            New Load
          </Button>
        </div>

        <DataTable
          data={loads}
          columns={columns}
          onRowClick={handleRowClick}
          onRowRightClick={handleRowRightClick}
          calculateGroupTotals={calculateGroupTotals}
        />

        <LoadModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveLoad}
          load={editingLoad}
          mode={modalMode}
        />

        {documentLoad && (
          <DocumentModal
            isOpen={isDocumentModalOpen}
            onClose={closeDocumentModal}
            loadNumber={documentLoad.load_number}
            documents={documentLoad.id ? loadDocuments[documentLoad.id] || { ratecon: [], pod: [] } : { ratecon: [], pod: [] }}
            onDocumentsChange={(documents) => handleDocumentsChange(documentLoad.id!, documents)}
          />
        )}

        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isVisible={contextMenu.isVisible}
          onClose={closeContextMenu}
        >
          <ContextMenuItem
            onClick={handleContextEdit}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit Load
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => contextMenu.row && handleManageDocuments(contextMenu.row)}
            icon={<FolderOpen className="h-4 w-4" />}
            className="text-blue-600 hover:bg-blue-50"
          >
            Manage Documents
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Load
          </ContextMenuItem>
        </ContextMenu>

        {/* Floating Totals Row - Aligned with table columns */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody>
                <tr className="bg-gray-50">
                  {/* Date column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>

                  </td>
                  {/* Load # column - show total count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>
                    <span className="font-medium text-gray-900">
                      {totals.totalLoads} Load{totals.totalLoads !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* Driver column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '150px', minWidth: '150px' }}>

                  </td>
                  {/* Customer column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '200px', minWidth: '200px' }}>

                  </td>
                  {/* Pickup column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '180px', minWidth: '180px' }}>

                  </td>
                  {/* Delivery column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '180px', minWidth: '180px' }}>

                  </td>
                  {/* Rate column - show total rate */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>
                    <div className="font-medium text-green-700">
                      ${totals.totalRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                  {/* Miles column - show total miles */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '100px', minWidth: '100px' }}>
                    <span className="text-blue-700">{totals.totalMiles.toLocaleString()} mi</span>
                  </td>
                  {/* RPM column - show average RPM */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '100px', minWidth: '100px' }}>
                    <span className="text-purple-700">${totals.averageRPM.toFixed(2)}</span>
                  </td>
                  {/* Ratecon column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>

                  </td>
                  {/* POD column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>

                  </td>
                  {/* Status column - empty */}
                  <td className="px-3 py-2 text-sm" style={{ width: '130px', minWidth: '130px' }}>

                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}