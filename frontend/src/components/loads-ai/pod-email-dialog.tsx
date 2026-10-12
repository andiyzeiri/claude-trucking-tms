'use client'

import { useEffect, useState } from 'react'
import { Mail, Paperclip, Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePodEmailPreview, useSendPodEmail } from '@/hooks/use-loads-ai-ingestion'

type Role = 'to' | 'cc' | 'off'
interface Row { email: string; source: string; note: string | null; role: Role }

const SOURCE_LABEL: Record<string, string> = {
  sender: 'Sent the ratecon',
  reply_to: 'Reply-to on the ratecon email',
  cc: 'CC on the ratecon email',
  ratecon: 'On the ratecon',
  added: 'Added by you',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Email a load's POD from pods@ to the broker: the people the rate
 * confirmation came from go in To, everyone else found on it in CC. Each
 * address can be switched To / CC / off before sending.
 */
export function PodEmailDialog({ aiLoadId, loadLabel, onClose }: { aiLoadId: number | null; loadLabel: string; onClose: () => void }) {
  const { data, isLoading, error } = usePodEmailPreview(aiLoadId)
  const send = useSendPodEmail()
  const [rows, setRows] = useState<Row[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [extra, setExtra] = useState('')

  useEffect(() => {
    if (!data) return
    let hasTo = false
    setRows(data.candidates.map((c) => {
      let role: Role = 'off'
      if (c.checked) {
        role = c.source === 'sender' || c.source === 'reply_to' ? 'to' : 'cc'
        if (role === 'to') hasTo = true
      }
      return { email: c.email, source: c.source, note: c.note, role }
    }).map((r, i, all) => {
      // Nobody to address it to (e.g. the ratecon came from a no-reply): promote the first CC.
      if (!hasTo && r.role === 'cc' && all.findIndex((x) => x.role === 'cc') === i) return { ...r, role: 'to' as Role }
      return r
    }))
    setSubject(data.subject)
    setBody(data.body)
  }, [data])

  const setRole = (email: string, role: Role) => setRows((rs) => rs.map((r) => (r.email === email ? { ...r, role } : r)))
  const addExtra = () => {
    const e = extra.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return
    setRows((rs) => (rs.some((r) => r.email === e) ? rs.map((r) => (r.email === e ? { ...r, role: 'to' } : r))
      : [...rs, { email: e, source: 'added', note: null, role: 'to' }]))
    setExtra('')
  }

  const to = rows.filter((r) => r.role === 'to').map((r) => r.email)
  const cc = rows.filter((r) => r.role === 'cc').map((r) => r.email)
  const canSend = !!data?.can_send && to.length > 0 && !send.isPending

  const submit = async () => {
    if (aiLoadId == null || !canSend) return
    try {
      await send.mutateAsync({ id: aiLoadId, to, cc, subject, body })
      onClose()
    } catch {
      // toast shown by the hook
    }
  }

  return (
    <Dialog open={aiLoadId != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email POD{loadLabel ? ` - Load ${loadLabel}` : ''}</DialogTitle>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-sm text-gray-500">Finding who to send it to…</div>}
        {error && <div className="py-4 text-sm text-red-600">Couldn&apos;t load the email details.</div>}

        {data && (
          <div className="space-y-4 text-sm">
            {data.blocker && <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">{data.blocker}</div>}
            {data.last_sent_at && (
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-green-800">
                Already emailed {new Date(data.last_sent_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} to {data.last_sent_to.join(', ')}
              </div>
            )}

            <div className="flex gap-2"><span className="w-16 shrink-0 text-gray-500">From</span><span className="font-medium">{data.from_address || '—'}</span></div>

            <div>
              <div className="mb-1 text-gray-500">Recipients</div>
              {rows.length === 0 && <div className="text-gray-500">No email addresses found on the rate confirmation or its email - add one below.</div>}
              <div className="divide-y rounded border">
                {rows.map((r) => (
                  <div key={r.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className={`truncate ${r.role === 'off' ? 'text-gray-400' : 'font-medium'}`}>{r.email}</div>
                      <div className="text-xs text-gray-500">{SOURCE_LABEL[r.source] || r.source}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div className="flex overflow-hidden rounded border text-xs">
                      {(['to', 'cc', 'off'] as Role[]).map((role) => (
                        <button key={role} type="button" onClick={() => setRole(r.email, role)}
                          className={`px-2 py-1 ${r.role === role ? (role === 'off' ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white') : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {role === 'to' ? 'To' : role === 'cc' ? 'CC' : "Don't send"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add an email address"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra() } }} />
                <Button type="button" variant="outline" onClick={addExtra} disabled={!EMAIL_RE.test(extra.trim())}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <div>
              <div className="mb-1 text-gray-500">Subject</div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-gray-500">Message</div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
            </div>
            {data.attachment_name && (
              <div className="flex items-center gap-2 text-gray-600"><Paperclip className="h-4 w-4" /> {data.attachment_name}</div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}><X className="mr-1 h-4 w-4" /> Cancel</Button>
          <Button onClick={submit} disabled={!canSend}>
            <Mail className="mr-1 h-4 w-4" />
            {send.isPending ? 'Sending…' : `Send${to.length ? ` to ${to.length + cc.length}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
