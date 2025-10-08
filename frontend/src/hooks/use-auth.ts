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
        // Invalid token, remove it
        Cookies.remove('auth-token')
        return null
      }
    },
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      console.log('[Auth] Login attempt for:', credentials.email)
      const response = await api.post('/v1/auth/login-json', {
        username_or_email: credentials.email,
        password: credentials.password
      })
      console.log('[Auth] Login response:', response.data)
      // Set cookie immediately after successful response
      if (response.data.access_token) {
        console.log('[Auth] Setting auth-token cookie')
        Cookies.set('auth-token', response.data.access_token, { expires: 7 })
      }
      return response.data
    },
    onSuccess: (data) => {
      console.log('[Auth] onSuccess callback triggered')
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