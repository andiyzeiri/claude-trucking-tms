'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSearchShippers } from '@/hooks/use-shippers'
import { useSearchReceivers } from '@/hooks/use-receivers'
import { Shipper, Receiver } from '@/types'

interface AddressAutocompleteProps {
  label: string
  value: string
  onChange: (value: string) => void
  onSelect?: (location: { address: string; city: string; state: string; zip_code: string; name: string }) => void
  placeholder?: string
  id?: string
  className?: string
}

type LocationResult = (Shipper | Receiver) & { type: 'shipper' | 'receiver' }

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  className
}: AddressAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Extract zip code from the input value for searching
  const extractZipCode = (val: string): string => {
    // Try to extract zip code (5 digits) from the value
    const zipMatch = val.match(/\b\d{5}\b/)
    return zipMatch ? zipMatch[0] : val.replace(/\D/g, '').slice(0, 5)
  }

  const zipCode = extractZipCode(searchTerm || value)

  const { data: shippers = [] } = useSearchShippers(zipCode)
  const { data: receivers = [] } = useSearchReceivers(zipCode)

  // Combine and format results
  const results: LocationResult[] = [
    ...shippers.map(s => ({ ...s, type: 'shipper' as const })),
    ...receivers.map(r => ({ ...r, type: 'receiver' as const }))
  ]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    onChange(val)
    setShowDropdown(val.length >= 3)
    setSelectedIndex(-1)
  }

  const handleSelectLocation = (location: LocationResult) => {
    const formattedAddress = [
      location.address,
      location.city,
      location.state,
      location.zip_code
    ].filter(Boolean).join(', ')

    onChange(formattedAddress)
    setSearchTerm('')
    setShowDropdown(false)

    if (onSelect) {
      onSelect({
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zip_code: location.zip_code || '',
        name: location.name
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectLocation(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div className="space-y-2 relative">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setShowDropdown(value.length >= 3 || searchTerm.length >= 3)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Enter zip code or full address'}
        className={className}
      />

      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {results.map((result, index) => {
            const formattedAddress = [
              result.address,
              result.city,
              result.state,
              result.zip_code
            ].filter(Boolean).join(', ')

            return (
              <div
                key={`${result.type}-${result.id}`}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-100 ${
                  index === selectedIndex ? 'bg-gray-100' : ''
                }`}
                onClick={() => handleSelectLocation(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium text-sm">{result.name}</div>
                <div className="text-xs text-gray-600">
                  {formattedAddress}
                  <span className="ml-2 text-xs text-gray-400 italic">
                    ({result.type})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showDropdown && searchTerm && results.length === 0 && zipCode.length >= 3 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500 text-center"
        >
          No locations found for zip code "{zipCode}"
        </div>
      )}
    </div>
  )
}
