'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export type RtoSection = 'variable' | 'fixed' | 'summary'

export interface RtoRow {
  id: number
  company_id: number
  section: RtoSection
  expense: string
  miles: number
  rate_per_mile: number
  total: number
  sort_order: number
  created_at: string
  updated_at?: string
}

export interface RtoCreate {
  section: RtoSection
  expense?: string
  miles?: number
  rate_per_mile?: number
  total?: number
  sort_order?: number
}

export interface RtoUpdate {
  section?: RtoSection
  expense?: string
  miles?: number
  rate_per_mile?: number
  total?: number
  sort_order?: number
}

const BASE = '/v1/rate-to-operate'

export function useRateToOperate() {
  return useQuery({
    queryKey: ['rate-to-operate'],
    queryFn: async (): Promise<RtoRow[]> => {
      const res = await api.get(`${BASE}/`)
      const items = Array.isArray(res.data) ? res.data : []
      return items.map((r: any) => ({
        ...r,
        miles: Number(r.miles),
        rate_per_mile: Number(r.rate_per_mile),
        total: Number(r.total),
      }))
    },
    // Refetch on window focus for near-real-time multi-user sync
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })
}

export function useCreateRto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: RtoCreate): Promise<RtoRow> => {
      const res = await api.post(`${BASE}/`, data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-to-operate'] }),
    onError: () => toast.error('Failed to create row'),
  })
}

export function useUpdateRto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RtoUpdate }): Promise<RtoRow> => {
      const res = await api.put(`${BASE}/${id}`, data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-to-operate'] }),
    onError: () => toast.error('Failed to save row'),
  })
}

export function useDeleteRto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`${BASE}/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-to-operate'] }),
    onError: () => toast.error('Failed to delete row'),
  })
}
