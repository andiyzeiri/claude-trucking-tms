'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMenuToggle?: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between px-4 md:px-6 md:justify-end" style={{ borderBottom: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      {/* Hamburger - mobile only */}
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={onMenuToggle}
        style={{ color: 'var(--monday-text-primary)' }}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile brand */}
      <div className="md:hidden text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
        ABSOLUTE
      </div>

      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" style={{ color: 'var(--monday-text-secondary)' }}>
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
