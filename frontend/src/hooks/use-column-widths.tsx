import { useState, useEffect } from 'react'

export interface ColumnWidth {
  [key: string]: number
}

/**
 * Hook to manage adjustable column widths with localStorage persistence
 * @param tableId - Unique identifier for the table
 * @param defaultWidths - Default column widths in pixels
 * @returns Column widths and adjustment functions
 */
export function useColumnWidths(tableId: string, defaultWidths: ColumnWidth) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`table-widths-${tableId}`)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse stored column widths:', e)
        }
      }
    }
    return defaultWidths
  })

  // Save to localStorage whenever widths change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`table-widths-${tableId}`, JSON.stringify(columnWidths))
    }
  }, [columnWidths, tableId])

  const adjustWidth = (columnKey: string, delta: number) => {
    setColumnWidths(prev => {
      const currentWidth = prev[columnKey] || defaultWidths[columnKey] || 100
      const newWidth = Math.max(50, Math.min(600, currentWidth + delta)) // Min 50px, max 600px
      return {
        ...prev,
        [columnKey]: newWidth
      }
    })
  }

  const resetWidths = () => {
    setColumnWidths(defaultWidths)
  }

  const setWidth = (columnKey: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: Math.max(50, Math.min(600, width))
    }))
  }

  return {
    columnWidths,
    adjustWidth,
    resetWidths,
    setWidth
  }
}
