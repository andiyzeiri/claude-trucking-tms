export interface UserPermissions {
  can_view_loads: boolean
  can_create_loads: boolean
  can_edit_loads: boolean
  can_delete_loads: boolean
  can_view_drivers: boolean
  can_manage_drivers: boolean
  can_view_trucks: boolean
  can_manage_trucks: boolean
  can_view_customers: boolean
  can_manage_customers: boolean
  can_view_invoices: boolean
  can_manage_invoices: boolean
  can_view_reports: boolean
  can_manage_users: boolean
  can_manage_company: boolean
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  name?: string // For backward compatibility
  is_active: boolean
  email_verified: boolean
  email_verified_at?: string
  role: string
  company_id: number
  page_permissions?: { pages: string[] }
  allowed_pages?: string[]
  permissions?: UserPermissions
  created_at?: string
  updated_at?: string
}

export interface Customer {
  id: number
  name: string
  mc?: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface Driver {
  id: number
  first_name: string
  last_name: string
  license_number: string
  phone?: string
  email?: string
  status: 'available' | 'on_trip' | 'off_duty'
  driver_type: 'company' | 'owner_operator'
  date_hired?: string
  date_terminated?: string
  date_of_birth?: string
  experience?: string
  mvr_expiry?: string
  medical_card_expiry?: string
  has_fuel_card?: boolean
  fuel_card_number?: string
  created_at: string
  updated_at: string
}

export interface Truck {
  id: number
  type: 'truck' | 'trailer'
  truck_number: string
  make?: string
  model?: string
  year?: number
  vin?: string
  license_plate?: string
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service'
  created_at: string
  updated_at: string
}

export interface Load {
  id: number
  load_number: string
  customer_id: number
  customer?: Customer
  driver_id?: number
  driver?: Driver
  truck_id?: number
  truck?: Truck
  pickup_location: string
  pickup_date: string
  delivery_location: string
  delivery_date: string
  weight?: number
  miles?: number
  rate: number
  carrier_rate?: number
  pickup_notes?: string
  delivery_notes?: string
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled'
  notes?: string
  pod_url?: string
  ratecon_url?: string
  adjustment_type?: 'lumper' | 'detention' | 'layover' | 'pickup' | 'delivery' | null
  adjustment_amount?: number | null
  needs_attention?: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  date: string
  category: string
  cost_type: string
  expense_group: string
  description?: string
  amount: number
  vendor?: string
  payment_method?: string
  receipt_number?: string
  driver_id?: number
  driver?: Driver
  truck_id?: number
  truck?: Truck
  load_id?: number
  company_id: number
  created_at: string
  updated_at: string
}

export interface Fuel {
  id: number
  date: string
  location?: string
  gallons: number
  price_per_gallon?: number
  def_gallons?: number
  def_price?: number
  total_amount: number
  odometer?: number
  notes?: string
  driver_id?: number
  driver?: Driver
  truck_id?: number
  truck?: Truck
  load_id?: number
  company_id: number
  created_at: string
  updated_at?: string
}

export interface Shipper {
  id: number
  name: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  contact_person?: string
  email?: string
  product_type?: string
  average_wait_time?: string
  appointment_type?: string
  notes?: string
  company_id: number
  created_at: string
  updated_at?: string
}

export interface Receiver {
  id: number
  name: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  contact_person?: string
  email?: string
  product_type?: string
  average_wait_time?: string
  appointment_type?: string
  notes?: string
  company_id: number
  created_at: string
  updated_at?: string
}

export interface Ratecon {
  id: number
  ratecon_number: string
  load_number?: string
  broker_name: string
  carrier_name?: string
  date_issued?: string
  pickup_date?: string
  delivery_date?: string
  pickup_location?: string
  delivery_location?: string
  total_rate?: number
  fuel_surcharge?: number
  detention_rate?: number
  layover_rate?: number
  commodity?: string
  weight?: number
  pieces?: number
  equipment_type?: string
  broker_contact?: string
  broker_phone?: string
  broker_email?: string
  payment_terms?: string
  special_instructions?: string
  notes?: string
  status?: string
  document_url?: string
  company_id: number
  created_at: string
  updated_at?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}