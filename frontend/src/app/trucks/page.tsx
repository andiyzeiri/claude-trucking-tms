'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { TruckModal, TruckData } from '@/components/trucks/truck-modal'
import { Plus, Truck as TruckIcon, Edit, Trash2, FileText } from 'lucide-react'
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
  const [trucks, setTrucks] = useState<any[]>([])

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

  // Separate trucks and trailers
  const { trucksOnly, trailersOnly } = useMemo(() => {
    return {
      trucksOnly: trucks.filter(t => t.type === 'truck'),
      trailersOnly: trucks.filter(t => t.type === 'trailer')
    }
  }, [trucks])

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
      type: truckData.type,
      truck_number: truckData.unit_number,
      make: truckData.make,
      model: truckData.model,
      year: truckData.year,
      vin: truckData.vin,
      status: truckData.status,
      value: truckData.value || 0,
      miles: truckData.miles || 0,
      mpg: truckData.mpg || 0
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


  const renderEquipmentRow = (item: any, index: number) => {
    return (
      <tr
        key={item.id}
        className="border-b transition-colors cursor-pointer"
        style={{
          borderColor: 'var(--monday-border-light)',
          backgroundColor: 'var(--monday-bg-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)'
        }}
        onClick={() => handleEditTruck(item)}
        onContextMenu={(e) => handleRowRightClick(item, e)}
      >
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="font-medium" style={{ fontSize: '13px', color: 'var(--monday-cornflower)' }}>{item.truck_number}</span>
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.year || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.make || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.model || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--monday-text-secondary)' }}>{item.vin || 'N/A'}</span>
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          ${item.value ? Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.miles ? Number(item.miles).toLocaleString() : '0'}
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.mpg ? Number(item.mpg).toFixed(1) : '0.0'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            style={{ color: 'var(--monday-stuck)' }}
            onClick={(e) => {
              e.stopPropagation()
              alert('Registration PDF viewer coming soon')
            }}
          >
            <FileText className="h-4 w-4 mr-1" />
            <span className="text-xs">View PDF</span>
          </Button>
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.inspection ? new Date(item.inspection).toLocaleDateString() : 'N/A'}
        </td>
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{
            backgroundColor: item.status === 'available' ? 'rgba(0, 200, 117, 0.15)' :
              item.status === 'in_use' ? 'rgba(97, 97, 255, 0.15)' :
              item.status === 'maintenance' ? 'rgba(253, 171, 61, 0.15)' :
              'rgba(226, 68, 92, 0.15)',
            color: item.status === 'available' ? 'var(--monday-done)' :
              item.status === 'in_use' ? 'var(--monday-cornflower)' :
              item.status === 'maintenance' ? 'var(--monday-working)' :
              'var(--monday-stuck)'
          }}>
            {item.status}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="page-trucks space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Equipment</h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>Manage your fleet equipment and vehicles</p>
          </div>
          <Button className="hover:opacity-90" style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }} onClick={handleCreateTruck}>
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Unit #</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Year</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Make</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Model</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>VIN</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Value</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Miles</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>MPG</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Registration</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Inspection</th>
                <th className="px-3 py-2.5 text-left border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Trucks Section Header */}
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <td colSpan={11} className="px-3 py-2 font-semibold" style={{ fontSize: '14px', color: 'var(--monday-text-primary)', borderBottom: '1px solid var(--monday-border-light)' }}>
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4" style={{ color: 'var(--monday-cornflower)' }} />
                    Trucks ({trucksOnly.length})
                  </div>
                </td>
              </tr>

              {/* Truck Rows */}
              {trucksOnly.map((truck, index) => renderEquipmentRow(truck, index))}

              {trucksOnly.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                    No trucks added yet
                  </td>
                </tr>
              )}

              {/* Trailers Section Header */}
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <td colSpan={11} className="px-3 py-2 font-semibold" style={{ fontSize: '14px', color: 'var(--monday-text-primary)', borderBottom: '1px solid var(--monday-border-light)' }}>
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4" style={{ color: 'var(--monday-purple)' }} />
                    Trailers ({trailersOnly.length})
                  </div>
                </td>
              </tr>

              {/* Trailer Rows */}
              {trailersOnly.map((trailer, index) => renderEquipmentRow(trailer, index))}

              {trailersOnly.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                    No trailers added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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