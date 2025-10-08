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
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '40%' }}>
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '60%' }}>
                    Customers & Loads
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {laneGroups.map((group) => (
                  <React.Fragment key={group.route}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleLaneExpansion(group.route)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {group.isExpanded ? (
                            <ChevronDown className="h-4 w-4 mr-2 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{group.route}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          {group.customers.size > 0 ? (
                            <span className="text-sm text-blue-600 font-medium">
                              {group.customers.size} customer{group.customers.size !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              No customers
                            </span>
                          )}
                          {group.loads.length > 0 && (
                            <span className="text-sm text-green-600 font-medium">
                              {group.loads.length} load{group.loads.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {group.isExpanded && (
                      <>
                        {/* Customers section */}
                        {group.customers.size > 0 && (
                          <>
                            <tr className="bg-blue-50">
                              <td colSpan={2} className="px-4 py-2 pl-8">
                                <div className="text-xs font-semibold text-blue-700 uppercase">Customers</div>
                              </td>
                            </tr>
                            {Array.from(group.customers).map((customerName, index) => (
                              <tr
                                key={index}
                                className="bg-gray-50 hover:bg-gray-100"
                              >
                                <td className="px-4 py-2 pl-12">
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-900">{customerName}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-2"></td>
                              </tr>
                            ))}
                          </>
                        )}

                        {/* Loads section */}
                        {group.loads.length > 0 && (
                          <>
                            <tr className="bg-green-50">
                              <td colSpan={2} className="px-4 py-2 pl-8">
                                <div className="text-xs font-semibold text-green-700 uppercase">Recent Loads</div>
                              </td>
                            </tr>
                            {group.loads.slice(0, 5).map((load) => (
                              <tr key={load.id} className="bg-gray-50 hover:bg-gray-100" style={{ fontSize: '9px' }}>
                                <td className="px-2 py-1 pl-12">
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {load.load_number}
                                    </div>
                                    <div className="text-gray-500" style={{ fontSize: '8px' }}>
                                      {new Date(load.pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="text-gray-600">
                                    ${load.rate.toLocaleString()} • {load.miles} mi
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {group.loads.length > 5 && (
                              <tr className="bg-gray-50">
                                <td colSpan={2} className="px-4 py-2 pl-12">
                                  <div className="text-xs text-gray-500">
                                    + {group.loads.length - 5} more load{group.loads.length - 5 !== 1 ? 's' : ''}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Totals Row */}
        {laneGroups.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
            <div style={{ minWidth: '1400px', width: '100%' }}>
              <table className="w-full table-auto">
                <tbody>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '40%' }}>
                      <span className="font-medium text-gray-900">
                        {totals.totalLanes} Route{totals.totalLanes !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm" style={{ width: '60%' }}>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-blue-700">
                          {totals.totalCustomers} Customer{totals.totalCustomers !== 1 ? 's' : ''}
                        </span>
                        <span className="font-medium text-green-700">
                          {totals.totalLoads} Load{totals.totalLoads !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
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
