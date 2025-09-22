'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { TruckModal, TruckData } from '@/components/trucks/truck-modal'
import { Plus, Truck, Wrench, CheckCircle, Edit, Trash2, User } from 'lucide-react'

export default function TrucksPage() {
  // State for managing trucks
  const [trucks, setTrucks] = useState([
    {
      id: 1,
      unit_number: "T001",
      make: "Freightliner",
      model: "Cascadia",
      year: 2022,
      status: "available",
      mileage: 125000,
      driver: "John Smith"
    },
    {
      id: 2,
      unit_number: "T002",
      make: "Peterbilt",
      model: "579",
      year: 2021,
      status: "in_use",
      mileage: 158000,
      driver: "Jane Doe"
    },
    {
      id: 3,
      unit_number: "T003",
      make: "Kenworth",
      model: "T680",
      year: 2023,
      status: "maintenance",
      mileage: 89000,
      driver: null
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'in_use': return 'bg-blue-100 text-blue-800'
      case 'maintenance': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return CheckCircle
      case 'in_use': return Truck
      case 'maintenance': return Wrench
      default: return Truck
    }
  }

  // CRUD operations
  const handleCreateTruck = () => {
    setEditingTruck(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditTruck = (truck: typeof trucks[0]) => {
    setEditingTruck(truck)
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
        ...truckData,
        id: Math.max(...trucks.map(t => t.id || 0)) + 1
      }
      setTrucks([...trucks, newTruck])
    } else {
      setTrucks(trucks.map(truck =>
        truck.id === editingTruck?.id ? { ...truckData, id: editingTruck.id } : truck
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

  // Calculate group totals for display in group headers
  const calculateGroupTotals = (rows: typeof trucks[0][]) => {
    const totalTrucks = rows.length
    const totalMileage = rows.reduce((sum, row) => sum + row.mileage, 0)
    const averageMileage = totalTrucks > 0 ? totalMileage / totalTrucks : 0

    return {
      'unit_number': (
        <span className="text-sm font-medium text-gray-900">
          {totalTrucks} truck{totalTrucks !== 1 ? 's' : ''}
        </span>
      ),
      'mileage': (
        <span className="text-sm font-medium text-blue-700">
          {totalMileage.toLocaleString()} mi total
        </span>
      ),
      'year': (
        <span className="text-sm font-medium text-purple-700">
          Avg: {Math.round(averageMileage).toLocaleString()} mi
        </span>
      )
    }
  }

  // Calculate totals for the floating row
  const totals = useMemo(() => {
    const totalTrucks = trucks.length
    const totalMileage = trucks.reduce((sum, truck) => sum + truck.mileage, 0)
    const averageMileage = totalTrucks > 0 ? totalMileage / totalTrucks : 0
    const availableTrucks = trucks.filter(t => t.status === 'available').length

    return {
      totalTrucks,
      totalMileage,
      averageMileage,
      availableTrucks
    }
  }, [trucks])

  const columns: Column<typeof trucks[0]>[] = [
    {
      key: 'unit_number',
      label: 'Unit #',
      width: '120px',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      filterable: true,
      groupable: true,
      render: (value) => {
        const StatusIcon = getStatusIcon(value)
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {value.replace('_', ' ')}
          </span>
        )
      }
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
      key: 'mileage',
      label: 'Mileage',
      width: '120px',
      render: (value) => `${value.toLocaleString()} mi`
    },
    {
      key: 'driver',
      label: 'Driver',
      width: '140px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center text-sm">
          <User className="h-3 w-3 mr-1 text-gray-400" />
          {value || 'Unassigned'}
        </div>
      )
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Trucks</h1>
            <p className="text-gray-600">Manage your fleet vehicles</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateTruck}>
            <Plus className="mr-2 h-4 w-4" />
            Add Truck
          </Button>
        </div>

        <DataTable
          data={trucks}
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
                  {/* Unit # column - show total count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>
                    <span className="font-medium text-gray-900">
                      {totals.totalTrucks} Truck{totals.totalTrucks !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* Status column - show available count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px', minWidth: '140px' }}>
                    <span className="font-medium text-green-700">
                      {totals.availableTrucks} Available
                    </span>
                  </td>
                  {/* Year column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '80px', minWidth: '80px' }}>

                  </td>
                  {/* Make column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>

                  </td>
                  {/* Model column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>

                  </td>
                  {/* Mileage column - show total mileage */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px', minWidth: '120px' }}>
                    <span className="text-blue-700">{totals.totalMileage.toLocaleString()} mi</span>
                  </td>
                  {/* Driver column - show average mileage */}
                  <td className="px-3 py-2 text-sm" style={{ width: '140px', minWidth: '140px' }}>
                    <span className="text-purple-700">Avg: {Math.round(totals.averageMileage).toLocaleString()} mi</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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