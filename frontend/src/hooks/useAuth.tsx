'use client'

import { useState, useEffect, useContext, createContext } from 'react'
import { auth, User, AuthState } from '@/lib/auth'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const refreshUser = async () => {
    if (!auth.getToken()) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }

    try {
      const user = await auth.getCurrentUser()
      setState({
        user,
        isAuthenticated: !!user,
        isLoading: false,
      })
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const { user } = await auth.login(email, password)
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      throw error
    }
  }

  const logout = async () => {
    await auth.logout()
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }

  useEffect(() => {
    refreshUser()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}