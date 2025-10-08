'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { DriverModal, DriverData } from '@/components/drivers/driver-modal'
import { Plus, Users, Phone, Mail, Edit, Trash2 } from 'lucide-react'
import { useDrivers, useCreateDriver, useUpdateDriver } from '@/hooks/use-drivers'

export default function DriversPage() {
  // Fetch drivers from API
  const { data: driversData, isLoading } = useDrivers()
  const drivers = driversData?.items || []
  const createDriver = useCreateDriver()
  const updateDriver = useUpdateDriver()

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


  // CRUD operations
  const handleCreateDriver = () => {
    setEditingDriver(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditDriver = (driver: typeof drivers[0]) => {
    const driverData: DriverData = {
      id: driver.id,
      first_name: driver.first_name || '',
      last_name: driver.last_name || '',
      license_number: driver.license_number,
      phone: driver.phone || '',
      email: driver.email || '',
      status: driver.status
    }
    setEditingDriver(driverData)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteDriver = (driverId: number) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      // TODO: Implement delete driver API call
      console.log('Delete driver:', driverId)
    }
  }

  const handleSaveDriver = (driverData: DriverData) => {
    const backendData = {
      first_name: driverData.first_name,
      last_name: driverData.last_name,
      license_number: driverData.license_number,
      phone: driverData.phone,
      email: driverData.email,
      status: driverData.status
    }

    if (modalMode === 'create') {
      createDriver.mutate(backendData as any)
    } else if (editingDriver?.id) {
      updateDriver.mutate({ id: editingDriver.id, data: backendData as any })
    }
    setIsModalOpen(false)
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


  const columns: Column<typeof drivers[0]>[] = [
    {
      key: 'first_name',
      label: 'Name',
      width: '200px',
      filterable: true,
      groupable: true,
      render: (value, row) => {
        const firstName = row.first_name.charAt(0).toUpperCase() + row.first_name.slice(1).toLowerCase()
        const lastName = row.last_name.charAt(0).toUpperCase() + row.last_name.slice(1).toLowerCase()
        return <span className="font-medium text-gray-900">{firstName} {lastName}</span>
      }
    },
    {
      key: 'license_number',
      label: 'License Number',
      width: '150px',
      render: (value) => <span className="font-mono text-xs text-gray-700">{value || 'N/A'}</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '150px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="mr-1 h-3 w-3" />
          {value || 'N/A'}
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      width: '200px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="mr-1 h-3 w-3" />
          {value || 'N/A'}
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          value === 'available' ? 'bg-green-100 text-green-800' :
          value === 'on_trip' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '150px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A'
    }
  ]

  return (
    <Layout>
      <div className="page-drivers space-y-6">
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
        />

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