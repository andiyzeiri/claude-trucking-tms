'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, Plus, User, Edit, Trash2, Phone, Mail, FileText, CheckCircle, X, Package, Users, Truck, Building2 } from 'lucide-react'
import StatisticsCards from '@/components/dashboard/StatisticsCards'

interface DriverData {
  id?: number
  name: string
  phone: string
  email: string
  license_number: string
  license_expiry: string
  status: 'active' | 'inactive' | 'on_leave'
  truck_assigned?: string
  hire_date: string
  type: 'company' | 'owner_operator'
  revenue: number
  profit: number
}

export default function DashboardPage() {
  // Static demo data
  const loads = {
    total: 5,
    items: [
      { id: 1, load_number: "TMS001", pickup_location: "Los Angeles, CA", status: "in_transit", rate: 2500.00 },
      { id: 2, load_number: "TMS002", pickup_location: "Dallas, TX", status: "delivered", rate: 1200.00 },
      { id: 3, load_number: "TMS003", pickup_location: "Chicago, IL", status: "assigned", rate: 800.00 }
    ]
  }

  // Company Drivers Data
  const [companyDrivers, setCompanyDrivers] = useState<DriverData[]>([
    {
      id: 1,
      name: "John Smith",
      phone: "(555) 123-4567",
      email: "john.smith@company.com",
      license_number: "DL12345678",
      license_expiry: "2025-06-15",
      status: "active",
      truck_assigned: "Truck #101",
      hire_date: "2023-01-15",
      type: "company",
      revenue: 25000.75,
      profit: 5000.25
    },
    {
      id: 2,
      name: "Jane Doe",
      phone: "(555) 234-5678",
      email: "jane.doe@company.com",
      license_number: "DL87654321",
      license_expiry: "2024-12-20",
      status: "active",
      truck_assigned: "Truck #102",
      hire_date: "2023-03-10",
      type: "company",
      revenue: 32000.50,
      profit: 7200.80
    },
    {
      id: 3,
      name: "Mike Johnson",
      phone: "(555) 345-6789",
      email: "mike.johnson@company.com",
      license_number: "DL11223344",
      license_expiry: "2025-08-30",
      status: "on_leave",
      truck_assigned: "",
      hire_date: "2022-11-05",
      type: "company",
      revenue: 18000.25,
      profit: 2800.60
    }
  ])

  // Owner Operators Data
  const [ownerOperators, setOwnerOperators] = useState<DriverData[]>([
    {
      id: 4,
      name: "Robert Wilson",
      phone: "(555) 456-7890",
      email: "robert.wilson@gmail.com",
      license_number: "DL55667788",
      license_expiry: "2025-04-10",
      status: "active",
      truck_assigned: "Own Truck - Peterbilt 579",
      hire_date: "2023-02-20",
      type: "owner_operator",
      revenue: 45000.90,
      profit: 15000.45
    },
    {
      id: 5,
      name: "Sarah Davis",
      phone: "(555) 567-8901",
      email: "sarah.davis@outlook.com",
      license_number: "DL99887766",
      license_expiry: "2024-11-15",
      status: "active",
      truck_assigned: "Own Truck - Freightliner Cascadia",
      hire_date: "2023-05-12",
      type: "owner_operator",
      revenue: 38000.35,
      profit: 12000.70
    }
  ])

  // Context menu state for drivers
  const [driverContextMenu, setDriverContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: DriverData | null
    type: 'company' | 'owner_operator' | null
  }>({ isVisible: false, x: 0, y: 0, row: null, type: null })

  // Enhanced statistics data
  const totalRevenue = loads.items.reduce((sum, load) => sum + load.rate, 0)
  const weeklyRevenue = totalRevenue * 0.25 // Simulated weekly portion
  const monthlyRevenue = totalRevenue * 1.2 // Simulated monthly
  const yearlyRevenue = totalRevenue * 15 // Simulated yearly

  const statisticsData = {
    loads: loads.total,
    drivers: companyDrivers.length + ownerOperators.length,
    trucks: 3,
    customers: 2,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue
  }

  // Driver CRUD operations
  const handleCreateCompanyDriver = () => {
    // TODO: Implement modal for creating company driver
    console.log('Create company driver')
  }

  const handleCreateOwnerOperator = () => {
    // TODO: Implement modal for creating owner operator
    console.log('Create owner operator')
  }

  const handleEditDriver = (driver: DriverData) => {
    // TODO: Implement modal for editing driver
    console.log('Edit driver:', driver)
  }

  const handleDeleteDriver = (driverId: number, type: 'company' | 'owner_operator') => {
    if (confirm('Are you sure you want to delete this driver?')) {
      if (type === 'company') {
        setCompanyDrivers(companyDrivers.filter(driver => driver.id !== driverId))
      } else {
        setOwnerOperators(ownerOperators.filter(driver => driver.id !== driverId))
      }
    }
  }

  // Context menu handlers
  const handleDriverRightClick = (row: DriverData, event: React.MouseEvent, type: 'company' | 'owner_operator') => {
    setDriverContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row,
      type
    })
  }

  const closeDriverContextMenu = () => {
    setDriverContextMenu({ isVisible: false, x: 0, y: 0, row: null, type: null })
  }

  const handleDriverContextEdit = () => {
    if (driverContextMenu.row) {
      handleEditDriver(driverContextMenu.row)
    }
    closeDriverContextMenu()
  }

  const handleDriverContextDelete = () => {
    if (driverContextMenu.row && driverContextMenu.type) {
      handleDeleteDriver(driverContextMenu.row.id!, driverContextMenu.type)
    }
    closeDriverContextMenu()
  }

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'on_leave': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isLicenseExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000))
    return expiry <= thirtyDaysFromNow
  }

  return (
    <Layout>
      <div className="page-dashboard space-y-6 p-6">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        </div>

        {/* Statistics Display */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statisticsData.loads}</div>
              <div className="text-sm text-gray-600">Total Loads</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statisticsData.drivers}</div>
              <div className="text-sm text-gray-600">Active Drivers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statisticsData.trucks}</div>
              <div className="text-sm text-gray-600">Available Trucks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statisticsData.customers}</div>
              <div className="text-sm text-gray-600">Active Customers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(statisticsData.weeklyRevenue)}</div>
              <div className="text-sm text-gray-600">Weekly Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(statisticsData.monthlyRevenue)}</div>
              <div className="text-sm text-gray-600">Monthly Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(statisticsData.yearlyRevenue)}</div>
              <div className="text-sm text-gray-600">Yearly Revenue</div>
            </div>
          </div>
        </div>

        {/* Side by Side Simple Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Company Drivers Table */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Company Drivers</h2>
              <p className="text-gray-600">Performance overview</p>
            </div>

            <div className="bg-white rounded-lg border shadow">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companyDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {driver.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(driver.revenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(driver.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      Total ({companyDrivers.length} drivers)
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(companyDrivers.reduce((sum, driver) => sum + driver.revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-700">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(companyDrivers.reduce((sum, driver) => sum + driver.profit, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Owner Operators Table */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Owner Operators</h2>
              <p className="text-gray-600">Performance overview</p>
            </div>

            <div className="bg-white rounded-lg border shadow">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ownerOperators.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {driver.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(driver.revenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(driver.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      Total ({ownerOperators.length} operators)
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(ownerOperators.reduce((sum, driver) => sum + driver.revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-700">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(ownerOperators.reduce((sum, driver) => sum + driver.profit, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Context Menu for Drivers */}
        <ContextMenu
          x={driverContextMenu.x}
          y={driverContextMenu.y}
          isVisible={driverContextMenu.isVisible}
          onClose={closeDriverContextMenu}
        >
          <ContextMenuItem
            onClick={handleDriverContextEdit}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit Driver
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleDriverContextDelete}
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