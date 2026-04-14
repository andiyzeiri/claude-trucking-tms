"use client"

import * as React from "react"
import { format, parse, parseISO, setHours, setMinutes } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Generate time options in 15-minute increments
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const date = new Date()
      date.setHours(hour, minute, 0, 0)
      const value = format(date, "HH:mm")
      const label = format(date, "h:mm a")
      options.push({ value, label })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

interface DateTimePickerProps {
  value?: string // ISO date string or MM/DD/YY format
  onChange: (date: string, time: string) => void
  dateValue?: string // MM/DD/YY format
  timeValue?: string // h:mm a format
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: "sm" | "md"
}

export function DateTimePicker({
  value,
  onChange,
  dateValue,
  timeValue,
  placeholder = "Select date & time",
  className,
  disabled,
  size = "md",
}: DateTimePickerProps) {
  const [dateOpen, setDateOpen] = React.useState(false)
  const [timeOpen, setTimeOpen] = React.useState(false)

  // Parse the date from various formats
  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined

    // Try ISO format first
    try {
      const parsed = parseISO(dateStr)
      if (!isNaN(parsed.getTime())) return parsed
    } catch {}

    // Try MM/DD/YY format
    try {
      const parsed = parse(dateStr, "MM/dd/yy", new Date())
      if (!isNaN(parsed.getTime())) return parsed
    } catch {}

    // Try M/D/YY format
    try {
      const parsed = parse(dateStr, "M/d/yy", new Date())
      if (!isNaN(parsed.getTime())) return parsed
    } catch {}

    return undefined
  }

  // Get the date either from value prop or dateValue prop
  const date = parseDate(value) || parseDate(dateValue)

  // Get the time either from value prop or timeValue prop
  const getTimeFromValue = (): string => {
    if (timeValue) {
      // Convert "h:mm a" to "HH:mm" for comparison
      try {
        const parsed = parse(timeValue, "h:mm a", new Date())
        if (!isNaN(parsed.getTime())) {
          return format(parsed, "HH:mm")
        }
      } catch {}
      return ""
    }

    if (value) {
      try {
        const parsed = parseISO(value)
        if (!isNaN(parsed.getTime())) {
          return format(parsed, "HH:mm")
        }
      } catch {}
    }

    return ""
  }

  const currentTime = getTimeFromValue()
  const currentTimeLabel = currentTime
    ? TIME_OPTIONS.find(t => t.value === currentTime)?.label || timeValue || ""
    : timeValue || ""

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const dateStr = format(selectedDate, "MM/dd/yy")
      onChange(dateStr, currentTimeLabel || "12:00 AM")
    }
    setDateOpen(false)
  }

  const handleTimeSelect = (timeOption: { value: string; label: string }) => {
    const dateStr = date ? format(date, "MM/dd/yy") : format(new Date(), "MM/dd/yy")
    onChange(dateStr, timeOption.label)
    setTimeOpen(false)
  }

  const sizeClasses = size === "sm"
    ? "h-6 text-xs px-2"
    : "h-8 text-sm px-3"

  return (
    <div className={cn("flex gap-1", className)}>
      {/* Date Picker */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !date && "text-muted-foreground",
              sizeClasses
            )}
            disabled={disabled}
            style={{ width: size === "sm" ? "85px" : "110px" }}
          >
            <CalendarIcon className="mr-1 h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {date ? format(date, "M/d/yy") : "Date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Time Picker */}
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !currentTimeLabel && "text-muted-foreground",
              sizeClasses
            )}
            disabled={disabled}
            style={{ width: size === "sm" ? "80px" : "95px" }}
          >
            <Clock className="mr-1 h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {currentTimeLabel || "Time"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="h-64 overflow-y-auto p-1">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeSelect(option)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm rounded hover:bg-accent",
                  currentTime === option.value && "bg-accent font-medium"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Compact inline version for table cells
interface InlineDateTimePickerProps {
  dateValue: string // MM/DD/YY format
  timeValue: string // h:mm a format
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onSave?: (values: { date?: string; time?: string }) => void // Called with new values to trigger save
  disabled?: boolean
}

export function InlineDateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  onSave,
  disabled,
}: InlineDateTimePickerProps) {
  const [dateOpen, setDateOpen] = React.useState(false)

  // Parse the date
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined

    // Try MM/DD/YY format
    try {
      const parsed = parse(dateStr, "MM/dd/yy", new Date())
      if (!isNaN(parsed.getTime())) return parsed
    } catch {}

    // Try M/D/YY format
    try {
      const parsed = parse(dateStr, "M/d/yy", new Date())
      if (!isNaN(parsed.getTime())) return parsed
    } catch {}

    return undefined
  }

  const date = parseDate(dateValue)

  // Get current time in HH:mm format for comparison
  // timeValue can be "8:00 AM" (12-hour) or "08:00" (24-hour)
  const getCurrentTimeValue = (): string => {
    if (!timeValue) return ""

    // If already in 24-hour format (HH:MM), return as-is
    const match24 = timeValue.match(/^(\d{1,2}):(\d{2})$/)
    if (match24) {
      const hours = parseInt(match24[1])
      const minutes = parseInt(match24[2])
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    // Parse 12-hour format (h:mm AM/PM)
    const match12 = timeValue.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match12) {
      let hours = parseInt(match12[1])
      const minutes = parseInt(match12[2])
      const ampm = match12[3].toUpperCase()

      if (ampm === 'PM' && hours !== 12) hours += 12
      else if (ampm === 'AM' && hours === 12) hours = 0

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    return ""
  }

  const currentTimeValue = getCurrentTimeValue()

  // Normalize any typed time input to HH:mm (24-hour). Accepts:
  //   "1430", "14:30", "14.30", "930", "9:30", "9" (assumes :00)
  const normalizeTypedTime = (input: string): string => {
    if (!input) return ""
    const cleaned = input.replace(/[^0-9]/g, "")
    if (!cleaned) return ""
    let h = 0, m = 0
    if (cleaned.length <= 2) {
      h = parseInt(cleaned)
      m = 0
    } else if (cleaned.length === 3) {
      h = parseInt(cleaned.slice(0, 1))
      m = parseInt(cleaned.slice(1))
    } else {
      h = parseInt(cleaned.slice(0, 2))
      m = parseInt(cleaned.slice(2, 4))
    }
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return ""
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const [timeDraft, setTimeDraft] = React.useState<string | null>(null)
  const timeInputValue = timeDraft !== null ? timeDraft : currentTimeValue

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = format(selectedDate, "MM/dd/yy")
      onDateChange(newDate)
      // Trigger save immediately with the new value
      if (onSave) {
        onSave({ date: newDate })
      }
    }
    setDateOpen(false)
  }

  const commitTypedTime = () => {
    if (timeDraft === null) return
    const normalized = normalizeTypedTime(timeDraft)
    setTimeDraft(null)
    if (normalized && normalized !== currentTimeValue) {
      onTimeChange(normalized)
      if (onSave) onSave({ time: normalized })
    }
  }

  return (
    <div className="flex gap-1">
      {/* Date Button */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-6 px-1.5 text-xs border rounded bg-white hover:bg-gray-50 flex items-center gap-1",
              !date && "text-gray-400"
            )}
            disabled={disabled}
            style={{ width: "75px", fontSize: "11px" }}
          >
            <CalendarIcon className="h-3 w-3 flex-shrink-0 text-gray-400" />
            <span>{date ? format(date, "M/d/yy") : "Date"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Time Input (24-hour / military) */}
      <div
        className={cn(
          "h-6 px-1.5 text-xs border rounded bg-white hover:bg-gray-50 flex items-center gap-1",
          !timeInputValue && "text-gray-400"
        )}
        style={{ width: "75px", fontSize: "11px" }}
      >
        <Clock className="h-3 w-3 flex-shrink-0 text-gray-400" />
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          disabled={disabled}
          placeholder="HH:MM"
          className="w-full bg-transparent border-0 outline-none p-0 text-xs"
          style={{ fontSize: "11px" }}
          value={timeInputValue}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setTimeDraft(e.target.value)}
          onBlur={commitTypedTime}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === "Escape") {
              setTimeDraft(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </div>
    </div>
  )
}
