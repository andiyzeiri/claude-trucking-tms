'use client'

import Sidebar from './sidebar'
import Header from './header'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <ProtectedRoute requireAuth={true}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}