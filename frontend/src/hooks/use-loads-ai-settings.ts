'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface LoadsAISettings {
  /** Mailbox Loads AI draws loads from. null when no source is configured. */
  source_email: string | null
}

export function useLoadsAISettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['loads-ai-settings'],
    queryFn: async (): Promise<LoadsAISettings> => {
      const response = await api.get('/v1/loads-ai/settings')
      return response.data
    },
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<LoadsAISettings>): Promise<LoadsAISettings> => {
      const response = await api.put('/v1/loads-ai/settings', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['loads-ai-settings'], data)
      toast.success(
        data.source_email
          ? `Loads AI will draw from ${data.source_email}`
          : 'Loads AI source mailbox cleared'
      )
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      // FastAPI returns a 422 body as an array of per-field errors; surface the
      // validator's own message (e.g. "Invalid email address: ...") rather than
      // a generic failure.
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((e: any) => e.msg).join(', ')
          : 'Failed to update Loads AI source mailbox'
      toast.error(message)
    },
  })

  return {
    settings,
    sourceEmail: settings?.source_email ?? null,
    isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
