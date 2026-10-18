'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Gauge, Loader2, AlertTriangle } from 'lucide-react'
import { useEldConnection, useConnectEld, useDisconnectEld, useEldMileage, useSetEldTruckMatch } from '@/hooks/use-eld'

/** Settings > ELD Integration: paste the Peak ELD API key, and match Peak trucks to trucks here. */
export default function EldCard() {
  const { data: conn, isLoading } = useEldConnection()
  const connect = useConnectEld()
  const disconnect = useDisconnectEld()
  const [apiKey, setApiKey] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const key = apiKey.trim()
    if (!key) return
    connect.mutate(key, {
      onSuccess: () => { setApiKey(''); setReplacing(false) },
    })
  }

  const showForm = !conn?.connected || replacing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Gauge className="mr-2 h-5 w-5" />
          ELD Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            {conn?.connected && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Peak ELD connected
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    API key ending in <span className="font-mono">{conn.key_last4}</span>
                    {conn.last_ok_at && <> · last read {new Date(conn.last_ok_at).toLocaleString()}</>}
                  </p>
                  {conn.last_error && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> {conn.last_error}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">Truck miles feed Payroll's Total Miles, Fuel and Reports.</p>
                </div>
                <div className="flex gap-2">
                  {!replacing && (
                    <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>Change key</Button>
                  )}
                  {confirmRemove ? (
                    <>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={disconnect.isPending}
                        onClick={() => disconnect.mutate(undefined, { onSettled: () => setConfirmRemove(false) })}
                      >
                        Yes, disconnect
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>Disconnect</Button>
                  )}
                </div>
              </div>
            )}

            {conn?.connected && !replacing && <TruckMatching />}

            {showForm && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="peak-api-key">Peak ELD API key</Label>
                  <Input
                    id="peak-api-key"
                    type="password"
                    autoComplete="off"
                    placeholder="Paste the API key from Peak ELD"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    In Peak ELD (cloud.eldpeak.com) open <b>API Keys</b>, click <b>Add API Key</b> (Read-Only is enough)
                    and copy it. The key is checked with Peak, then stored encrypted.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={!apiKey.trim() || connect.isPending} className="bg-brand hover:bg-brand/90">
                    {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {conn?.connected ? 'Save new key' : 'Connect'}
                  </Button>
                  {replacing && (
                    <Button type="button" variant="outline" onClick={() => { setReplacing(false); setApiKey('') }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Last 30 days of Peak trucks: anything that drove shows up to match.
function last30(): [string, string] {
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 30)
  return [ymd(start), ymd(end)]
}

const MATCHED_BY: Record<string, string> = { manual: 'Picked here', unit: 'Same unit number', vin: 'Same VIN' }

/**
 * Which TMS truck each Peak truck is. Matched automatically by unit number
 * or VIN; pick a truck to override. Payroll's Total Miles, Fuel's MPG and
 * Reports use this.
 */
function TruckMatching() {
  const [start, end] = last30()
  const { data, isLoading, error } = useEldMileage(start, end, true)
  const setMatch = useSetEldTruckMatch()
  const vehicles = [...(data?.vehicles || [])].sort((a, b) => Number(!!a.truck_id) - Number(!!b.truck_id) || a.unit.localeCompare(b.unit, undefined, { numeric: true }))
  const unmatched = vehicles.filter(v => !v.truck_id && v.miles > 0).length
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="font-medium text-gray-900">Truck matching</div>
        <div className="text-xs text-gray-500">
          {unmatched > 0
            ? <span className="text-amber-700">{unmatched} Peak {unmatched === 1 ? 'truck isn\u2019t' : 'trucks aren\u2019t'} matched - pick a truck</span>
            : 'Peak trucks that drove in the last 30 days'}
        </div>
      </div>
      {isLoading ? (
        <div className="px-4 py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="px-4 py-4 text-sm text-red-600">Couldn&apos;t read trucks from Peak ELD.</div>
      ) : vehicles.length === 0 ? (
        <div className="px-4 py-4 text-sm text-gray-500">No Peak trucks in the last 30 days.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Peak unit</th>
                <th className="px-4 py-2 text-left font-medium">Driver (Peak)</th>
                <th className="px-4 py-2 text-right font-medium">Miles, 30 days</th>
                <th className="px-4 py-2 text-left font-medium">Truck</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => (
                <tr key={v.eld_id}>
                  <td className="px-4 py-2 text-gray-800">
                    {v.unit}{!v.active && <span className="ml-2 text-xs text-gray-400">inactive</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{v.driver_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{Math.round(v.miles).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <select
                      value={v.matched_by === 'manual' ? v.truck_id ?? '' : ''}
                      onChange={e => setMatch.mutate({ eld_id: v.eld_id, truck_id: e.target.value ? Number(e.target.value) : null })}
                      className={`rounded-md border px-2 py-1 text-sm ${v.truck_id ? 'border-gray-200' : 'border-amber-300 text-amber-700'}`}
                    >
                      <option value="">{v.truck_id && v.matched_by !== 'manual' ? `Automatic: ${v.truck_number}` : 'Not matched'}</option>
                      {(data?.trucks || []).map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
                    </select>
                    {v.matched_by && <span className="ml-2 text-xs text-gray-400">{MATCHED_BY[v.matched_by]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
