'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/layout/layout'
import { useAuth } from '@/hooks/use-auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Users, Truck, Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Fetch real data from API
  const { data: loads, isLoading: loadsLoading } = useQuery({
    queryKey: ['loads'],
    queryFn: async () => {
      const response = await api.get('/v1/loads?limit=10000')
      return response.data
    }
  })

  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await api.get('/v1/drivers?limit=10000')
      return response.data
    }
  })

  const { data: trucks, isLoading: trucksLoading } = useQuery({
    queryKey: ['trucks'],
    queryFn: async () => {
      const response = await api.get('/v1/trucks?limit=10000')
      return response.data
    }
  })

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/v1/customers?limit=10000')
      return response.data
    }
  })

  const isLoading = loadsLoading || driversLoading || trucksLoading || customersLoading

  // Calculate financial summaries
  const financialSummary = React.useMemo(() => {
    if (!loads) return { today: 0, month: 0, year: 0, todayLoads: 0, monthLoads: 0, yearLoads: 0 }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    let todayRevenue = 0
    let monthRevenue = 0
    let yearRevenue = 0
    let todayLoads = 0
    let monthLoads = 0
    let yearLoads = 0

    loads.forEach((load: any) => {
      const rate = Number(load.rate) || 0
      // Use pickup_date or created_at as the date for revenue calculation
      const loadDate = load.pickup_date ? new Date(load.pickup_date) : (load.created_at ? new Date(load.created_at) : null)

      if (loadDate) {
        // Today: loads picked up today
        if (loadDate >= todayStart && loadDate < todayEnd) {
          todayRevenue += rate
          todayLoads++
        }
        // This month: loads picked up this month
        if (loadDate >= monthStart) {
          monthRevenue += rate
          monthLoads++
        }
        // This year: loads picked up this year
        if (loadDate >= yearStart) {
          yearRevenue += rate
          yearLoads++
        }
      }
    })

    return {
      today: todayRevenue,
      month: monthRevenue,
      year: yearRevenue,
      todayLoads,
      monthLoads,
      yearLoads
    }
  }, [loads])

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {user?.first_name ? user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1).toLowerCase() : ''}!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening with your company today
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : loads?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active shipments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : drivers?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Company & owner operators
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Trucks</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : trucks?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Fleet vehicles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : customers?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Business partners
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Today</p>
                <p className="text-3xl font-bold text-green-600">
                  ${financialSummary.today.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{financialSummary.todayLoads} loads</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${financialSummary.month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{financialSummary.monthLoads} loads</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">This Year</p>
                <p className="text-3xl font-bold text-purple-600">
                  ${financialSummary.year.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{financialSummary.yearLoads} loads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started Section */}
        {!isLoading && loads?.length === 0 && drivers?.length === 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>🚀 Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Welcome to your TMS! Get started by adding your first data:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => router.push('/loads')}
                  variant="outline"
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Load
                </Button>
                <Button
                  onClick={() => router.push('/drivers')}
                  variant="outline"
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Driver
                </Button>
                <Button
                  onClick={() => router.push('/trucks')}
                  variant="outline"
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Truck
                </Button>
                <Button
                  onClick={() => router.push('/customers')}
                  variant="outline"
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  )
}
