'use client'

import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp } from 'lucide-react'
import StatisticsCards from '@/components/dashboard/StatisticsCards'

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

  // Enhanced statistics data
  const totalRevenue = loads.items.reduce((sum, load) => sum + load.rate, 0)
  const weeklyRevenue = totalRevenue * 0.25 // Simulated weekly portion
  const monthlyRevenue = totalRevenue * 1.2 // Simulated monthly
  const yearlyRevenue = totalRevenue * 15 // Simulated yearly

  const statisticsData = {
    loads: loads.total,
    drivers: 2,
    trucks: 3,
    customers: 2,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
              <p className="text-blue-100 text-lg">Welcome to Claude Trucking TMS</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-sm text-blue-100">
                📊 <strong>Demo Mode:</strong> Sample data display
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <StatisticsCards {...statisticsData} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Revenue Card */}
          <Card className="shadow-lg border-l-4 border-l-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center text-lg font-semibold text-gray-800">
                <DollarSign className="mr-3 h-6 w-6 text-green-600" />
                Total Revenue Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600 mb-2">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-sm text-gray-600 mb-4">Current Period Revenue</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">WEEKLY</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      {formatCurrency(weeklyRevenue)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">MONTHLY</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {formatCurrency(monthlyRevenue)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">YEARLY</p>
                    <p className="text-lg font-semibold text-red-600">
                      {formatCurrency(yearlyRevenue)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card className="shadow-lg border-l-4 border-l-blue-500">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center text-lg font-semibold text-gray-800">
                <TrendingUp className="mr-3 h-6 w-6 text-blue-600" />
                Recent Load Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {loads.items.map((load) => (
                  <div key={load.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Load #{load.load_number}</p>
                      <p className="text-xs text-gray-600 mt-1">{load.pickup_location}</p>
                    </div>
                    <div className="text-right flex flex-col items-end space-y-1">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(load.rate)}</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        load.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        load.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                        load.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {load.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}