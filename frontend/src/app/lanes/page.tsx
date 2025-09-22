'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { LaneModal, LaneData } from '@/components/lanes/lane-modal'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { Plus, Route, MapPin, Building, Mail, Phone, Edit, Trash2 } from 'lucide-react'

export default function LanesPage() {
  // State for managing lanes
  const [lanes, setLanes] = useState<LaneData[]>([
    {
      id: 1,
      pickup_location: "Los Angeles, CA",
      delivery_location: "Phoenix, AZ",
      broker: "Western Logistics LLC",
      email: "dispatch@westernlogistics.com",
      phone: "(555) 123-4567",
      notes: "Regular weekly runs"
    },
    {
      id: 2,
      pickup_location: "Dallas, TX",
      delivery_location: "Houston, TX",
      broker: "Texas Freight Solutions",
      email: "ops@texasfreight.com",
      phone: "(555) 234-5678",
      notes: "High volume lane"
    },
    {
      id: 3,
      pickup_location: "Chicago, IL",
      delivery_location: "Detroit, MI",
      broker: "Midwest Transport Co",
      email: "bookings@midwesttransport.com",
      phone: "(555) 345-6789",
      notes: "Auto parts specialist"
    },
    {
      id: 4,
      pickup_location: "Miami, FL",
      delivery_location: "Atlanta, GA",
      broker: "Southeast Shipping",
      email: "loads@southeastshipping.com",
      phone: "(555) 456-7890",
      notes: ""
    },
    {
      id: 5,
      pickup_location: "Seattle, WA",
      delivery_location: "Portland, OR",
      broker: "Pacific Coast Freight",
      email: "dispatch@pacificcoast.com",
      phone: "(555) 567-8901",
      notes: "Pacific Northwest specialist"
    },
    {
      id: 6,
      pickup_location: "New York, NY",
      delivery_location: "Boston, MA",
      broker: "Northeast Logistics",
      email: "operations@northeastlog.com",
      phone: "(555) 678-9012",
      notes: "Express lanes"
    }
  ])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLane, setEditingLane] = useState<LaneData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: LaneData | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // CRUD operations
  const handleCreateLane = () => {
    setEditingLane(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditLane = (lane: LaneData) => {
    setEditingLane(lane)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteLane = (laneId: number) => {
    if (confirm('Are you sure you want to delete this lane?')) {
      setLanes(lanes.filter(lane => lane.id !== laneId))
    }
  }

  const handleSaveLane = (laneData: LaneData) => {
    if (modalMode === 'create') {
      const newLane = {
        ...laneData,
        id: Math.max(...lanes.map(l => l.id || 0)) + 1
      }
      setLanes([...lanes, newLane])
    } else {
      setLanes(lanes.map(lane => lane.id === editingLane?.id ? { ...laneData, id: editingLane.id } : lane))
    }
  }

  // Context menu handlers
  const handleRowRightClick = (row: LaneData, event: React.MouseEvent) => {
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
      handleEditLane(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeleteLane(contextMenu.row.id!)
    }
    closeContextMenu()
  }

  // Calculate group totals for display in group headers
  const calculateGroupTotals = (rows: LaneData[]) => {
    return {
      'pickup_location': (
        <span className="text-sm font-medium text-gray-900">
          {rows.length} lane{rows.length !== 1 ? 's' : ''}
        </span>
      )
    }
  }

  // Calculate totals for the floating row
  const totals = useMemo(() => {
    const totalLanes = lanes.length
    const totalBrokers = new Set(lanes.map(lane => lane.broker)).size

    return {
      totalLanes,
      totalBrokers
    }
  }, [lanes])

  const columns: Column<LaneData>[] = [
    {
      key: 'pickup_location',
      label: 'Pickup Location',
      width: '200px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center">
          <MapPin className="h-4 w-4 text-green-600 mr-2" />
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'delivery_location',
      label: 'Delivery Location',
      width: '200px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center">
          <MapPin className="h-4 w-4 text-red-600 mr-2" />
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'broker',
      label: 'Broker',
      width: '180px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <div className="flex items-center">
          <Building className="h-4 w-4 text-blue-600 mr-2" />
          <span className="text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      width: '220px',
      filterable: true,
      render: (value) => (
        <div className="flex items-center">
          <Mail className="h-4 w-4 text-purple-600 mr-2" />
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:text-blue-800 hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {value}
          </a>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '150px',
      filterable: true,
      render: (value) => (
        <div className="flex items-center">
          <Phone className="h-4 w-4 text-orange-600 mr-2" />
          <a
            href={`tel:${value}`}
            className="text-blue-600 hover:text-blue-800 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {value}
          </a>
        </div>
      )
    },
    {
      key: 'notes',
      label: 'Notes',
      width: '180px',
      filterable: true,
      render: (value) => (
        <span className="text-gray-600 text-sm truncate">{value || '-'}</span>
      )
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Lanes</h1>
            <p className="text-gray-600">Manage your freight lanes and broker relationships</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateLane}>
            <Plus className="mr-2 h-4 w-4" />
            New Lane
          </Button>
        </div>

        <DataTable
          data={lanes}
          columns={columns}
          onRowRightClick={handleRowRightClick}
          calculateGroupTotals={calculateGroupTotals}
        />

        <LaneModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveLane}
          lane={editingLane}
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
            Edit Lane
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Lane
          </ContextMenuItem>
        </ContextMenu>

        {/* Floating Totals Row - Aligned with table columns */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody>
                <tr className="bg-gray-50">
                  {/* Pickup Location column - show total count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '200px', minWidth: '200px' }}>
                    <span className="font-medium text-gray-900">
                      {totals.totalLanes} Lane{totals.totalLanes !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* Delivery Location column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '200px', minWidth: '200px' }}>
                  </td>
                  {/* Broker column - show total brokers */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '180px', minWidth: '180px' }}>
                    <span className="font-medium text-blue-700">
                      {totals.totalBrokers} Broker{totals.totalBrokers !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* Email column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '220px', minWidth: '220px' }}>
                  </td>
                  {/* Phone column - empty */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '150px', minWidth: '150px' }}>
                  </td>
                  {/* Notes column - empty */}
                  <td className="px-3 py-2 text-sm" style={{ width: '180px', minWidth: '180px' }}>
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