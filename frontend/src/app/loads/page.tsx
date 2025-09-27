'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { LoadModal, LoadData } from '@/components/loads/load-modal'
import { DocumentModal } from '@/components/loads/document-modal'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { Plus, Package, MapPin, DollarSign, FileText, CheckCircle, X, User, Edit, Trash2, Upload, FolderOpen } from 'lucide-react'

export default function LoadsPage() {
  // State for managing loads
  const [loads, setLoads] = useState<LoadData[]>([
    {
      id: 1,
      load_number: "TMS001",
      pickup_location: "Los Angeles, CA",
      delivery_location: "Phoenix, AZ",
      customer: { name: "ABC Logistics", mc: "MC-123456" },
      driver: "John Smith",
      status: "in_transit",
      rate: 2500.00,
      miles: 385,
      pickup_date: "2024-01-15",
      pickup_time: "08:00",
      delivery_date: "2024-01-17",
      delivery_time: "14:00",
      ratecon: true,
      pod: false
    },
    {
      id: 2,
      load_number: "TMS002",
      pickup_location: "Dallas, TX",
      delivery_location: "Houston, TX",
      customer: { name: "XYZ Shipping", mc: "MC-789012" },
      driver: "Jane Doe",
      status: "delivered",
      rate: 1200.00,
      miles: 240,
      pickup_date: "2024-01-14",
      pickup_time: "09:30",
      delivery_date: "2024-01-15",
      delivery_time: "16:30",
      ratecon: true,
      pod: true
    },
    {
      id: 3,
      load_number: "TMS003",
      pickup_location: "Chicago, IL",
      delivery_location: "Milwaukee, WI",
      customer: { name: "Global Transport", mc: "MC-345678" },
      driver: "Mike Johnson",
      status: "assigned",
      rate: 800.00,
      miles: 92,
      pickup_date: "2024-01-16",
      pickup_time: "07:00",
      delivery_date: "2024-01-17",
      delivery_time: "11:00",
      ratecon: true,
      pod: false
    },
  ])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLoad, setEditingLoad] = useState<LoadData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Document management state
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false)
  const [documentLoad, setDocumentLoad] = useState<LoadData | null>(null)
  const [loadDocuments, setLoadDocuments] = useState<Record<number, {
    ratecon: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
    pod: { id: string; name: string; size: number; type: string; url: string; uploadedAt: Date }[]
  }>>({
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
  })

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
    setEditingLoad(load)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteLoad = (loadId: number) => {
    if (confirm('Are you sure you want to delete this load?')) {
      setLoads(loads.filter(load => load.id !== loadId))
    }
  }

  const handleSaveLoad = (loadData: LoadData) => {
    if (modalMode === 'create') {
      const newLoad = {
        ...loadData,
        id: Math.max(...loads.map(l => l.id || 0)) + 1
      }
      setLoads([...loads, newLoad])
    } else {
      setLoads(loads.map(load => load.id === editingLoad?.id ? { ...loadData, id: editingLoad.id } : load))
    }
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

    // Update the loads state to reflect document status
    setLoads(prevLoads => prevLoads.map(load =>
      load.id === loadId ? {
        ...load,
        ratecon: documents.ratecon.length > 0,
        pod: documents.pod.length > 0
      } : load
    ))
  }

  const closeDocumentModal = () => {
    setIsDocumentModalOpen(false)
    setDocumentLoad(null)
  }

  // Calculate group totals for display in group headers
  const calculateGroupTotals = (rows: LoadData[]) => {
    const totalRate = rows.reduce((sum, row) => sum + row.rate, 0)
    const totalMiles = rows.reduce((sum, row) => sum + row.miles, 0)
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
    const totalRate = loads.reduce((sum, load) => sum + load.rate, 0)
    const totalMiles = loads.reduce((sum, load) => sum + load.miles, 0)
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
      key: 'driver',
      label: 'Driver',
      width: '150px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center text-sm">
          <User className="h-3 w-3 mr-1 text-gray-400" />
          {value}
        </div>
      )
    },
    {
      key: 'customer',
      label: 'Customer',
      width: '160px',
      filterable: true,
      groupable: true,
      getGroupValue: (row) => row.customer.name,
      render: (value) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">{value.name}</div>
          <div className="text-xs text-gray-500">{value.mc}</div>
        </div>
      )
    },
    {
      key: 'pickup_location',
      label: 'Pickup',
      width: '160px',
      filterable: true,
      groupable: true,
      render: (value, row) => (
        <div className="space-y-0.5">
          <div className="text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">
            {new Date(row.pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {formatTime(row.pickup_time)}
          </div>
        </div>
      )
    },
    {
      key: 'delivery_location',
      label: 'Delivery',
      width: '160px',
      filterable: true,
      groupable: true,
      render: (value, row) => (
        <div className="space-y-0.5">
          <div className="text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">
            {new Date(row.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {formatTime(row.delivery_time)}
          </div>
        </div>
      )
    },
    {
      key: 'rate',
      label: 'Rate',
      width: '120px',
      render: (value) => (
        <div className="font-medium text-gray-900">
          ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )
    },
    {
      key: 'miles',
      label: 'Miles',
      width: '100px',
      render: (value) => `${value.toLocaleString()} mi`
    },
    {
      key: 'rpm',
      label: 'RPM',
      width: '100px',
      render: (value, row) => `$${calculateRPM(row.rate, row.miles)}`
    },
    {
      key: 'ratecon',
      label: 'Ratecon',
      width: '120px',
      render: (value, row) => {
        const docCount = loadDocuments[row.id]?.ratecon.length || 0
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
        const docCount = loadDocuments[row.id]?.pod.length || 0
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
            documents={loadDocuments[documentLoad.id] || { ratecon: [], pod: [] }}
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
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '160px', minWidth: '160px' }}>

                  </td>
                  {/* Pickup column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '160px', minWidth: '160px' }}>

                  </td>
                  {/* Delivery column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '160px', minWidth: '160px' }}>

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
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '110px', minWidth: '110px' }}>

                  </td>
                  {/* POD column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '100px', minWidth: '100px' }}>

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