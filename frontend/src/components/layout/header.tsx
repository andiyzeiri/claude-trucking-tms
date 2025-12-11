'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-end px-6" style={{ borderBottom: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" style={{ color: 'var(--monday-text-secondary)' }}>
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}