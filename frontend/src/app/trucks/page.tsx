'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { TruckModal, TruckData } from '@/components/trucks/truck-modal'
import { Plus, Truck, Edit, Trash2, FileText } from 'lucide-react'
import { useTrucks, useCreateTruck, useUpdateTruck } from '@/hooks/use-trucks'

// Helper functions for localStorage
const getTruckTypes = (): Record<number, 'truck' | 'trailer'> => {
  if (typeof window === 'undefined') return {}
  const stored = localStorage.getItem('truck-types')
  return stored ? JSON.parse(stored) : {}
}

const saveTruckType = (truckId: number, type: 'truck' | 'trailer') => {
  if (typeof window === 'undefined') return
  const types = getTruckTypes()
  types[truckId] = type
  localStorage.setItem('truck-types', JSON.stringify(types))
}

export default function TrucksPage() {
  // Fetch trucks from API
  const { data: trucksData, isLoading } = useTrucks()
  const rawTrucks = trucksData?.items || []
  const createTruck = useCreateTruck()
  const updateTruck = useUpdateTruck()

  // Merge truck data with localStorage types
  const [trucks, setTrucks] = useState([])

  useEffect(() => {
    if (rawTrucks.length > 0) {
      const truckTypes = getTruckTypes()
      const mergedTrucks = rawTrucks.map(truck => ({
        ...truck,
        type: truckTypes[truck.id] || 'truck'
      }))
      setTrucks(mergedTrucks)
    }
  }, [rawTrucks.length])

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
      type: truck.type || 'truck',
      unit_number: truck.truck_number || '',
      make: truck.make || '',
      model: truck.model || '',
      year: truck.year || new Date().getFullYear(),
      vin: truck.vin || '',
      value: 0,
      miles: 0,
      mpg: 0,
      registration: '',
      inspection: '',
      status: truck.status,
      driver: null
    }
    setEditingTruck(truckData)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteTruck = (truckId: number) => {
    if (confirm('Are you sure you want to delete this truck?')) {
      // TODO: Implement delete truck API call
      console.log('Delete truck:', truckId)
    }
  }

  const handleSaveTruck = (truckData: TruckData) => {
    const backendData = {
      truck_number: truckData.unit_number,
      make: truckData.make,
      model: truckData.model,
      year: truckData.year,
      vin: truckData.vin,
      status: truckData.status
    }

    if (modalMode === 'create') {
      createTruck.mutate(backendData as any, {
        onSuccess: (data) => {
          // Save the type to localStorage after truck is created
          saveTruckType(data.id, truckData.type)
        }
      })
    } else if (editingTruck?.id) {
      updateTruck.mutate({ id: editingTruck.id, data: backendData as any }, {
        onSuccess: () => {
          // Save the type to localStorage after truck is updated
          saveTruckType(editingTruck.id, truckData.type)
        }
      })
    }
    setIsModalOpen(false)
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
      render: (value) => <span className="text-gray-900 capitalize">{value || 'N/A'}</span>
    },
    {
      key: 'truck_number',
      label: 'Unit #',
      width: '120px',
      render: (value) => <span className="font-medium text-blue-600">{value}</span>
    },
    {
      key: 'year',
      label: 'Year',
      width: '100px',
      render: (value) => <span className="text-gray-900">{value || 'N/A'}</span>
    },
    {
      key: 'make',
      label: 'Make',
      width: '130px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="text-gray-900">{value || 'N/A'}</span>
    },
    {
      key: 'model',
      label: 'Model',
      width: '130px',
      filterable: true,
      render: (value) => <span className="text-gray-900">{value || 'N/A'}</span>
    },
    {
      key: 'vin',
      label: 'VIN',
      width: '160px',
      render: (value) => <span className="text-xs font-mono text-gray-700">{value || 'N/A'}</span>
    },
    {
      key: 'value',
      label: 'Value',
      width: '120px',
      render: (value) => <span className="text-gray-900">${value ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
    },
    {
      key: 'miles',
      label: 'Miles',
      width: '100px',
      render: (value) => <span className="text-gray-900">{value ? Number(value).toLocaleString() : '0'}</span>
    },
    {
      key: 'mpg',
      label: 'MPG',
      width: '100px',
      render: (value) => <span className="text-gray-900">{value ? Number(value).toFixed(1) : '0.0'}</span>
    },
    {
      key: 'registration',
      label: 'Registration',
      width: '130px',
      render: (value) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 hover:bg-blue-50"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Open PDF viewer
            alert('Registration PDF viewer coming soon')
          }}
        >
          <FileText className="h-4 w-4 mr-1 text-red-600" />
          <span className="text-xs">View PDF</span>
        </Button>
      )
    },
    {
      key: 'inspection',
      label: 'Inspection',
      width: '130px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A'
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
          value === 'in_use' ? 'bg-blue-100 text-blue-800' :
          value === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {value}
        </span>
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
          tableId="trucks-table"
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