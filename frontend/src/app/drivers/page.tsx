'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatDate } from '@/lib/utils'
import { DriverModal, DriverData } from '@/components/drivers/driver-modal'
import { Plus, Users, Phone, Mail, Edit, Trash2, User } from 'lucide-react'

export default function DriversPage() {
  // State for managing drivers
  const [drivers, setDrivers] = useState([
      {
        id: 1,
        name: "John Smith",
        license_number: "CDL123456",
        phone: "(555) 123-4567",
        email: "john.smith@example.com",
        status: "available",
        created_at: "2024-01-01T00:00:00Z"
      },
      {
        id: 2,
        name: "Jane Doe",
        license_number: "CDL654321",
        phone: "(555) 987-6543",
        email: "jane.doe@example.com",
        status: "on_trip",
        created_at: "2024-01-02T00:00:00Z"
      },
      {
        id: 3,
        name: "Mike Johnson",
        license_number: "CDL789012",
        phone: "(555) 555-0123",
        email: "mike.johnson@example.com",
        status: "available",
        created_at: "2024-01-03T00:00:00Z"
      }
  ])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<DriverData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof drivers[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'on_trip': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // CRUD operations
  const handleCreateDriver = () => {
    setEditingDriver(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditDriver = (driver: typeof drivers[0]) => {
    setEditingDriver(driver)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteDriver = (driverId: number) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      setDrivers(drivers.filter(driver => driver.id !== driverId))
    }
  }

  const handleSaveDriver = (driverData: DriverData) => {
    if (modalMode === 'create') {
      const newDriver = {
        ...driverData,
        id: Math.max(...drivers.map(d => d.id || 0)) + 1
      }
      setDrivers([...drivers, newDriver])
    } else {
      setDrivers(drivers.map(driver =>
        driver.id === editingDriver?.id ? { ...driverData, id: editingDriver.id } : driver
      ))
    }
  }

  // Context menu handlers
  const handleRowRightClick = (row: typeof drivers[0], event: React.MouseEvent) => {
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
      handleEditDriver(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeleteDriver(contextMenu.row.id)
    }
    closeContextMenu()
  }

  // Calculate group totals for display in group headers
  const calculateGroupTotals = (rows: typeof drivers[0][]) => {
    const totalDrivers = rows.length

    return {
      'name': (
        <span className="text-sm font-medium text-gray-900">
          {totalDrivers} driver{totalDrivers !== 1 ? 's' : ''}
        </span>
      )
    }
  }

  // Calculate totals for the floating row
  const totals = useMemo(() => {
    const totalDrivers = drivers.length
    const availableDrivers = drivers.filter(d => d.status === 'available').length
    const onTripDrivers = drivers.filter(d => d.status === 'on_trip').length

    return {
      totalDrivers,
      availableDrivers,
      onTripDrivers
    }
  }, [drivers])

  const columns: Column<typeof drivers[0]>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '150px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center text-sm">
          <User className="h-3 w-3 mr-1 text-gray-400" />
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'license_number',
      label: 'License Number',
      width: '140px',
      filterable: true
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '140px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="mr-1 h-3 w-3" />
          {value}
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      width: '180px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="mr-1 h-3 w-3" />
          {value}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '120px',
      render: (value) => formatDate(value)
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="mr-3 h-8 w-8" />
              Drivers
            </h1>
            <p className="text-gray-600">Manage your driver roster</p>
          </div>
          <Button onClick={handleCreateDriver}>
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </div>

        <DataTable
          data={drivers}
          columns={columns}
          onRowRightClick={handleRowRightClick}
          calculateGroupTotals={calculateGroupTotals}
        />

        {/* Floating Totals Row - Aligned with table columns */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody>
                <tr className="bg-gray-50">
                  {/* Name column - show total count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '150px', minWidth: '150px' }}>
                    <span className="font-medium text-gray-900">
                      {totals.totalDrivers} Driver{totals.totalDrivers !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* License column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px', minWidth: '140px' }}>

                  </td>
                  {/* Phone column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px', minWidth: '140px' }}>

                  </td>
                  {/* Email column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '180px', minWidth: '180px' }}>

                  </td>
                  {/* Status column - show available count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>
                    <span className="text-green-700">{totals.availableDrivers} Available</span>
                  </td>
                  {/* Created column - show on trip count */}
                  <td className="px-3 py-2 text-sm" style={{ width: '120px', minWidth: '120px' }}>
                    <span className="text-blue-700">{totals.onTripDrivers} On Trip</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <DriverModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveDriver}
          driver={editingDriver}
          mode={modalMode}
        />

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
            Edit Driver
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Driver
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}