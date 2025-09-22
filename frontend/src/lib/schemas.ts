import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  license_number: z.string().min(1, 'License number is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  status: z.enum(['available', 'on_trip', 'off_duty']).default('available'),
})

export const truckSchema = z.object({
  truck_number: z.string().min(1, 'Truck number is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  vin: z.string().optional(),
  license_plate: z.string().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'out_of_service']).default('available'),
})

export const loadSchema = z.object({
  load_number: z.string().min(1, 'Load number is required'),
  customer_id: z.number().min(1, 'Customer is required'),
  driver_id: z.number().optional(),
  truck_id: z.number().optional(),
  pickup_location: z.string().min(1, 'Pickup location is required'),
  pickup_date: z.string().min(1, 'Pickup date is required'),
  delivery_location: z.string().min(1, 'Delivery location is required'),
  delivery_date: z.string().min(1, 'Delivery date is required'),
  weight: z.number().positive().optional(),
  rate: z.number().positive('Rate must be positive'),
  status: z.enum(['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']).default('pending'),
  notes: z.string().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type CustomerFormData = z.infer<typeof customerSchema>
export type DriverFormData = z.infer<typeof driverSchema>
export type TruckFormData = z.infer<typeof truckSchema>
export type LoadFormData = z.infer<typeof loadSchema>