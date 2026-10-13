'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  FuelCard,
  FuelCardTransaction,
  useCardTransactions,
  useFuelCardConnection,
  useFuelCards,
  useSetCardTruck,
  useSetTransactionTruck,
} from '@/hooks/use-fuel-cards'

type TruckOption = { id: number; truck_number: string }

const border = '1px solid var(--monday-border-light)'
const headCell: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', borderBottom: border }
const bodyCell: React.CSSProperties = { fontSize: '13px', color: 'var(--monday-text-primary)', borderBottom: border }
const selectClass = 'border rounded px-2 py-1 text-sm bg-white'

// The provider reports its own local time with no zone: show it as printed.
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' }) : '-'

const STATUS: Record<FuelCardTransaction['status'], string> = {
  imported: 'Added to Fuel',
  linked: 'Matched an entry typed in',
  needs_truck: 'Needs a truck',
  not_fuel: 'Not fuel',
}

/**
 * Fuel > Cards: every WEX card, the truck it's assigned to, and each of its
 * transactions. A transaction goes on the card's truck unless it's moved to
 * another one here (two trucks sharing a card); its Fuel entry follows, so the
 * Fuel page and payroll do too.
 */
export function FuelCardsView({ trucks }: { trucks: TruckOption[] }) {
  const { data: connection, isLoading: connLoading } = useFuelCardConnection()
  const { data: cards, isLoading } = useFuelCards(!!connection?.connected)
  const setCardTruck = useSetCardTruck()
  const [open, setOpen] = useState<string | null>(null)

  if (connLoading || (connection?.connected && isLoading)) {
    return <div className="p-6" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>Loading cards…</div>
  }
  if (!connection?.connected) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
        <CreditCard className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--monday-text-muted)' }} />
        <div style={{ fontSize: '14px', color: 'var(--monday-text-secondary)' }}>
          WEX isn&apos;t connected. Connect it in <Link href="/settings" className="underline">Settings → Fuel Card</Link>.
        </div>
      </div>
    )
  }
  if (!cards?.length) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ border, backgroundColor: 'var(--monday-bg-primary)', fontSize: '14px', color: 'var(--monday-text-secondary)' }}>
        No cards yet - they show up here once WEX sends the first transactions.
      </div>
    )
  }

  const changeCardTruck = (card: FuelCard, value: string) => {
    const truckId = value ? Number(value) : null
    const truck = trucks.find(t => t.id === truckId)
    // Swipes already on a truck (not set by hand): ask whether they move too.
    const onTrucks = card.transactions - card.needs_truck - card.manual
    let apply = false
    if (truck && onTrucks > 0) {
      apply = confirm(
        `Also move this card's earlier fuel entries to truck ${truck.truck_number}?\n\n` +
        `OK - move them (except ones you put on a truck by hand).\n` +
        `Cancel - leave them where they are; only new transactions go to ${truck.truck_number}.`,
      )
    }
    setCardTruck.mutate({ card_last6: card.card_last6, truck_id: truckId, apply_to_existing: apply })
  }

  return (
    <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <th className="px-3 py-2.5 w-8" style={headCell}></th>
            <th className="px-3 py-2.5 text-left" style={headCell}>Card</th>
            <th className="px-3 py-2.5 text-left" style={headCell}>Truck</th>
            <th className="px-3 py-2.5 text-left" style={headCell}>Last unit / driver keyed</th>
            <th className="px-3 py-2.5 text-left" style={headCell}>Last used</th>
            <th className="px-3 py-2.5 text-right" style={headCell}>Transactions</th>
            <th className="px-3 py-2.5 text-right" style={headCell}>Fuel + DEF</th>
          </tr>
        </thead>
        <tbody>
          {cards.map(card => {
            const isOpen = open === card.card_last6
            return (
              <React.Fragment key={card.card_last6}>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 cursor-pointer" style={bodyCell} onClick={() => setOpen(isOpen ? null : card.card_last6)}>
                    {isOpen ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--monday-blue)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--monday-blue)' }} />}
                  </td>
                  <td className="px-3 py-2.5 cursor-pointer" style={{ ...bodyCell, fontWeight: 600 }} onClick={() => setOpen(isOpen ? null : card.card_last6)}>
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4" style={{ color: 'var(--monday-text-muted)' }} />
                      •••• {card.card_last6}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={bodyCell}>
                    <select
                      className={selectClass}
                      style={{ borderColor: card.truck_id ? 'var(--monday-border)' : 'var(--monday-stuck)' }}
                      value={card.truck_id ?? ''}
                      disabled={setCardTruck.isPending}
                      onChange={(e) => changeCardTruck(card, e.target.value)}
                    >
                      <option value="">No truck (use unit keyed)</option>
                      {trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5" style={{ ...bodyCell, color: 'var(--monday-text-secondary)' }}>
                    {[card.last_unit && `Unit ${card.last_unit}`, card.last_driver].filter(Boolean).join(' · ') || '-'}
                  </td>
                  <td className="px-3 py-2.5" style={{ ...bodyCell, color: 'var(--monday-text-secondary)' }}>{when(card.last_used)}</td>
                  <td className="px-3 py-2.5 text-right" style={bodyCell}>
                    {card.transactions}
                    {card.needs_truck > 0 && (
                      <span className="ml-2 rounded px-1.5 py-0.5" style={{ fontSize: '11px', backgroundColor: '#fde8e8', color: 'var(--monday-stuck)' }}>
                        {card.needs_truck} need a truck
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ ...bodyCell, fontWeight: 600, color: 'var(--monday-done)' }}>{formatCurrency(Number(card.total))}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7} className="p-0" style={{ borderBottom: border, backgroundColor: 'var(--monday-bg-secondary)' }}>
                      <CardTransactions card={card} trucks={trucks} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CardTransactions({ card, trucks }: { card: FuelCard; trucks: TruckOption[] }) {
  const { data: rows, isLoading } = useCardTransactions(card.card_last6)
  const setTruck = useSetTransactionTruck()
  const cell: React.CSSProperties = { fontSize: '12px', color: 'var(--monday-text-primary)', borderBottom: border }
  const head: React.CSSProperties = { fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', borderBottom: border }

  if (isLoading) return <div className="px-10 py-3" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>Loading transactions…</div>
  if (!rows?.length) return <div className="px-10 py-3" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>No transactions.</div>

  return (
    <div className="pl-8 pr-2 py-2 overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left" style={head}>Date</th>
            <th className="px-2 py-1.5 text-left" style={head}>Location</th>
            <th className="px-2 py-1.5 text-left" style={head}>Unit / driver keyed</th>
            <th className="px-2 py-1.5 text-right" style={head}>Gallons</th>
            <th className="px-2 py-1.5 text-right" style={head}>Fuel</th>
            <th className="px-2 py-1.5 text-right" style={head}>DEF</th>
            <th className="px-2 py-1.5 text-left" style={head}>Truck</th>
            <th className="px-2 py-1.5 text-left" style={head}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(tx => {
            const gallons = Number(tx.fuel_gallons) || 0
            const defGallons = Number(tx.def_gallons) || 0
            const value = tx.manual_truck ? String(tx.truck_id) : tx.status === 'needs_truck' ? '' : 'card'
            const deleted = (tx.status === 'imported' || tx.status === 'linked') && !tx.fuel_id
            return (
              <tr key={tx.id} style={{ backgroundColor: tx.manual_truck ? 'var(--monday-bg-primary)' : undefined }}>
                <td className="px-2 py-1.5 whitespace-nowrap" style={cell}>{when(tx.transaction_date)}</td>
                <td className="px-2 py-1.5" style={{ ...cell, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.location || ''}>{tx.location || '-'}</td>
                <td className="px-2 py-1.5" style={{ ...cell, color: 'var(--monday-text-secondary)' }}>
                  {[tx.unit && `Unit ${tx.unit}`, tx.driver_prompt].filter(Boolean).join(' · ') || '-'}
                </td>
                <td className="px-2 py-1.5 text-right" style={cell}>
                  {gallons ? gallons.toFixed(1) : '-'}
                  {defGallons > 0 && <span style={{ color: 'var(--monday-text-muted)' }}> + {defGallons.toFixed(1)} DEF</span>}
                </td>
                <td className="px-2 py-1.5 text-right" style={cell}>{Number(tx.fuel_amount) ? formatCurrency(Number(tx.fuel_amount)) : '-'}</td>
                <td className="px-2 py-1.5 text-right" style={cell}>{Number(tx.def_amount) ? formatCurrency(Number(tx.def_amount)) : '-'}</td>
                <td className="px-2 py-1" style={cell}>
                  {tx.status === 'not_fuel' ? (
                    <span style={{ color: 'var(--monday-text-muted)' }}>-</span>
                  ) : (
                    <select
                      className={selectClass}
                      style={{ fontSize: '12px', borderColor: tx.manual_truck ? 'var(--monday-blue)' : 'var(--monday-border)' }}
                      value={value}
                      disabled={setTruck.isPending}
                      onChange={(e) => setTruck.mutate({ id: tx.id, truck_id: e.target.value === 'card' ? null : Number(e.target.value) })}
                    >
                      {tx.status === 'needs_truck' && !card.truck_id && <option value="" disabled>Pick a truck</option>}
                      {(card.truck_id || tx.status !== 'needs_truck') && (
                        <option value="card">
                          {card.truck_id
                            ? `Card's truck (${card.truck_number})`
                            : `Unit keyed${!tx.manual_truck && tx.truck_number ? ` (${tx.truck_number})` : ''}`}
                        </option>
                      )}
                      {trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-2 py-1.5" style={{ ...cell, color: tx.status === 'needs_truck' ? 'var(--monday-stuck)' : 'var(--monday-text-secondary)' }}>
                  {deleted ? 'Fuel entry deleted' : STATUS[tx.status]}
                  {tx.status === 'not_fuel' && tx.other_items ? `: ${tx.other_items}` : ''}
                  {tx.manual_truck && <span style={{ color: 'var(--monday-blue)' }}> · set by hand</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
