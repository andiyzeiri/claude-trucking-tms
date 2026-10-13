'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import Layout from '@/components/layout/layout'
import { Route, Warehouse, MapPin } from 'lucide-react'
import { LanesSearch } from '@/components/lanes/lanes-search'
import { ShippersView } from '@/components/lanes/shippers-view'
import { ReceiversView } from '@/components/lanes/receivers-view'

type LanesTab = 'lanes' | 'shippers' | 'receivers'
const TABS: { key: LanesTab; label: string; icon: React.ElementType }[] = [
  { key: 'lanes', label: 'Lanes', icon: Route },
  { key: 'shippers', label: 'Shippers', icon: Warehouse },
  { key: 'receivers', label: 'Receivers', icon: MapPin },
]

export default function LanesPage() {
  const [tab, setTab] = useState<LanesTab>('lanes')

  // ?tab=shippers / ?tab=receivers (the old Shippers and Receivers links land here)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'shippers' || t === 'receivers' || t === 'lanes') setTab(t)
  }, [])

  const choose = (t: LanesTab) => {
    setTab(t)
    window.history.replaceState(null, '', t === 'lanes' ? '/lanes' : `/lanes?tab=${t}`)
  }

  return (
    <Layout>
      <div className="p-4 page-lanes">
        <h1 className="mb-4 text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Lanes</h1>

        <div className="mb-4 flex items-center gap-2 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => choose(key)}
              className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
              style={{
                color: tab === key ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
                borderBottom: tab === key ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'lanes' ? <LanesSearch /> : tab === 'shippers' ? <ShippersView /> : <ReceiversView />}
      </div>
    </Layout>
  )
}
