'use client'

import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'

/** Proposed Load column values read off a document. Nothing is persisted. */
export interface LoadDraft {
  load_number: string | null
  reference_number: string | null
  broker_load_number: string | null
  bol_number: string | null
  po_number: string | null
  customer_id: number | null
  pickup_location: string | null
  delivery_location: string | null
  /** Wall-clock UTC, e.g. "2025-10-03T08:00:00" (no timezone suffix). */
  pickup_date: string | null
  delivery_date: string | null
  /** Money arrives as a string so no float touches a rate on the wire. */
  rate: string | null
  fuel_surcharge: string | null
  accessorial_charges: string | null
  miles: number | null
  description: string | null
  pickup_notes: string | null
  status: string
}

export interface ExtractedFieldInfo {
  value: string | null
  confidence: number
  source_text: string | null
}

export interface CustomerCandidate {
  id: number
  name: string
  mc: string | null
  score: number
  reason: string
}

export interface ExtractionUsage {
  provider: string
  model: string
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  prompt_version: string
  schema_version: string
}

export interface ExtractDocumentResult {
  filename: string | null
  content_type: string
  doc_type: string | null
  doc_type_confidence: number | null
  draft: LoadDraft
  fields: Record<string, ExtractedFieldInfo>
  customer_candidates: CustomerCandidate[]
  warnings: string[]
  usage: ExtractionUsage
}

export function useExtractDocument() {
  const mutation = useMutation({
    mutationFn: async (file: File): Promise<ExtractDocumentResult> => {
      const form = new FormData()
      form.append('file', file)
      const response = await api.post('/v1/loads-ai/extract', form, {
        // Let the browser set the multipart boundary; the shared axios client
        // defaults to application/json, which would break the upload.
        headers: { 'Content-Type': 'multipart/form-data' },
        // Reading a document takes appreciably longer than a normal request.
        timeout: 120_000,
      })
      return response.data
    },
  })

  return {
    extractDocument: mutation.mutateAsync,
    isExtracting: mutation.isPending,
  }
}

/** Pull a readable message out of a FastAPI error body. */
export function extractionErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg).join(', ')
  if (error?.code === 'ECONNABORTED') {
    return 'Reading the document timed out. Try a smaller file.'
  }
  return 'Failed to read the document.'
}
