import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// Payroll > Debt tab (backend app/api/v1/endpoints/driver_debts.py).
// Money arrives as decimal strings; convert with Number() for display only.
export interface DebtHistoryItem {
  id: number | null // hand-entered rows can be deleted
  date: string // YYYY-MM-DD
  kind: 'debt' | 'payment' | 'payroll'
  amount: string
  note: string | null
  week: string | null // "2026-41" for payroll payments
  balance: string
}

export interface DriverDebt {
  driver_id: number
  driver_name: string
  driver_type: string
  balance: string
  total_debt: string
  total_paid: string
  weekly_amount: string
  last_payment_date: string | null
  last_payment_amount: string | null
  history: DebtHistoryItem[]
}

export interface DebtSummary {
  drivers: DriverDebt[]
  // "2026-41" -> { driver_id: amount } the Debt Payment row filled in automatically
  schedule: Record<string, Record<string, string>>
}

export const DEBTS_KEY = ['driver-debts']

export function useDriverDebts() {
  return useQuery<DebtSummary>({
    queryKey: DEBTS_KEY,
    queryFn: async () => (await api.get('/v1/driver-debts/')).data,
  })
}

function useDebtMutation<T>(fn: (input: T) => Promise<DebtSummary>, success?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (summary) => {
      queryClient.setQueryData(DEBTS_KEY, summary)
      if (success) toast.success(success)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail?.toString?.() || 'Could not save'),
  })
}

export function useAddDebtEntry() {
  return useDebtMutation(
    async (entry: { driver_id: number; kind: 'debt' | 'payment'; amount: number; entry_date: string; note?: string }) =>
      (await api.post('/v1/driver-debts/entries', entry)).data,
    'Saved',
  )
}

export function useDeleteDebtEntry() {
  return useDebtMutation(async (id: number) => (await api.delete(`/v1/driver-debts/entries/${id}`)).data, 'Removed')
}

export function useSetDebtPlan() {
  return useDebtMutation(
    async ({ driver_id, weekly_amount }: { driver_id: number; weekly_amount: number }) =>
      (await api.put(`/v1/driver-debts/plans/${driver_id}`, { weekly_amount })).data,
  )
}
