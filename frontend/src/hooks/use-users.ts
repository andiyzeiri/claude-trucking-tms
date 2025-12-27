'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { User, PaginatedResponse } from '@/types'

export interface CreateUserData {
  username: string
  email: string
  first_name: string
  last_name: string
  password: string
  role: string
  send_invitation?: boolean
}

export interface UpdateUserData {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  password?: string
  role?: string
  is_active?: boolean
  page_permissions?: { pages: string[] }
}

export interface CreateUserResponse {
  message: string
  user_id: number
  username: string
  email: string
  temporary_password?: string
  role: string
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const response = await api.get('/v1/users/company-users')
      return Array.isArray(response.data) ? response.data : []
    },
    retry: false,
  })
}

export function useUser(id: number) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async (): Promise<User> => {
      const response = await api.get(`/v1/users/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserData): Promise<CreateUserResponse> => {
      const response = await api.post('/v1/users/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(data.message || 'User created successfully')
    },
    onError: (error: any) => {
      console.error('useCreateUser error:', error.response?.data)
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.join('.') || ''}: ${e.msg}`).join(', ')
        : 'Failed to create user'
      toast.error(message)
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateUserData }): Promise<{ message: string; user: User }> => {
      const response = await api.put(`/v1/users/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      toast.success('User updated successfully')
    },
    onError: (error: any) => {
      console.error('useUpdateUser error:', error.response?.data)
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.join('.') || ''}: ${e.msg}`).join(', ')
        : 'Failed to update user'
      toast.error(message)
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
    },
    onError: (error: any) => {
      console.error('useDeleteUser error:', error.response?.data)
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : 'Failed to delete user'
      toast.error(message)
    },
  })
}
