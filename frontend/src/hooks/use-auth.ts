'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { AuthResponse, LoginCredentials, User } from '@/types'

export function useAuth() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async (): Promise<User | null> => {
      const token = Cookies.get('auth-token')
      if (!token) return null

      try {
        const response = await api.get('/v1/users/me')
        return response.data
      } catch (error) {
        // Fall back to demo user if token exists
        if (token === 'demo_token_123') {
          return {
            id: 1,
            username: "demoadmin",
            email: "admin@example.com",
            first_name: "Demo",
            last_name: "Admin",
            full_name: "Demo Admin",
            name: "Demo Admin",
            is_active: true,
            email_verified: true,
            role: "company_admin",
            company_id: 1,
            allowed_pages: ["dashboard", "loads", "drivers", "trucks", "customers", "invoices", "reports", "payroll", "lanes", "settings"]
          }
        }
        Cookies.remove('auth-token')
        return null
      }
    },
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      const response = await api.post('/auth/login', credentials)
      return response.data
    },
    onSuccess: (data) => {
      Cookies.set('auth-token', data.access_token, { expires: 7 }) // 7 days
      queryClient.setQueryData(['user'], data.user)
      toast.success('Login successful!')
      router.push('/dashboard')
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Login failed'
      toast.error(message)
    },
  })

  const logout = () => {
    Cookies.remove('auth-token')
    queryClient.setQueryData(['user'], null)
    queryClient.clear()
    router.push('/login')
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout,
  }
}