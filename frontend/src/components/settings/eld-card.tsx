'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Gauge, Loader2, AlertTriangle } from 'lucide-react'
import { useEldConnection, useConnectEld, useDisconnectEld } from '@/hooks/use-eld'

/** Settings > ELD Integration: paste the Peak ELD API key; mileage shows under Reports > Mileage. */
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
                  <p className="text-sm text-gray-500 mt-1">Truck miles are under Reports → Mileage.</p>
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
