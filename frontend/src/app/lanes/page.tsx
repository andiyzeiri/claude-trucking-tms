'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { Plus, Edit, Trash2, MapPin, ChevronDown, ChevronRight } from 'lucide-react'
import { useLanes, useDeleteLane } from '@/hooks/use-lanes'
import { useLoads } from '@/hooks/use-loads'
import { useCustomers } from '@/hooks/use-customers'

interface LaneGroup {
  route: string
  pickup_location: string
  delivery_location: string
  brokers: any[]
  loads: any[]
  customers: Set<string>
  isExpanded: boolean
}

export default function LanesPage() {
  // Fetch real lanes data from API
  const { data, isLoading, error } = useLanes(1, 100)
  const lanes = data?.items || []
  const deleteLane = useDeleteLane()

  // Fetch loads to show matching trips
  const { data: loadsData } = useLoads(1, 100)
  const loads = loadsData?.items || []

  // Fetch customers to display names instead of IDs
  const { data: customersData } = useCustomers()
  const customers = customersData?.items || []
  const customerMap = useMemo(() => {
    const map: Record<number, string> = {}
    customers.forEach(c => {
      map[c.id] = c.name
    })
    return map
  }, [customers])

  // Expanded lanes state
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set())

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof lanes[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // Group lanes by pickup → delivery route
  const laneGroups = useMemo(() => {
    const groups: { [key: string]: LaneGroup } = {}

    console.log('Lanes data:', lanes)
    console.log('Loads data:', loads)

    // First, create groups from defined lanes
    lanes.forEach(lane => {
      const routeKey = `${lane.pickup_location} → ${lane.delivery_location}`

      if (!groups[routeKey]) {
        groups[routeKey] = {
          route: routeKey,
          pickup_location: lane.pickup_location,
          delivery_location: lane.delivery_location,
          brokers: [],
          loads: [],
          customers: new Set<string>(),
          isExpanded: expandedLanes.has(routeKey)
        }
      }

      groups[routeKey].brokers.push(lane)
    })

    // Function to format location: Capitalize city, uppercase state
    const formatLocation = (loc: string) => {
      if (!loc) return loc
      const parts = loc.split(',').map(p => p.trim())
      if (parts.length === 2) {
        const city = parts[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        const state = parts[1].toUpperCase()
        return `${city}, ${state}`
      }
      return loc
    }

    // Then, add loads and create groups for routes that don't have lanes yet
    loads.forEach(load => {
      console.log('Processing load:', load.id, 'pickup:', load.pickup_location, 'delivery:', load.delivery_location, 'description:', load.description)

      let loadPickup = load.pickup_location
      let loadDelivery = load.delivery_location

      // Fallback: parse from description if pickup/delivery not set
      if ((!loadPickup || !loadDelivery) && load.description) {
        const parts = load.description.split(' to ')
        if (parts.length === 2) {
          loadPickup = loadPickup || parts[0].trim()
          loadDelivery = loadDelivery || parts[1].trim()
          console.log('Parsed from description - pickup:', loadPickup, 'delivery:', loadDelivery)
        }
      }

      if (!loadPickup || !loadDelivery) {
        console.log('Skipping load', load.id, '- missing pickup or delivery location')
        return
      }

      // Format locations with proper capitalization
      loadPickup = formatLocation(loadPickup.trim())
      loadDelivery = formatLocation(loadDelivery.trim())
      const routeKey = `${loadPickup} → ${loadDelivery}`

      console.log('Creating/updating route:', routeKey)

      // Create group if it doesn't exist
      if (!groups[routeKey]) {
        groups[routeKey] = {
          route: routeKey,
          pickup_location: loadPickup,
          delivery_location: loadDelivery,
          brokers: [],
          loads: [],
          customers: new Set<string>(),
          isExpanded: expandedLanes.has(routeKey)
        }
      }

      // Add load to the group
      groups[routeKey].loads.push(load)

      // Add customer to the set
      if (load.customer_id && customerMap[load.customer_id]) {
        groups[routeKey].customers.add(customerMap[load.customer_id])
      }
    })

    console.log('Final lane groups:', groups)
    return Object.values(groups).sort((a, b) => a.route.localeCompare(b.route))
  }, [lanes, loads, expandedLanes])

  // Toggle lane expansion
  const toggleLaneExpansion = (routeKey: string) => {
    const newExpanded = new Set(expandedLanes)
    if (newExpanded.has(routeKey)) {
      newExpanded.delete(routeKey)
    } else {
      newExpanded.add(routeKey)
    }
    setExpandedLanes(newExpanded)
  }

  // Context menu handlers
  const handleBrokerRightClick = (broker: typeof lanes[0], event: React.MouseEvent) => {
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

  const handleContextDelete = () => {
    if (contextMenu.row && confirm('Delete lane broker?')) {
      deleteLane.mutate(contextMenu.row.id)
    }
    closeContextMenu()
  }

  // Calculate totals
  const totals = useMemo(() => {
    const totalLanes = laneGroups.length
    const allCustomers = new Set<string>()
    laneGroups.forEach(group => {
      group.customers.forEach(customer => allCustomers.add(customer))
    })
    const totalCustomers = allCustomers.size
    const totalLoads = laneGroups.reduce((sum, group) => sum + group.loads.length, 0)

    return {
      totalLanes,
      totalCustomers,
      totalLoads
    }
  }, [laneGroups])

  if (isLoading) {
    return (
      <Layout>
        <div className="page-lanes space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Lanes</h1>
              <p className="text-gray-600">Manage your freight lanes and broker relationships</p>
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">Loading lanes data...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-lanes space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Lanes</h1>
            <p className="text-gray-600">Manage your freight lanes and broker relationships</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 opacity-50 cursor-not-allowed" disabled>
            <Plus className="mr-2 h-4 w-4" />
            New Lane
          </Button>
        </div>

        {laneGroups.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Lanes</h2>
              <p className="text-gray-600">No lane data available yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {laneGroups.map((group) => (
              <div key={group.route} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {/* Route Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleLaneExpansion(group.route)}
                >
                  <div className="flex items-center gap-3">
                    {group.isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold text-gray-900">{group.route}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {group.customers.size > 0 && (
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {group.customers.size} customer{group.customers.size !== 1 ? 's' : ''}
                      </span>
                    )}
                    {group.loads.length > 0 && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        {group.loads.length} load{group.loads.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {group.isExpanded && (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Customers Box */}
                      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Customers</h4>
                        </div>
                        {group.customers.size > 0 ? (
                          <div className="space-y-2">
                            {Array.from(group.customers).map((customerName, index) => (
                              <div
                                key={index}
                                className="bg-white rounded-md px-3 py-2 text-sm font-medium text-gray-800 border border-blue-100"
                              >
                                {customerName}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-blue-600 italic">No customers yet</p>
                        )}
                      </div>

                      {/* Loads Box */}
                      <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Recent Loads</h4>
                        </div>
                        {group.loads.length > 0 ? (
                          <div className="space-y-2">
                            {group.loads.slice(0, 5).map((load) => (
                              <div
                                key={load.id}
                                className="bg-white rounded-md px-3 py-2 border border-green-100 flex justify-between items-center"
                              >
                                <div>
                                  <div className="text-sm font-medium text-gray-800">{load.load_number}</div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(load.pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-green-700">${load.rate?.toLocaleString() || '0'}</div>
                                  <div className="text-xs text-gray-500">{load.miles || 0} mi</div>
                                </div>
                              </div>
                            ))}
                            {group.loads.length > 5 && (
                              <div className="text-xs text-green-600 font-medium pt-1">
                                + {group.loads.length - 5} more load{group.loads.length - 5 !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-green-600 italic">No loads yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Cards */}
        {laneGroups.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totals.totalLanes}</div>
                  <div className="text-sm text-gray-500">Route{totals.totalLanes !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{totals.totalCustomers}</div>
                  <div className="text-sm text-gray-500">Customer{totals.totalCustomers !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{totals.totalLoads}</div>
                  <div className="text-sm text-gray-500">Load{totals.totalLoads !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isVisible={contextMenu.isVisible}
          onClose={closeContextMenu}
        >
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Broker
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}
