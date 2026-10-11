import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// One line item on the Payroll page (see backend app/models/payroll_layout.py).
//   kind: earning adds to net pay, deduction subtracts, info (miles) is shown only
//   mode: auto = calculated from loads / fuel cards, fixed = same weekly amount
//         every week (per driver), variable = entered week by week
export interface PayrollRow {
  key: string
  label: string
  kind: 'earning' | 'deduction' | 'info'
  mode: 'auto' | 'fixed' | 'variable'
  hidden: boolean
  builtin: boolean
  amounts: Record<string, number> // driver_id -> weekly amount, fixed custom rows only
}

// Built-in rows whose mode can be switched between fixed and variable.
export const SWITCHABLE_ROWS = new Set(['insurance', 'parking', 'trailer', 'misc'])

export const LAYOUT_KEY = ['payroll-layout']

export function usePayrollLayout() {
  return useQuery<PayrollRow[]>({
    queryKey: LAYOUT_KEY,
    queryFn: async () => (await api.get('/v1/payroll-layout/')).data.rows,
  })
}

export function useSavePayrollLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: PayrollRow[]): Promise<PayrollRow[]> =>
      (await api.put('/v1/payroll-layout/', { rows })).data.rows,
    onMutate: async (rows) => {
      await queryClient.cancelQueries({ queryKey: LAYOUT_KEY })
      const previous = queryClient.getQueryData<PayrollRow[]>(LAYOUT_KEY)
      queryClient.setQueryData(LAYOUT_KEY, rows)
      return { previous }
    },
    onError: (error: any, _rows, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(LAYOUT_KEY, ctx.previous)
      toast.error(error.response?.data?.detail || 'Could not save payroll rows')
    },
    onSuccess: (rows) => queryClient.setQueryData(LAYOUT_KEY, rows),
  })
}
