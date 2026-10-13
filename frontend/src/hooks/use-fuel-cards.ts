import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// WEX Fleet One / EFS fuel card feed over SFTP (backend app/api/v1/endpoints/fuel_cards.py).
// Money arrives as decimal strings; convert with Number() for display only.
export interface FuelCardConnection {
  connected: boolean
  provider: string | null
  host: string | null
  port: number | null
  remote_dir: string | null
  username: string | null
  import_from: string | null
  last_sync_at: string | null
  last_sync_result: string | null
  last_error: string | null
  needs_truck: number
}

export interface FuelCardSync {
  imported: number
  linked: number
  needs_truck: number
  not_fuel: number
  skipped: number
  files: number
  connection: FuelCardConnection
}

export interface FuelCardTransaction {
  id: number
  external_id: string
  transaction_date: string | null
  card_last6: string | null
  unit: string | null
  driver_prompt: string | null
  location: string | null
  fuel_gallons: string
  fuel_amount: string
  def_gallons: string
  def_amount: string
  other_items: string | null
  net_total: string
  status: 'imported' | 'linked' | 'needs_truck' | 'not_fuel'
  truck_id: number | null
  truck_number: string | null
  fuel_id: number | null
}

const CONNECTION_KEY = ['fuel-card-connection']
const errorText = (error: any, fallback: string) => error?.response?.data?.detail?.toString?.() || fallback

// New Fuel entries change the Fuel page and payroll's Fuel row.
function refreshAfterImport(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['fuel'] })
  queryClient.invalidateQueries({ queryKey: ['payroll'] })
  queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
}

const syncMessage = (r: FuelCardSync) => {
  if (!r.files) return 'No new files from WEX yet'
  const parts = [`${r.files} new file${r.files === 1 ? '' : 's'}: ${r.imported} imported`]
  if (r.linked) parts.push(`${r.linked} matched to entries already typed in`)
  if (r.needs_truck) parts.push(`${r.needs_truck} need a truck`)
  return parts.join(', ')
}

export function useFuelCardConnection() {
  return useQuery<FuelCardConnection>({
    queryKey: CONNECTION_KEY,
    queryFn: async () => (await api.get('/v1/fuel-cards/connection')).data,
  })
}

export function useConnectFuelCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { host: string; port: number; remote_dir: string; username: string; password: string; import_from: string }): Promise<FuelCardSync> =>
      (await api.put('/v1/fuel-cards/connection', body, { timeout: 180000 })).data,
    onSuccess: (r) => {
      queryClient.setQueryData(CONNECTION_KEY, r.connection)
      refreshAfterImport(queryClient)
      toast.success(`WEX connected. ${syncMessage(r)}`)
    },
    onError: (error: any) => toast.error(errorText(error, 'Could not connect to WEX SFTP')),
  })
}

export function useSyncFuelCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<FuelCardSync> => (await api.post('/v1/fuel-cards/sync', null, { timeout: 180000 })).data,
    onSuccess: (r) => {
      queryClient.setQueryData(CONNECTION_KEY, r.connection)
      refreshAfterImport(queryClient)
      toast.success(syncMessage(r))
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: CONNECTION_KEY })
      toast.error(errorText(error, 'Sync failed'))
    },
  })
}

export function useDisconnectFuelCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<FuelCardConnection> => (await api.delete('/v1/fuel-cards/connection')).data,
    onSuccess: (conn) => {
      queryClient.setQueryData(CONNECTION_KEY, conn)
      toast.success('WEX fuel card disconnected')
    },
    onError: (error: any) => toast.error(errorText(error, 'Could not disconnect')),
  })
}

export function useFuelCardTransactions(status: FuelCardTransaction['status'] | null, enabled: boolean) {
  return useQuery<FuelCardTransaction[]>({
    queryKey: ['fuel-card-transactions', status],
    queryFn: async () => (await api.get('/v1/fuel-cards/transactions', { params: status ? { status } : {} })).data,
    enabled,
  })
}

export function useSetCardTruck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { card_last6: string; truck_id: number | null }): Promise<FuelCardConnection> =>
      (await api.put('/v1/fuel-cards/card-map', body)).data,
    onSuccess: (conn) => {
      queryClient.setQueryData(CONNECTION_KEY, conn)
      refreshAfterImport(queryClient)
      toast.success('Card matched')
    },
    onError: (error: any) => toast.error(errorText(error, 'Could not match the card')),
  })
}
