'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { DriverModal, DriverData } from '@/components/drivers/driver-modal'
import { Plus, Users, Phone, Mail, Edit, Trash2, Check, Truck } from 'lucide-react'
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver } from '@/hooks/use-drivers'

type TabType = 'drivers' | 'owners'

export default function DriversPage() {
  // Fetch drivers from API
  const { data: driversData, isLoading } = useDrivers()
  const allDrivers = driversData?.items || []
  const createDriver = useCreateDriver()
  const updateDriver = useUpdateDriver()
  const deleteDriver = useDeleteDriver()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('drivers')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<DriverData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof allDrivers[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // Filter drivers by type
  const companyDrivers = useMemo(() =>
    allDrivers.filter(d => d.driver_type !== 'owner_operator'),
    [allDrivers]
  )
  const ownerOperators = useMemo(() =>
    allDrivers.filter(d => d.driver_type === 'owner_operator'),
    [allDrivers]
  )

  // Get current filtered list based on active tab
  const drivers = activeTab === 'drivers' ? companyDrivers : ownerOperators

  // CRUD operations
  const handleCreateDriver = () => {
    setEditingDriver(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditDriver = (driver: typeof allDrivers[0]) => {
    const driverData: DriverData = {
      id: driver.id,
      first_name: driver.first_name || '',
      last_name: driver.last_name || '',
      license_number: driver.license_number,
      phone: driver.phone || '',
      email: driver.email || '',
      status: driver.status,
      driver_type: driver.driver_type || 'company',
      date_hired: driver.date_hired || '',
      date_terminated: driver.date_terminated || '',
      date_of_birth: driver.date_of_birth || '',
      experience: driver.experience || '',
      mvr_expiry: driver.mvr_expiry || '',
      medical_card_expiry: driver.medical_card_expiry || '',
      has_fuel_card: driver.has_fuel_card || false,
      fuel_card_number: driver.fuel_card_number || ''
    }
    setEditingDriver(driverData)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteDriver = (driverId: number) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      deleteDriver.mutate(driverId)
    }
  }

  const handleSaveDriver = (driverData: DriverData) => {
    // Use the current tab to set driver_type for new drivers
    const driverType = modalMode === 'create'
      ? (activeTab === 'owners' ? 'owner_operator' : 'company')
      : (driverData.driver_type || 'company')

    const backendData = {
      first_name: driverData.first_name,
      last_name: driverData.last_name,
      license_number: driverData.license_number,
      phone: driverData.phone,
      email: driverData.email,
      status: driverData.status,
      driver_type: driverType,
      date_hired: driverData.date_hired || null,
      date_terminated: driverData.date_terminated || null,
      date_of_birth: driverData.date_of_birth || null,
      experience: driverData.experience || null,
      mvr_expiry: driverData.mvr_expiry || null,
      medical_card_expiry: driverData.medical_card_expiry || null,
      has_fuel_card: driverData.has_fuel_card || false,
      fuel_card_number: driverData.fuel_card_number || null
    }

    if (modalMode === 'create') {
      createDriver.mutate(backendData as any)
    } else if (editingDriver?.id) {
      updateDriver.mutate({ id: editingDriver.id, data: backendData as any })
    }
    setIsModalOpen(false)
  }

  // Context menu handlers
  const handleRowRightClick = (row: typeof allDrivers[0], event: React.MouseEvent) => {
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


  const columns: Column<typeof allDrivers[0]>[] = [
    {
      key: 'first_name',
      label: 'Name',
      width: '200px',
      filterable: true,
      groupable: true,
      render: (value, row) => {
        const firstName = row.first_name.charAt(0).toUpperCase() + row.first_name.slice(1).toLowerCase()
        const lastName = row.last_name.charAt(0).toUpperCase() + row.last_name.slice(1).toLowerCase()
        return <span className="font-medium" style={{ color: 'var(--monday-text-primary)' }}>{firstName} {lastName}</span>
      }
    },
    {
      key: 'license_number',
      label: 'License Number',
      width: '150px',
      render: (value) => <span className="font-mono text-xs" style={{ color: 'var(--monday-text-secondary)' }}>{value || 'N/A'}</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '150px',
      render: (value) => (
        <div className="flex items-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
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
        <div className="flex items-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{
          backgroundColor: value === 'available' ? 'rgba(0, 200, 117, 0.15)' :
            value === 'on_trip' ? 'rgba(97, 97, 255, 0.15)' :
            'rgba(196, 196, 196, 0.15)',
          color: value === 'available' ? 'var(--monday-done)' :
            value === 'on_trip' ? 'var(--monday-cornflower)' :
            'var(--monday-gray)'
        }}>
          {value}
        </span>
      )
    },
    {
      key: 'date_hired',
      label: 'Date Hired',
      width: '120px',
      render: (value) => <span style={{ color: 'var(--monday-text-primary)' }}>{value ? new Date(value).toLocaleDateString() : 'N/A'}</span>
    },
    {
      key: 'date_terminated',
      label: 'Date Terminated',
      width: '130px',
      filterable: true,
      render: (value, row) => {
        if (!value) {
          return <span className="text-green-600 font-medium">Active</span>
        }
        return (
          <span className="text-red-600 font-medium">
            {new Date(value).toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'date_of_birth',
      label: 'Date of Birth',
      width: '120px',
      render: (value) => <span style={{ color: 'var(--monday-text-primary)' }}>{value ? new Date(value).toLocaleDateString() : 'N/A'}</span>
    },
    {
      key: 'date_of_birth',
      label: 'Age',
      width: '80px',
      render: (value) => {
        if (!value) return <span style={{ color: 'var(--monday-text-muted)' }}>N/A</span>
        const birthDate = new Date(value)
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--
        }
        return <span style={{ color: 'var(--monday-text-primary)' }}>{age.toString()}</span>
      }
    },
    {
      key: 'experience',
      label: 'Experience',
      width: '120px',
      render: (value) => <span style={{ color: value ? 'var(--monday-text-primary)' : 'var(--monday-text-muted)' }}>{value || 'N/A'}</span>
    },
    {
      key: 'mvr_expiry',
      label: 'MVR',
      width: '120px',
      render: (value) => {
        if (!value) return <span style={{ color: 'var(--monday-text-muted)' }}>N/A</span>
        const expiryDate = new Date(value)
        const today = new Date()
        const isExpired = expiryDate < today
        return (
          <span className={isExpired ? 'font-semibold' : ''} style={{ color: isExpired ? 'var(--monday-stuck)' : 'var(--monday-text-primary)' }}>
            {expiryDate.toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'medical_card_expiry',
      label: 'Medical Card',
      width: '120px',
      render: (value) => {
        if (!value) return <span style={{ color: 'var(--monday-text-muted)' }}>N/A</span>
        const expiryDate = new Date(value)
        const today = new Date()
        const isExpired = expiryDate < today
        return (
          <span className={isExpired ? 'font-semibold' : ''} style={{ color: isExpired ? 'var(--monday-stuck)' : 'var(--monday-text-primary)' }}>
            {expiryDate.toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'has_fuel_card',
      label: 'Fuel Card',
      width: '150px',
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          {value ? (
            <>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                <Check className="h-3 w-3 text-green-600" />
              </span>
              <span className="text-sm font-mono" style={{ color: 'var(--monday-text-secondary)' }}>
                {row.fuel_card_number || '—'}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--monday-text-muted)' }}>No</span>
          )}
        </div>
      )
    }
  ]

  return (
    <Layout>
      <div className="page-drivers space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center" style={{ color: 'var(--monday-text-primary)' }}>
              <Users className="mr-3 h-8 w-8" style={{ color: 'var(--monday-blue)' }} />
              Drivers
            </h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>Manage your driver roster</p>
          </div>
          <Button className="hover:opacity-90" style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }} onClick={handleCreateDriver}>
            <Plus className="mr-2 h-4 w-4" />
            Add {activeTab === 'owners' ? 'Owner Operator' : 'Driver'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'drivers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Company Drivers
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'drivers' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {companyDrivers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('owners')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'owners'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Owner Operators
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'owners' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {ownerOperators.length}
              </span>
            </button>
          </nav>
        </div>

        <DataTable
          data={drivers}
          columns={columns}
          onRowRightClick={handleRowRightClick}
          tableId={`${activeTab}-table`}
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
            Edit {activeTab === 'owners' ? 'Owner' : 'Driver'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete {activeTab === 'owners' ? 'Owner' : 'Driver'}
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}
