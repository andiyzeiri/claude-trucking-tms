import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'

// Helper to extract error message from Pydantic validation errors
function getErrorMessage(error: any, fallback: string): string {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const firstError = detail[0]
    if (firstError.msg) {
      const field = firstError.loc?.slice(-1)[0] || 'field'
      return `${field}: ${firstError.msg}`
    }
  }
  return fallback
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type NormalBalance = 'debit' | 'credit'
export type JournalStatus = 'draft' | 'posted' | 'void'
export type JournalSource = 'manual' | 'invoice' | 'fuel' | 'expense' | 'payroll'
export type MappingEvent = 'invoice' | 'fuel' | 'expense' | 'payroll'

export interface Account {
  id: number
  code: string
  name: string
  type: AccountType
  normal_balance: NormalBalance
  description?: string | null
  parent_id?: number | null
  is_active: boolean
  company_id: number
}

export interface JournalLine {
  id: number
  account_id: number
  account_code?: string | null
  account_name?: string | null
  line_number: number
  debit: string | number
  credit: string | number
  memo?: string | null
}

export interface JournalEntry {
  id: number
  entry_number?: string | null
  entry_date: string
  memo?: string | null
  status: JournalStatus
  source: JournalSource
  source_id?: number | null
  posted_at?: string | null
  reverses_id?: number | null
  company_id: number
  lines: JournalLine[]
  total_debit: string | number
  total_credit: string | number
}

export interface JournalLineInput {
  account_id: number
  debit?: number
  credit?: number
  memo?: string
}

export interface TrialBalanceRow {
  account_id: number
  code: string
  name: string
  type: AccountType
  normal_balance: NormalBalance
  debit: string | number
  credit: string | number
}

export interface TrialBalance {
  as_of: string
  rows: TrialBalanceRow[]
  total_debit: string | number
  total_credit: string | number
  is_balanced: boolean
}

export interface StatementLine {
  account_id: number
  code: string
  name: string
  amount: string | number
}

export interface IncomeStatement {
  start_date: string
  end_date: string
  revenue: StatementLine[]
  expenses: StatementLine[]
  total_revenue: string | number
  total_expenses: string | number
  net_income: string | number
}

export interface BalanceSheet {
  as_of: string
  assets: StatementLine[]
  liabilities: StatementLine[]
  equity: StatementLine[]
  total_assets: string | number
  total_liabilities: string | number
  total_equity: string | number
  retained_earnings: string | number
  is_balanced: boolean
}

export interface AccountingMapping {
  id: number
  event_key: MappingEvent
  debit_account_id: number
  credit_account_id: number
  debit_account?: Account | null
  credit_account?: Account | null
}

// Amounts arrive as strings from the backend (Decimal serialization).
// Never do math on them without going through this.
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}

// --------------------------------------------------------------------------
// Chart of accounts
// --------------------------------------------------------------------------

export function useAccounts(params?: { type?: AccountType; is_active?: boolean }) {
  return useQuery<Account[]>({
    queryKey: ['accounting', 'accounts', params],
    queryFn: async () => {
      const search = new URLSearchParams()
      if (params?.type) search.set('type', params.type)
      if (params?.is_active !== undefined) search.set('is_active', String(params.is_active))
      const qs = search.toString()
      const response = await api.get(`/v1/accounting/accounts${qs ? `?${qs}` : ''}`)
      return response.data
    }
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      code: string
      name: string
      type: AccountType
      normal_balance?: NormalBalance
      description?: string
      parent_id?: number | null
      is_active?: boolean
    }) => {
      const response = await api.post('/v1/accounting/accounts', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Account created')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create account'))
    }
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Account> }) => {
      const response = await api.patch(`/v1/accounting/accounts/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Account updated')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update account'))
    }
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/v1/accounting/accounts/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Account deleted')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete account'))
    }
  })
}

// --------------------------------------------------------------------------
// Journal entries
// --------------------------------------------------------------------------

export function useJournalEntries(params?: {
  status?: JournalStatus
  source?: JournalSource
  start?: string
  end?: string
  account_id?: number
}) {
  return useQuery<JournalEntry[]>({
    queryKey: ['accounting', 'journal-entries', params],
    queryFn: async () => {
      const search = new URLSearchParams()
      if (params?.status) search.set('status', params.status)
      if (params?.source) search.set('source', params.source)
      if (params?.start) search.set('start', params.start)
      if (params?.end) search.set('end', params.end)
      if (params?.account_id) search.set('account_id', String(params.account_id))
      const qs = search.toString()
      const response = await api.get(`/v1/accounting/journal-entries${qs ? `?${qs}` : ''}`)
      return response.data
    }
  })
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      data,
      post
    }: {
      data: { entry_date: string; memo?: string; lines: JournalLineInput[] }
      post?: boolean
    }) => {
      const response = await api.post(
        `/v1/accounting/journal-entries${post ? '?post=true' : ''}`,
        data
      )
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success(variables.post ? 'Entry posted' : 'Draft saved')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to save entry'))
    }
  })
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/v1/accounting/journal-entries/${id}/post`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Entry posted')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to post entry'))
    }
  })
}

export function useReverseJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: number; memo?: string }) => {
      const response = await api.post(`/v1/accounting/journal-entries/${id}/reverse`, {
        memo
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Reversing entry posted')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to reverse entry'))
    }
  })
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/v1/accounting/journal-entries/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Draft deleted')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete draft'))
    }
  })
}

// --------------------------------------------------------------------------
// Reports
// --------------------------------------------------------------------------

export function useTrialBalance(asOf?: string) {
  return useQuery<TrialBalance>({
    queryKey: ['accounting', 'trial-balance', asOf],
    queryFn: async () => {
      const response = await api.get(
        `/v1/accounting/trial-balance${asOf ? `?as_of=${asOf}` : ''}`
      )
      return response.data
    }
  })
}

export function useIncomeStatement(start?: string, end?: string) {
  return useQuery<IncomeStatement>({
    queryKey: ['accounting', 'income-statement', start, end],
    queryFn: async () => {
      const search = new URLSearchParams()
      if (start) search.set('start', start)
      if (end) search.set('end', end)
      const qs = search.toString()
      const response = await api.get(`/v1/accounting/income-statement${qs ? `?${qs}` : ''}`)
      return response.data
    }
  })
}

export function useBalanceSheet(asOf?: string) {
  return useQuery<BalanceSheet>({
    queryKey: ['accounting', 'balance-sheet', asOf],
    queryFn: async () => {
      const response = await api.get(
        `/v1/accounting/balance-sheet${asOf ? `?as_of=${asOf}` : ''}`
      )
      return response.data
    }
  })
}

// --------------------------------------------------------------------------
// Auto-post mappings
// --------------------------------------------------------------------------

export function useAccountingMappings() {
  return useQuery<AccountingMapping[]>({
    queryKey: ['accounting', 'mappings'],
    queryFn: async () => {
      const response = await api.get('/v1/accounting/mappings')
      return response.data
    }
  })
}

export function useUpsertMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      event_key: MappingEvent
      debit_account_id: number
      credit_account_id: number
    }) => {
      const response = await api.put(`/v1/accounting/mappings/${data.event_key}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Auto-post mapping saved')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to save mapping'))
    }
  })
}

export function useDeleteMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (eventKey: MappingEvent) => {
      await api.delete(`/v1/accounting/mappings/${eventKey}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Mapping removed')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to remove mapping'))
    }
  })
}
