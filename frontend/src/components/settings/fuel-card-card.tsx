'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, RefreshCw } from 'lucide-react'
import { useTrucks } from '@/hooks/use-trucks'
import {
  useFuelCardConnection, useConnectFuelCard, useSyncFuelCard, useDisconnectFuelCard,
  useFuelCardTransactions, useSetCardTruck,
} from '@/hooks/use-fuel-cards'
import { formatCurrency } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
/** Monday of this week, YYYY-MM-DD: the default first day to import. */
function thisMonday(): string {
  const d = new Date()
  const back = d.getDay() === 0 ? 6 : d.getDay() - 1
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
  return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`
}
const fmtDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Settings > Fuel Card: WEX Fleet One (EFS) SFTP login; the daily transaction files become Fuel entries. */
export default function FuelCardCard() {
  const { data: conn, isLoading } = useFuelCardConnection()
  const connect = useConnectFuelCard()
  const sync = useSyncFuelCard()
  const disconnect = useDisconnectFuelCard()
  const [form, setForm] = useState({
    host: 'sftpus1.mft.wextransfer.com', port: 22, remote_dir: '/', username: '', password: '', import_from: thisMonday(),
  })
  const [advanced, setAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password) return
    connect.mutate(form, {
      onSuccess: () => { setForm(f => ({ ...f, password: '' })); setEditing(false) },
    })
  }

  const showForm = !conn?.connected || editing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="mr-2 h-5 w-5" />
          Fuel Card (WEX Fleet One)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            {conn?.connected && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      WEX fuel card connected
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      SFTP <span className="font-mono">{conn.username}@{conn.host}</span>
                      {conn.import_from && <> · importing from {fmtDate(conn.import_from)}</>}
                    </p>
                    <p className="text-sm text-gray-500">
                      {conn.last_sync_at
                        ? <>Last sync {new Date(conn.last_sync_at).toLocaleString()}{conn.last_sync_result && <> — {conn.last_sync_result}</>}</>
                        : 'Not synced yet'}
                      . WEX posts a file each day; we check every 3 hours.
                    </p>
                    {conn.last_error && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> {conn.last_error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
                      {sync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Sync now
                    </Button>
                    {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change login</Button>}
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
                        <Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setConfirmRemove(true)}>Disconnect</Button>
                    )}
                  </div>
                </div>
                {confirmRemove && (
                  <p className="text-xs text-gray-500">Fuel entries already imported stay on the Fuel page.</p>
                )}
              </div>
            )}

            {conn?.connected && conn.needs_truck > 0 && <NeedsTruck count={conn.needs_truck} />}

            {showForm && (
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="efs-user">SFTP username</Label>
                    <Input id="efs-user" autoComplete="off" value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="efs-pass">SFTP password</Label>
                    <Input id="efs-pass" type="password" autoComplete="new-password" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="efs-from">Import transactions from</Label>
                    <Input id="efs-from" type="date" value={form.import_from} max={new Date().toISOString().slice(0, 10)}
                      onChange={e => e.target.value && setForm({ ...form, import_from: e.target.value })} />
                  </div>
                </div>
                {advanced ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="efs-host">Server</Label>
                      <Input id="efs-host" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="efs-port">Port</Label>
                      <Input id="efs-port" type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) || 22 })} />
                    </div>
                    <div>
                      <Label htmlFor="efs-dir">Folder</Label>
                      <Input id="efs-dir" value={form.remote_dir} onChange={e => setForm({ ...form, remote_dir: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <button type="button" className="text-xs text-brand hover:underline" onClick={() => setAdvanced(true)}>
                    Server: {form.host}, port {form.port} — change
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  Use the SFTP username and password WEX emailed from GoAnywhere (us1mft@wexinc.com, subject &ldquo;Account Created&rdquo;) —
                  not your Fleet One website login. WEX puts a transaction file (EFS_…_110_date.dat) on the server every day.
                  Pick the first day not already typed in on the Fuel page, so nothing is counted twice; a swipe that matches an entry
                  already there (same truck, day and amount) is linked to it instead of added again.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" disabled={!form.username.trim() || !form.password || connect.isPending} className="bg-brand hover:bg-brand/90">
                    {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {conn?.connected ? 'Save and sync' : 'Connect and import'}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" onClick={() => { setEditing(false); setForm(f => ({ ...f, password: '' })) }}>
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

/** Swipes whose UNIT prompt didn't match a truck: pick the truck per card and they import. */
function NeedsTruck({ count }: { count: number }) {
  const { data: waiting = [], isLoading } = useFuelCardTransactions('needs_truck', true)
  const { data: trucksData } = useTrucks()
  const setCard = useSetCardTruck()
  const trucks = (trucksData?.items || []).filter((t: any) => t.type === 'truck')

  const cards = useMemo(() => {
    const by = new Map<string, { card: string; units: Set<string>; swipes: number; amount: number }>()
    waiting.forEach(t => {
      const key = t.card_last6 || '?'
      const c = by.get(key) || { card: key, units: new Set<string>(), swipes: 0, amount: 0 }
      if (t.unit) c.units.add(t.unit)
      c.swipes += 1
      c.amount += Number(t.fuel_amount) + Number(t.def_amount)
      by.set(key, c)
    })
    return Array.from(by.values())
  }, [waiting])

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {count} fuel {count === 1 ? 'purchase needs' : 'purchases need'} a truck — the unit number keyed at the pump didn&apos;t match one.
        Pick the truck for each card and they&apos;ll be added to the Fuel page.
      </p>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
      ) : (
        <div className="space-y-2">
          {cards.map(c => (
            <div key={c.card} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono">Card …{c.card}</span>
              <span className="text-gray-600">
                {c.swipes} {c.swipes === 1 ? 'purchase' : 'purchases'}, {formatCurrency(c.amount)}
                {c.units.size > 0 && <> · unit keyed: {Array.from(c.units).join(', ')}</>}
              </span>
              <select
                defaultValue=""
                disabled={setCard.isPending || c.card === '?'}
                onChange={e => e.target.value && setCard.mutate({ card_last6: c.card, truck_id: Number(e.target.value) })}
                className="border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                <option value="">Pick truck…</option>
                {trucks.map((t: any) => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
