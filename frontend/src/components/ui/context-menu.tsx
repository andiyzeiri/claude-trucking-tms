'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  x: number
  y: number
  isVisible: boolean
  onClose: () => void
  children: React.ReactNode
}

export function ContextMenu({ x, y, isVisible, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  )
}

interface ContextMenuItemProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function ContextMenuItem({ onClick, children, className, icon }: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2",
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}