'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { DriverModal, DriverData } from '@/components/drivers/driver-modal'
import { Plus, Users, Phone, Mail, Edit, Trash2 } from 'lucide-react'

export default function DriversPage() {
  // State for managing drivers
  const [drivers, setDrivers] = useState([
      {
        id: 1,
        name: "John Smith",
        date_hired: "2023-01-15",
        terminated: false,
        dob: "1985-03-20",
        phone: "(555) 123-4567",
        email: "john.smith@example.com",
        dl_number: "CDL123456",
        dl_expiration: "2025-06-15",
        file_status: "Complete",
        medical_card: "2024-12-20",
        mvr: "2024-10-15",
        drug_test: "2024-09-30",
        clearing_house: "Clear"
      },
      {
        id: 2,
        name: "Jane Doe",
        date_hired: "2023-03-10",
        terminated: false,
        dob: "1990-07-14",
        phone: "(555) 987-6543",
        email: "jane.doe@example.com",
        dl_number: "CDL654321",
        dl_expiration: "2024-11-20",
        file_status: "Incomplete",
        medical_card: "2024-08-10",
        mvr: "2024-11-01",
        drug_test: "2024-08-25",
        clearing_house: "Clear"
      },
      {
        id: 3,
        name: "Mike Johnson",
        date_hired: "2022-11-05",
        terminated: true,
        dob: "1988-12-03",
        phone: "(555) 555-0123",
        email: "mike.johnson@example.com",
        dl_number: "CDL789012",
        dl_expiration: "2025-04-10",
        file_status: "Complete",
        medical_card: "2024-06-15",
        mvr: "2024-05-20",
        drug_test: "2024-04-18",
        clearing_house: "Violation"
      },
      {
        id: 4,
        name: "Sarah Davis",
        date_hired: "2024-02-20",
        terminated: false,
        dob: "1992-09-25",
        phone: "(555) 234-5678",
        email: "sarah.davis@example.com",
        dl_number: "CDL345678",
        dl_expiration: "2026-01-30",
        file_status: "Complete",
        medical_card: "2025-03-15",
        mvr: "2024-11-10",
        drug_test: "2024-10-05",
        clearing_house: "Clear"
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


  const columns: Column<typeof drivers[0]>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '150px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'date_hired',
      label: 'Date Hired',
      width: '120px',
      render: (value, row) => {
        const hiredDate = new Date(value).toLocaleDateString()
        const isTerminated = row.terminated

        return (
          <span className={isTerminated ? 'text-red-600 font-medium' : 'text-gray-900'}>
            {hiredDate}
          </span>
        )
      }
    },
    {
      key: 'dob',
      label: 'DOB',
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'age',
      label: 'Age',
      width: '60px',
      render: (_, row) => {
        const today = new Date()
        const birthDate = new Date(row.dob)
        const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        return age.toString()
      }
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
      key: 'dl_number',
      label: 'DL',
      width: '120px',
      render: (value) => <span className="font-mono text-xs text-gray-700">{value}</span>
    },
    {
      key: 'dl_expiration',
      label: 'DL Expiration',
      width: '120px',
      render: (value) => {
        const expirationDate = new Date(value)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const isExpiringSoon = daysUntilExpiry <= 60

        return (
          <span className={isExpiringSoon ? 'text-red-600 font-medium' : 'text-gray-900'}>
            {expirationDate.toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'file_status',
      label: 'File',
      width: '100px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          value === 'Complete' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'medical_card',
      label: 'Medical Card',
      width: '120px',
      render: (value) => {
        const medicalDate = new Date(value)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((medicalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const isExpiringSoon = daysUntilExpiry <= 30

        return (
          <span className={isExpiringSoon ? 'text-red-600 font-medium' : 'text-gray-900'}>
            {medicalDate.toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'mvr',
      label: 'MVR',
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'drug_test',
      label: 'Pre-employment Drug Test',
      width: '180px',
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'clearing_house',
      label: 'Clearing House',
      width: '120px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          value === 'Clear' ? 'bg-green-100 text-green-800' :
          value === 'Violation' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value}
        </span>
      )
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