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
        const response = await api.get('/auth/me')
        return response.data
      } catch (error) {
        // Fall back to demo user if token exists
        if (token === 'demo_token_123') {
          return {
            id: 1,
            email: "admin@example.com",
            name: "Demo Admin",
            company_id: 1
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
      try {
        const response = await api.post('/auth/login', credentials)
        return response.data
      } catch (error) {
        // Fall back to demo auth
        const formData = new FormData()
        formData.append('username', credentials.email)
        formData.append('password', credentials.password)

        const response = await api.post('/demo/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        return response.data
      }
    },
    onSuccess: (data) => {
      Cookies.set('auth-token', data.access_token, { expires: 7 }) // 7 days
      // Set demo user data
      const demoUser = {
        id: 1,
        email: "admin@example.com",
        name: "Demo Admin",
        company_id: 1
      }
      queryClient.setQueryData(['user'], demoUser)
      toast.success('Login successful! (Demo Mode)')
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