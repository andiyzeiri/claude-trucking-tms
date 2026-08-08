import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'

function getErrorMessage(error: any, fallback: string): string {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first.msg) {
      const field = first.loc?.slice(-1)[0] || 'field'
      return `${field}: ${first.msg}`
    }
  }
  return fallback
}

export type ReportKey = 'weekly_trips'

export interface ReportRecipient {
  id: number
  report_key: ReportKey
  email: string
  name?: string | null
  is_active: boolean
  company_id: number
}

export interface WeeklyTripsPreview {
  subject: string
  html: string
  text: string
  week_start: string
  week_end: string
  total_trips: number
  total_miles: number
  total_revenue: string | number
  rpm: string | number | null
  driver_count: number
}

export interface SendResult {
  sent: number
  failed: number
  recipients: string[]
  transport: 'ses' | 'smtp' | 'console'
  subject: string
  delivered: boolean
}

export function useReportRecipients(reportKey?: ReportKey) {
  return useQuery<ReportRecipient[]>({
    queryKey: ['report-recipients', reportKey],
    queryFn: async () => {
      const qs = reportKey ? `?report_key=${reportKey}` : ''
      const response = await api.get(`/v1/reports-email/recipients${qs}`)
      return response.data
    }
  })
}

export function useAddRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { report_key: ReportKey; email: string; name?: string }) => {
      const response = await api.post('/v1/reports-email/recipients', data)
      return response.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-recipients'] })
      toast.success('Recipient added')
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to add recipient'))
  })
}

export function useUpdateRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { is_active?: boolean; name?: string } }) => {
      const response = await api.patch(`/v1/reports-email/recipients/${id}`, data)
      return response.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-recipients'] }),
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to update recipient'))
  })
}

export function useDeleteRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/v1/reports-email/recipients/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-recipients'] })
      toast.success('Recipient removed')
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove recipient'))
  })
}

export function useWeeklyTripsPreview(weekStart: string, enabled = true) {
  return useQuery<WeeklyTripsPreview>({
    queryKey: ['weekly-trips-preview', weekStart],
    queryFn: async () => {
      const response = await api.get(
        `/v1/reports-email/weekly-trips/preview?week_start=${weekStart}`
      )
      return response.data
    },
    enabled
  })
}

export function useSendWeeklyTrips() {
  return useMutation({
    mutationFn: async ({ weekStart, to }: { weekStart: string; to?: string }) => {
      const qs = new URLSearchParams({ week_start: weekStart })
      if (to) qs.set('to', to)
      const response = await api.post(`/v1/reports-email/weekly-trips/send?${qs}`)
      return response.data as SendResult
    },
    onSuccess: (result) => {
      // Console transport means the message was only logged, never delivered.
      // Saying "sent" here would be a lie the user acts on.
      if (!result.delivered) {
        toast.error(
          `Email is not configured — the report was logged, not delivered. ` +
          `Set SES_FROM_EMAIL or SMTP credentials.`,
          { duration: 8000 }
        )
        return
      }
      if (result.failed > 0) {
        toast.error(`Sent to ${result.sent}, failed for ${result.failed}`)
      } else {
        toast.success(`Report sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}`)
      }
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to send report'))
  })
}
