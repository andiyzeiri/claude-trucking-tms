'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/layout/layout'
import { useAuth } from '@/hooks/use-auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
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
    if (!loads) return { today: 0, month: 0, year: 0, todayLoads: 0, monthLoads: 0, yearLoads: 0, lastYearSamePeriod: 0, lastYearSamePeriodLoads: 0, yearOverYearPercent: null as number | null }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Last year same period: Jan 1 last year → same month/day last year
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const lastYearSameDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    lastYearSameDate.setDate(lastYearSameDate.getDate() + 1) // include the full day

    let todayRevenue = 0
    let monthRevenue = 0
    let yearRevenue = 0
    let todayLoads = 0
    let monthLoads = 0
    let yearLoads = 0
    let lastYearSamePeriodRevenue = 0
    let lastYearSamePeriodLoads = 0

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
        // Last year same period: Jan 1 last year → same date last year
        if (loadDate >= lastYearStart && loadDate < lastYearSameDate) {
          lastYearSamePeriodRevenue += rate
          lastYearSamePeriodLoads++
        }
      }
    })

    // Calculate year-over-year percentage change
    const yearOverYearPercent = lastYearSamePeriodRevenue > 0
      ? ((yearRevenue - lastYearSamePeriodRevenue) / lastYearSamePeriodRevenue) * 100
      : null

    return {
      today: todayRevenue,
      month: monthRevenue,
      year: yearRevenue,
      todayLoads,
      monthLoads,
      yearLoads,
      lastYearSamePeriod: lastYearSamePeriodRevenue,
      lastYearSamePeriodLoads,
      yearOverYearPercent
    }
  }, [loads])

  return (
    <Layout>
      <div className="space-y-6 p-6 page-dashboard">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
            Welcome back, {user?.first_name ? user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1).toLowerCase() : ''}!
          </h1>
          <p className="mt-1" style={{ color: 'var(--monday-text-secondary)' }}>
            Here's what's happening with your company today
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--monday-border-light)' }} onClick={() => router.push('/loads')}>
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Total Loads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: 'var(--monday-done)' }}>
                {isLoading ? '...' : loads?.length || 0}
              </div>
              <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                Active shipments
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--monday-border-light)' }} onClick={() => router.push('/drivers')}>
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Active Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: 'var(--monday-blue)' }}>
                {isLoading ? '...' : drivers?.length || 0}
              </div>
              <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                Company & owner operators
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--monday-border-light)' }} onClick={() => router.push('/trucks')}>
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Available Trucks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: 'var(--monday-purple)' }}>
                {isLoading ? '...' : trucks?.length || 0}
              </div>
              <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                Fleet vehicles
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--monday-border-light)' }} onClick={() => router.push('/customers')}>
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Active Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: 'var(--monday-stuck)' }}>
                {isLoading ? '...' : customers?.length || 0}
              </div>
              <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                Business partners
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card style={{ borderColor: 'var(--monday-border-light)' }}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--monday-text-primary)' }}>Revenue Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Today</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--monday-done)' }}>
                  ${financialSummary.today.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>{financialSummary.todayLoads} loads</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>This Month</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--monday-blue)' }}>
                  ${financialSummary.month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>{financialSummary.monthLoads} loads</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>This Year</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--monday-purple)' }}>
                  ${financialSummary.year.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>{financialSummary.yearLoads} loads</p>
                {financialSummary.yearOverYearPercent !== null ? (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold" style={{ color: financialSummary.yearOverYearPercent >= 0 ? 'var(--monday-done)' : 'var(--monday-stuck)' }}>
                        {financialSummary.yearOverYearPercent >= 0 ? '+' : ''}{financialSummary.yearOverYearPercent.toFixed(1)}%
                      </span>
                      <span className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>vs last year</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--monday-text-muted)' }}>
                      Last year: ${financialSummary.lastYearSamePeriod.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({financialSummary.lastYearSamePeriodLoads} loads)
                    </p>
                  </div>
                ) : financialSummary.year > 0 ? (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>No data from last year to compare</p>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started Section */}
        {!isLoading && loads?.length === 0 && drivers?.length === 0 && (
          <Card style={{ backgroundColor: 'rgba(27, 42, 65, 0.08)', borderColor: 'var(--monday-cornflower)' }}>
            <CardHeader>
              <CardTitle style={{ color: 'var(--monday-text-primary)' }}>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p style={{ color: 'var(--monday-text-secondary)' }}>
                Welcome to your TMS! Get started by adding your first data:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => router.push('/loads')}
                  variant="outline"
                  className="justify-start"
                  style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
                >
                  <Plus className="h-4 w-4 mr-2" style={{ color: 'var(--monday-cornflower)' }} />
                  Add Your First Load
                </Button>
                <Button
                  onClick={() => router.push('/drivers')}
                  variant="outline"
                  className="justify-start"
                  style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
                >
                  <Plus className="h-4 w-4 mr-2" style={{ color: 'var(--monday-cornflower)' }} />
                  Add Your First Driver
                </Button>
                <Button
                  onClick={() => router.push('/trucks')}
                  variant="outline"
                  className="justify-start"
                  style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
                >
                  <Plus className="h-4 w-4 mr-2" style={{ color: 'var(--monday-cornflower)' }} />
                  Add Your First Truck
                </Button>
                <Button
                  onClick={() => router.push('/customers')}
                  variant="outline"
                  className="justify-start"
                  style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
                >
                  <Plus className="h-4 w-4 mr-2" style={{ color: 'var(--monday-cornflower)' }} />
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
