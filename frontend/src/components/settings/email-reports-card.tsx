'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Send, Trash2, Eye, Loader2, Plus } from 'lucide-react'
import {
  useReportRecipients, useAddRecipient, useUpdateRecipient, useDeleteRecipient,
  useWeeklyTripsPreview, useSendWeeklyTrips,
} from '@/hooks/use-report-email'

/** Monday of the week containing `d`, as YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const dow = d.getDay() // 0 = Sunday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (dow === 0 ? -6 : 1 - dow))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? 0 : n
}

export default function EmailReportsCard() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const { data: recipients = [], isLoading } = useReportRecipients('weekly_trips')
  const addRecipient = useAddRecipient()
  const updateRecipient = useUpdateRecipient()
  const deleteRecipient = useDeleteRecipient()
  const sendReport = useSendWeeklyTrips()
  const preview = useWeeklyTripsPreview(weekStart, showPreview)

  const activeCount = useMemo(
    () => recipients.filter((r) => r.is_active).length,
    [recipients]
  )

  const submitRecipient = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    addRecipient.mutate(
      { report_key: 'weekly_trips', email: trimmed, name: name.trim() || undefined },
      { onSuccess: () => { setEmail(''); setName('') } }
    )
  }

  // Normalise whatever date is picked back to its Monday, so the label and
  // the report always agree about which week is being sent.
  const onWeekChange = (value: string) => {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    setWeekStart(mondayOf(new Date(y, m - 1, d)))
  }

  const weekEnd = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    const end = new Date(y, m - 1, d + 6)
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [weekStart])

  const weekStartLabel = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [weekStart])

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="mr-2 h-5 w-5" />
          Email Reports
        </CardTitle>
        <p className="text-sm text-content-secondary">
          Send the Weekly Trips report &mdash; every load hauled that week, grouped by driver
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Recipients */}
        <div>
          <Label className="text-sm font-medium">Recipients</Label>
          <p className="text-xs text-content-muted mt-0.5 mb-3">
            Addresses that receive Weekly Trips. Inactive addresses are skipped.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-content-muted py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading&hellip;
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-content-muted py-2">
              No recipients yet. Add one below.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border border-line-light">
              {recipients.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) =>
                      updateRecipient.mutate({ id: r.id, data: { is_active: e.target.checked } })
                    }
                    className="h-4 w-4"
                    title={r.is_active ? 'Active — will receive the report' : 'Inactive — skipped'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${r.is_active ? 'text-content' : 'text-content-muted line-through'}`}>
                      {r.email}
                    </div>
                    {r.name && <div className="text-xs text-content-muted">{r.name}</div>}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${r.email} from Weekly Trips?`)) {
                        deleteRecipient.mutate(r.id)
                      }
                    }}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submitRecipient} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dispatch@example.com"
              />
            </div>
            <div className="w-44">
              <Label className="text-xs">Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dispatch" />
            </div>
            <Button type="submit" disabled={addRecipient.isPending || !email.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>
        </div>

        {/* Week + send */}
        <div className="border-t border-line-light pt-5">
          <Label className="text-sm font-medium">Send a week</Label>
          <p className="text-xs text-content-muted mt-0.5 mb-3">
            Pick any date; it snaps to that Monday&ndash;Sunday week.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label className="text-xs">Week of</Label>
              <Input type="date" value={weekStart} onChange={(e) => onWeekChange(e.target.value)} />
            </div>
            <div className="text-sm text-content-secondary pb-2">
              {weekStartLabel} &ndash; {weekEnd}
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => setShowPreview((s) => !s)}
              className="border-line"
            >
              <Eye className="h-4 w-4 mr-1" /> {showPreview ? 'Hide' : 'Preview'}
            </Button>
            <Button
              onClick={() => sendReport.mutate({ weekStart })}
              disabled={sendReport.isPending || activeCount === 0}
              title={activeCount === 0 ? 'Add an active recipient first' : undefined}
            >
              {sendReport.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Send className="h-4 w-4 mr-1" />}
              Send to {activeCount}
            </Button>
          </div>

          {activeCount === 0 && recipients.length > 0 && (
            <p className="text-xs text-orange-600 mt-2">
              Every recipient is inactive &mdash; nothing would be sent.
            </p>
          )}
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="border-t border-line-light pt-5">
            {preview.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-content-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Building preview&hellip;
              </div>
            ) : preview.data ? (
              <>
                <div className="flex flex-wrap gap-6 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-content-muted">Trips</div>
                    <div className="font-semibold text-content">{preview.data.total_trips}</div>
                  </div>
                  <div>
                    <div className="text-xs text-content-muted">Miles</div>
                    <div className="font-semibold text-content">
                      {preview.data.total_miles.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-content-muted">Revenue</div>
                    <div className="font-semibold text-content">
                      ${num(preview.data.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-content-muted">Blended RPM</div>
                    <div className="font-semibold text-gold-deep">
                      {preview.data.rpm !== null ? `$${num(preview.data.rpm).toFixed(2)}/mi` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-content-muted">Drivers</div>
                    <div className="font-semibold text-content">{preview.data.driver_count}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-line-light overflow-hidden">
                  <iframe
                    title="Weekly Trips preview"
                    srcDoc={preview.data.html}
                    className="w-full"
                    style={{ height: 520, border: 0 }}
                    sandbox=""
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-content-muted">Could not build the preview.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
