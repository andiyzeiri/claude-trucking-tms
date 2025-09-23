'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { LaneModal, LaneData } from '@/components/lanes/lane-modal'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { ExpandableLanesTable } from '@/components/lanes/expandable-lanes-table'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface LaneGroup {
  lane: string
  pickup_location: string
  delivery_location: string
  brokers: LaneData[]
  isExpanded: boolean
}

export default function LanesPage() {
  // State for managing lanes - restructured to have multiple brokers per route
  const [lanes, setLanes] = useState<LaneData[]>([
    // Los Angeles to Phoenix
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
      pickup_location: "Los Angeles, CA",
      delivery_location: "Phoenix, AZ",
      broker: "Southwest Transport Co",
      email: "ops@swtransport.com",
      phone: "(555) 987-6543",
      notes: "Premium service"
    },
    {
      id: 3,
      pickup_location: "Los Angeles, CA",
      delivery_location: "Phoenix, AZ",
      broker: "Desert Express Freight",
      email: "loads@desertexpress.com",
      phone: "(555) 456-7890",
      notes: "Fast delivery"
    },
    // Dallas to Houston
    {
      id: 4,
      pickup_location: "Dallas, TX",
      delivery_location: "Houston, TX",
      broker: "Texas Freight Solutions",
      email: "ops@texasfreight.com",
      phone: "(555) 234-5678",
      notes: "High volume lane"
    },
    {
      id: 5,
      pickup_location: "Dallas, TX",
      delivery_location: "Houston, TX",
      broker: "Lone Star Logistics",
      email: "dispatch@lonestarlog.com",
      phone: "(555) 345-6789",
      notes: "Energy sector specialist"
    },
    // Chicago to Detroit
    {
      id: 6,
      pickup_location: "Chicago, IL",
      delivery_location: "Detroit, MI",
      broker: "Midwest Transport Co",
      email: "bookings@midwesttransport.com",
      phone: "(555) 345-6789",
      notes: "Auto parts specialist"
    },
    {
      id: 7,
      pickup_location: "Chicago, IL",
      delivery_location: "Detroit, MI",
      broker: "Great Lakes Shipping",
      email: "info@greatlakesship.com",
      phone: "(555) 654-3210",
      notes: "Manufacturing focus"
    },
    // Miami to Atlanta
    {
      id: 8,
      pickup_location: "Miami, FL",
      delivery_location: "Atlanta, GA",
      broker: "Southeast Shipping",
      email: "loads@southeastshipping.com",
      phone: "(555) 456-7890",
      notes: "Perishable goods"
    },
    // New York to Boston
    {
      id: 9,
      pickup_location: "New York, NY",
      delivery_location: "Boston, MA",
      broker: "Northeast Logistics",
      email: "operations@northeastlog.com",
      phone: "(555) 678-9012",
      notes: "Express lanes"
    }
  ])

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Expanded lanes state
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set())

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

  // Group lanes by pickup → delivery route
  const laneGroups = useMemo(() => {
    const groups: { [key: string]: LaneGroup } = {}

    lanes
      .filter(lane => {
        if (!searchTerm) return true
        const searchLower = searchTerm.toLowerCase()
        return (
          lane.pickup_location.toLowerCase().includes(searchLower) ||
          lane.delivery_location.toLowerCase().includes(searchLower) ||
          lane.broker.toLowerCase().includes(searchLower) ||
          lane.email.toLowerCase().includes(searchLower) ||
          lane.phone.toLowerCase().includes(searchLower) ||
          (lane.notes && lane.notes.toLowerCase().includes(searchLower))
        )
      })
      .forEach(lane => {
        const routeKey = `${lane.pickup_location} → ${lane.delivery_location}`

        if (!groups[routeKey]) {
          groups[routeKey] = {
            lane: routeKey,
            pickup_location: lane.pickup_location,
            delivery_location: lane.delivery_location,
            brokers: [],
            isExpanded: expandedLanes.has(routeKey)
          }
        }

        groups[routeKey].brokers.push(lane)
      })

    return Object.values(groups).sort((a, b) => a.lane.localeCompare(b.lane))
  }, [lanes, searchTerm, expandedLanes])

  // Toggle lane expansion
  const toggleLaneExpansion = (laneKey: string) => {
    const newExpanded = new Set(expandedLanes)
    if (newExpanded.has(laneKey)) {
      newExpanded.delete(laneKey)
    } else {
      newExpanded.add(laneKey)
    }
    setExpandedLanes(newExpanded)
  }

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
    if (confirm('Are you sure you want to delete this broker from the lane?')) {
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
  const handleBrokerRightClick = (broker: LaneData, event: React.MouseEvent) => {
    event.stopPropagation()
    setContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row: broker
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

  // Calculate totals
  const totals = useMemo(() => {
    const totalLanes = laneGroups.length
    const totalBrokers = lanes.length

    return {
      totalLanes,
      totalBrokers
    }
  }, [laneGroups, lanes])

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

        <ExpandableLanesTable
          laneGroups={laneGroups}
          onToggleLane={toggleLaneExpansion}
          onBrokerRightClick={handleBrokerRightClick}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
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
            Edit Broker
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Broker
          </ContextMenuItem>
        </ContextMenu>

        {/* Floating Totals Row - Aligned with table columns */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody>
                <tr className="bg-gray-50">
                  {/* Route column - show total count */}
                  <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '60%' }}>
                    <span className="font-medium text-gray-900">
                      {totals.totalLanes} Route{totals.totalLanes !== 1 ? 's' : ''}
                    </span>
                  </td>
                  {/* Brokers column - show total brokers */}
                  <td className="px-3 py-2 text-sm" style={{ width: '40%' }}>
                    <span className="font-medium text-blue-700">
                      {totals.totalBrokers} Total Broker{totals.totalBrokers !== 1 ? 's' : ''}
                    </span>
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