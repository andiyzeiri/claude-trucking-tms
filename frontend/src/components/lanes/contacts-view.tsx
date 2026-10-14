'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import api from '@/lib/api'

export interface BrokerContact {
  broker: string | null
  email: string | null
  loads: number
  last_load: string | null
}

const border = { borderColor: 'var(--monday-border-light)' }

// Brokers and the email each Loads AI rate confirmation came from.
export function ContactsView() {
  const [q, setQ] = useState('')
  const { data = [], isLoading } = useQuery({
    queryKey: ['broker-contacts'],
    queryFn: async (): Promise<BrokerContact[]> => (await api.get('/v1/lanes/contacts')).data,
  })

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? data.filter(c => `${c.broker || ''} ${c.email || ''}`.toLowerCase().includes(t)) : data
  }, [data, q])

  const th = (label: string, right = false) => (
    <th className={`px-3 py-2.5 ${right ? 'text-right' : 'text-left'} border-b`} style={{ ...border, fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>{label}</th>
  )
  const td = (content: React.ReactNode, right = false, muted = false) => (
    <td className={`px-3 py-2.5 border-b ${right ? 'text-right' : ''}`} style={{ ...border, fontSize: '13px', color: muted ? 'var(--monday-text-secondary)' : 'var(--monday-text-primary)' }}>{content}</td>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg p-3" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--monday-text-muted)' }} />
          <input
            className="rounded border py-1.5 pl-7 pr-2"
            style={{ ...border, width: '260px', fontSize: '13px', backgroundColor: 'var(--monday-bg-primary)', color: 'var(--monday-text-primary)' }}
            placeholder="Search broker or email"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <span className="ml-auto" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>
          {isLoading ? 'Loading contacts…' : `${rows.length} of ${data.length} contacts · from Loads AI rate confirmations, last 12 months`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <tr>{th('Broker')}{th('Email')}{th('Loads', true)}{th('Last load')}</tr>
          </thead>
          <tbody>
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                  {data.length ? 'No contacts match.' : 'No broker contacts yet.'}
                </td>
              </tr>
            )}
            {rows.map(c => (
              <tr key={`${c.broker}|${c.email}`}>
                {td(c.broker || '-')}
                {td(c.email
                  ? <a href={`mailto:${c.email}`} style={{ color: 'var(--monday-cornflower)' }}>{c.email}</a>
                  : '-', false, !c.email)}
                {td(c.loads, true)}
                {td(c.last_load ? new Date(`${c.last_load}T12:00:00`).toLocaleDateString() : '-', false, true)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
