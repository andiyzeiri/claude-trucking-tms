'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface IngestionStatus {
  enabled: boolean
  mailbox: string | null
  credentials_configured: boolean
  extraction_configured: boolean
  poll_minutes: number
  mailbox_matches_company: boolean
  /** Human-readable reasons ingestion can't run. Empty means it's ready. */
  blockers: string[]
  pod_mailbox?: string | null
  pod_credentials_configured?: boolean
  pod_mailbox_matches_company?: boolean
  pod_blockers?: string[]
}

export interface IngestSummary {
  enabled: boolean
  mailbox: string | null
  messages_seen: number
  messages_new: number
  documents_created: number
  duplicates: number
  retried?: number
  unsupported: number
  loads_created: number
  unverified_created?: number
  unverified_verified?: number
  pods_attached?: number
  pods_unmatched?: number
  not_loads?: number
  needs_review: number
  failed: number
  errors: string[]
  notes: string[]
}

export interface IngestedDocument {
  id: number
  original_filename: string | null
  content_type: string | null
  status: string
  doc_type: string | null
  load_id: number | null
  load_number: string | null
  warnings: string[]
  draft: Record<string, any> | null
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  last_error: string | null
  created_at: string | null
}

export function useIngestionStatus() {
  return useQuery({
    queryKey: ['loads-ai-ingestion-status'],
    queryFn: async (): Promise<IngestionStatus> => {
      const response = await api.get('/v1/loads-ai/ingestion-status')
      return response.data
    },
    retry: false,
  })
}

export function useIngestedDocuments() {
  return useQuery({
    queryKey: ['loads-ai-documents'],
    queryFn: async (): Promise<IngestedDocument[]> => {
      const response = await api.get('/v1/loads-ai/documents?limit=25')
      return response.data
    },
    retry: false,
  })
}

export function usePollMailbox() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (): Promise<IngestSummary> => {
      // A cycle reads mail and runs a model call per document, so it can take
      // well over the default axios timeout.
      const response = await api.post('/v1/loads-ai/poll', {}, { timeout: 300_000 })
      return response.data
    },
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['loads-ai-documents'] })
      // New AI loads appear in the Loads AI table. The real loads table is
      // never touched by ingestion, so ['loads'] is deliberately left alone.
      queryClient.invalidateQueries({ queryKey: AI_LOADS_KEY })
      queryClient.invalidateQueries({ queryKey: UNVERIFIED_KEY })

      if (s.errors.length) {
        toast.error(s.errors[0])
        return
      }
      if (!s.enabled) {
        toast.error('Email ingestion is switched off on the server')
        return
      }
      if (s.messages_new === 0) {
        toast.success('No new email with attachments')
        return
      }
      const bits = [`${s.messages_new} new email(s)`]
      if (s.loads_created) bits.push(`${s.loads_created} AI load(s) added`)
      if (s.unverified_created) bits.push(`${s.unverified_created} Highway load(s) waiting for ratecon`)
      if (s.pods_attached) bits.push(`${s.pods_attached} POD(s) attached`)
      if (s.pods_unmatched) bits.push(`${s.pods_unmatched} POD(s) need matching`)
      if (s.needs_review) bits.push(`${s.needs_review} need review`)
      if (s.duplicates) bits.push(`${s.duplicates} duplicate(s) skipped`)
      toast.success(bits.join(' · '))
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail
      toast.error(
        typeof detail === 'string'
          ? detail
          : error?.code === 'ECONNABORTED'
          ? 'Reading the mailbox timed out.'
          : 'Failed to check the mailbox.'
      )
    },
  })

  return { pollMailbox: mutation.mutateAsync, isPolling: mutation.isPending }
}

// --- AI loads ---------------------------------------------------------------
// Loads read from documents. Stored server-side on the ingested document,
// never in the real loads table, and shown only on the Loads AI page.

export const AI_LOADS_KEY = ['loads-ai-loads'] as const

export interface AILoad {
  /** ingested_documents id - the AI load's identity */
  id: number
  source: string
  original_filename: string | null
  document_status: string
  warnings: string[]
  created_at: string | null
  /** Load-shaped fields (load_number, pickup_location, rate, ...) */
  fields: Record<string, any>
  /** How the customer was resolved: exact = green, partial = orange, none = red */
  customer_match: CustomerMatch
  customer_match_reason: string | null
  /** Broker as printed on the document */
  broker_name: string | null
  customer_candidates: { id: number; name: string; score: number; reason: string }[]
  /** Last time the driver was texted for this load's POD. */
  pod_requested_at?: string | null
}

export type CustomerMatch = 'exact' | 'partial' | 'none'

export function useAILoads() {
  return useQuery({
    queryKey: AI_LOADS_KEY,
    queryFn: async (): Promise<AILoad[]> => {
      const response = await api.get('/v1/loads-ai/loads')
      return response.data
    },
    retry: false,
  })
}

export function useCreateAILoad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, any>): Promise<AILoad> => {
      const response = await api.post('/v1/loads-ai/loads', data)
      return response.data
    },
    // An uploaded ratecon can verify a Highway notice, so refresh both tables.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_LOADS_KEY })
      queryClient.invalidateQueries({ queryKey: UNVERIFIED_KEY })
    },
  })
}

export function useUpdateAILoad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }): Promise<AILoad> => {
      const response = await api.patch(`/v1/loads-ai/loads/${id}`, data)
      return response.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_LOADS_KEY }),
  })
}

export function useDeleteAILoad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/loads-ai/loads/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_LOADS_KEY }),
  })
}

// --- Unverified loads ---------------------------------------------------
// Loads announced by a Highway notice whose rate confirmation hasn't arrived.
// Verified automatically when a ratecon with the same load number comes in.

export const UNVERIFIED_KEY = ['loads-ai-unverified'] as const

export interface UnverifiedLoad {
  id: number
  source: string
  load_number: string | null
  broker_name: string | null
  broker_contact: string | null
  received_at: string | null
}

export function useUnverifiedLoads() {
  return useQuery({
    queryKey: UNVERIFIED_KEY,
    queryFn: async (): Promise<UnverifiedLoad[]> => (await api.get('/v1/loads-ai/unverified')).data,
    retry: false,
  })
}

export function useDismissUnverified() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/v1/loads-ai/unverified/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNVERIFIED_KEY })
      toast.success('Unverified load removed')
    },
    onError: () => toast.error('Could not remove the unverified load'),
  })
}

// --- Request POD ------------------------------------------------------------
// Texts the AI load's assigned driver for the signed POD right away.

export function useRequestPod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (aiLoadId: number): Promise<{ sent: boolean; message: string }> =>
      (await api.post(`/v1/loads-ai/loads/${aiLoadId}/request-pod`)).data,
    onSuccess: (r) => {
      if (r.sent) toast.success(r.message)
      else toast(r.message)
      queryClient.invalidateQueries({ queryKey: AI_LOADS_KEY })
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not send the POD request')
    },
  })
}
