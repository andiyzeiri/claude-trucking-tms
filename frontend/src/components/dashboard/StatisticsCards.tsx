'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  Package,
  Users,
  Truck,
  Building2,
  DollarSign,
  Calendar,
  CalendarDays,
  TrendingUp
} from 'lucide-react'

interface StatisticsCardsProps {
  loads: number
  drivers: number
  trucks: number
  customers: number
  weeklyRevenue: number
  monthlyRevenue: number
  yearlyRevenue: number
}

export default function StatisticsCards({
  loads,
  drivers,
  trucks,
  customers,
  weeklyRevenue,
  monthlyRevenue,
  yearlyRevenue
}: StatisticsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const statisticsConfig = [
    {
      title: 'Total Loads',
      value: loads,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500',
      format: 'number'
    },
    {
      title: 'Active Drivers',
      value: drivers,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      format: 'number'
    },
    {
      title: 'Available Trucks',
      value: trucks,
      icon: Truck,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500',
      format: 'number'
    },
    {
      title: 'Active Customers',
      value: customers,
      icon: Building2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500',
      format: 'number'
    },
    {
      title: 'Weekly Revenue',
      value: weeklyRevenue,
      icon: Calendar,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500',
      format: 'currency'
    },
    {
      title: 'Monthly Revenue',
      value: monthlyRevenue,
      icon: CalendarDays,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500',
      format: 'currency'
    },
    {
      title: 'Yearly Revenue',
      value: yearlyRevenue,
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-500',
      format: 'currency'
    }
  ]

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return formatCurrency(value)
    }
    return value.toLocaleString()
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
      {statisticsConfig.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} className="hover:shadow-lg transition-all duration-200 hover:scale-105 border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`${stat.bgColor} p-3 rounded-full shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-gray-900">
                    {formatValue(stat.value, stat.format)}
                  </div>
                  <div className="text-xs text-gray-600 font-medium leading-tight">
                    {stat.title}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}