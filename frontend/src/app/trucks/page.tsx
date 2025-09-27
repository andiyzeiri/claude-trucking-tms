'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { TruckModal, TruckData } from '@/components/trucks/truck-modal'
import { Plus, Truck, Edit, Trash2 } from 'lucide-react'

export default function TrucksPage() {
  // State for managing equipment
  const [trucks, setTrucks] = useState([
    {
      id: 1,
      type: "Tractor",
      unit_number: "T001",
      year: 2022,
      make: "Freightliner",
      model: "Cascadia",
      vin: "1FUJGLDR5NLSP1234",
      miles: 125000,
      value: 85000,
      mpg: 7.2,
      registration: "2025-06-15",
      inspection: "2024-12-20",
      service_history: "Last service: Oil change 11/15/24"
    },
    {
      id: 2,
      type: "Tractor",
      unit_number: "T002",
      year: 2021,
      make: "Peterbilt",
      model: "579",
      vin: "1XP5DB9X1MD567890",
      miles: 158000,
      value: 78000,
      mpg: 6.8,
      registration: "2025-03-10",
      inspection: "2024-11-05",
      service_history: "Last service: PM Service 10/22/24"
    },
    {
      id: 3,
      type: "Trailer",
      unit_number: "TR001",
      year: 2023,
      make: "Great Dane",
      model: "Everest",
      vin: "1GRAA0621PF123456",
      miles: 85000,
      value: 45000,
      mpg: 0,
      registration: "2025-08-30",
      inspection: "2024-10-15",
      service_history: "Last service: Brake inspection 09/30/24"
    },
    {
      id: 4,
      type: "Tractor",
      unit_number: "T003",
      year: 2020,
      make: "Kenworth",
      model: "T680",
      vin: "1XKAD40X8LJ789123",
      miles: 285000,
      value: 65000,
      mpg: 6.5,
      registration: "2024-12-31",
      inspection: "2024-09-12",
      service_history: "Last service: Engine overhaul 08/15/24"
    },
  ])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTruck, setEditingTruck] = useState<TruckData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof trucks[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })


  // CRUD operations
  const handleCreateTruck = () => {
    setEditingTruck(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditTruck = (truck: typeof trucks[0]) => {
    const truckData: TruckData = {
      id: truck.id,
      unit_number: truck.unit_number,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      status: 'available',
      mileage: truck.miles,
      driver: null
    }
    setEditingTruck(truckData)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteTruck = (truckId: number) => {
    if (confirm('Are you sure you want to delete this truck?')) {
      setTrucks(trucks.filter(truck => truck.id !== truckId))
    }
  }

  const handleSaveTruck = (truckData: TruckData) => {
    if (modalMode === 'create') {
      const newTruck = {
        id: Math.max(...trucks.map(t => t.id || 0)) + 1,
        type: 'Semi-Truck',
        unit_number: truckData.unit_number,
        year: truckData.year,
        make: truckData.make,
        model: truckData.model,
        vin: `VIN${Date.now()}`,
        miles: truckData.mileage,
        value: 50000,
        mpg: 6.5,
        registration: new Date().toISOString().split('T')[0],
        inspection: new Date().toISOString().split('T')[0],
        service_history: 'Up to date'
      }
      setTrucks([...trucks, newTruck])
    } else {
      setTrucks(trucks.map(truck =>
        truck.id === editingTruck?.id ? {
          ...truck,
          unit_number: truckData.unit_number,
          make: truckData.make,
          model: truckData.model,
          year: truckData.year,
          miles: truckData.mileage
        } : truck
      ))
    }
  }

  // Context menu handlers
  const handleRowRightClick = (row: typeof trucks[0], event: React.MouseEvent) => {
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
      handleEditTruck(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeleteTruck(contextMenu.row.id)
    }
    closeContextMenu()
  }


  const columns: Column<typeof trucks[0]>[] = [
    {
      key: 'type',
      label: 'Type',
      width: '100px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'unit_number',
      label: 'Unit Number',
      width: '120px',
      render: (value) => <span className="font-medium text-blue-600">{value}</span>
    },
    {
      key: 'year',
      label: 'Year',
      width: '80px'
    },
    {
      key: 'make',
      label: 'Make',
      width: '120px',
      filterable: true,
      groupable: true
    },
    {
      key: 'model',
      label: 'Model',
      width: '120px',
      filterable: true
    },
    {
      key: 'vin',
      label: 'VIN',
      width: '180px',
      render: (value) => <span className="text-xs font-mono text-gray-700">{value}</span>
    },
    {
      key: 'miles',
      label: 'Miles',
      width: '100px',
      render: (value) => `${value.toLocaleString()}`
    },
    {
      key: 'value',
      label: 'Value',
      width: '100px',
      render: (value) => `$${value.toLocaleString()}`
    },
    {
      key: 'mpg',
      label: 'MPG',
      width: '80px',
      render: (value) => value === 0 ? 'N/A' : value.toString()
    },
    {
      key: 'registration',
      label: 'Registration',
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'inspection',
      label: 'Inspection',
      width: '120px',
      render: (value) => {
        const inspectionDate = new Date(value)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((inspectionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const isExpiringSoon = daysUntilExpiry <= 30

        return (
          <span className={isExpiringSoon ? 'text-red-600 font-medium' : 'text-gray-900'}>
            {inspectionDate.toLocaleDateString()}
          </span>
        )
      }
    },
    {
      key: 'service_history',
      label: 'Service History',
      width: '200px',
      render: (value) => (
        <div className="text-sm text-gray-600 truncate" title={value}>
          {value}
        </div>
      )
    }
  ]

  return (
    <Layout>
      <div className="page-trucks space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Equipment</h1>
            <p className="text-gray-600">Manage your fleet equipment and vehicles</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateTruck}>
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </div>

        <DataTable
          data={trucks}
          columns={columns}
          onRowRightClick={handleRowRightClick}
        />


        <TruckModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTruck}
          truck={editingTruck}
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
            Edit Truck
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Truck
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}