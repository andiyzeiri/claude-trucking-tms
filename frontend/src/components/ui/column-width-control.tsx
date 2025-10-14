import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ColumnWidthControlProps {
  onAdjust: (delta: number) => void
  currentWidth: number
}

export function ColumnWidthControl({ onAdjust, currentWidth }: ColumnWidthControlProps) {
  const step = 10 // Adjust by 10px each time

  return (
    <div className="flex items-center gap-0.5 absolute -top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAdjust(-step)
        }}
        className="p-0.5 hover:bg-gray-200 rounded"
        title="Decrease width"
        type="button"
      >
        <ChevronLeft className="h-3 w-3 text-gray-600" />
      </button>
      <span className="text-[10px] text-gray-500 px-0.5">{Math.round(currentWidth)}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAdjust(step)
        }}
        className="p-0.5 hover:bg-gray-200 rounded"
        title="Increase width"
        type="button"
      >
        <ChevronRight className="h-3 w-3 text-gray-600" />
      </button>
    </div>
  )
}
