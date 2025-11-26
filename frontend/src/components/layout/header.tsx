'use client'

import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-between px-6" style={{ borderBottom: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="flex flex-1 items-center">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--monday-text-muted)' }} />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-10"
            style={{ borderColor: 'var(--monday-border)', color: 'var(--monday-text-primary)' }}
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" style={{ color: 'var(--monday-text-secondary)' }}>
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}