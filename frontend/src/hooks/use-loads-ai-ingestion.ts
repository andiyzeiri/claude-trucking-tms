'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface IngestionStatus {
  enabled: boolean
  mailbox: string | null
  credentials_configured: boolean
  extraction_configured: boolean
  auto_create_loads: boolean
  poll_minutes: number
  mailbox_matches_company: boolean
  /** Human-readable reasons ingestion can't run. Empty means it's ready. */
  blockers: string[]
}

export interface IngestSummary {
  enabled: boolean
  mailbox: string | null
  messages_seen: number
  messages_new: number
  documents_created: number
  duplicates: number
  unsupported: number
  loads_created: number
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
      // Created loads land in the real loads table, so the board is stale.
      queryClient.invalidateQueries({ queryKey: ['loads'] })

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
      if (s.loads_created) bits.push(`${s.loads_created} load(s) created`)
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
