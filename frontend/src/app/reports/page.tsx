'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Calendar, CalendarDays, LayoutDashboard, Lock, TrendingUp } from 'lucide-react'
import OverviewReport from '@/components/reports/overview-report'
import WeeklyReport from '@/components/reports/weekly-report'
import CostTable from '@/components/reports/cost-table'
import { useLoads } from '@/hooks/use-loads'

// The ISO week year a load's pickup falls in (dates are wall-clock times stored as UTC).
function isoWeekYear(dateString: string): number {
  const iso = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString) ? dateString : dateString + 'Z'
  const date = new Date(iso)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  return d.getUTCFullYear()
}

type TabType = 'overview' | 'weekly' | 'variable' | 'fixed'

const TABS: { key: TabType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'weekly', label: 'Weekly', Icon: CalendarDays },
  { key: 'variable', label: 'Variable Costs', Icon: TrendingUp },
  { key: 'fixed', label: 'Fixed Costs', Icon: Lock },
]

export default function ReportsPage() {
  const { data: loadsData } = useLoads(1, 10000)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // This year plus every year with a load, newest first.
  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()])
    ;(loadsData?.items || []).forEach(load => {
      if (!load.pickup_date) return
      const y = isoWeekYear(load.pickup_date)
      if (!isNaN(y)) years.add(y)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [loadsData])

  const byYear = activeTab === 'overview' || activeTab === 'weekly'

  return (
    <Layout>
      <div className="page-reports space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">Year overview and weekly statistics, built on Payroll, and cost per mile</p>
        </div>

        {/* Year */}
        {byYear && (
          <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex gap-1">
            <Calendar className="h-5 w-5 text-gray-500 my-auto mx-2" />
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                  selectedYear === year ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-x-8">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && <OverviewReport year={selectedYear} />}
        {activeTab === 'weekly' && <WeeklyReport year={selectedYear} />}
        {activeTab === 'variable' && <CostTable kind="variable" />}
        {activeTab === 'fixed' && <CostTable kind="fixed" />}
      </div>
    </Layout>
  )
}
