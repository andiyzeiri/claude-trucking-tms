'use client'

import React, { useEffect, useRef, useState } from 'react'

export interface AddressData {
  formatted_address: string
  street_number?: string
  route?: string
  locality?: string  // city
  administrative_area_level_1?: string  // state
  postal_code?: string
  country?: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (data: AddressData) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AddressAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = 'Enter address',
  className = '',
  disabled = false
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (!inputRef.current || typeof window === 'undefined' || !window.google) {
      console.log('❌ Cannot initialize autocomplete - missing requirements')
      return
    }

    console.log('✅ Initializing Google Places Autocomplete')

    // Initialize autocomplete
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['formatted_address', 'address_components', 'geometry']
    })

    autocompleteRef.current = autocomplete

    // Handle place selection
    const listener = autocomplete.addListener('place_changed', () => {
      console.log('🎯 place_changed event fired!')
      const place = autocomplete.getPlace()
      console.log('🗺️ Google Place selected:', place)

      if (!place || !place.formatted_address) {
        console.log('⚠️ No place or formatted_address found')
        return
      }

      const formattedAddress = place.formatted_address
      console.log('📝 Formatted address:', formattedAddress)

      setLocalValue(formattedAddress)

      // Extract structured address components from Google Places API
      const addressData: AddressData = {
        formatted_address: formattedAddress
      }

      // Parse address_components to extract structured data
      console.log('📍 Address components:', place.address_components)
      place.address_components?.forEach(component => {
        const types = component.types
        if (types.includes('street_number')) {
          addressData.street_number = component.short_name
        } else if (types.includes('route')) {
          addressData.route = component.short_name
        } else if (types.includes('locality')) {
          addressData.locality = component.long_name
        } else if (types.includes('administrative_area_level_1')) {
          addressData.administrative_area_level_1 = component.short_name
        } else if (types.includes('postal_code')) {
          addressData.postal_code = component.short_name
        } else if (types.includes('country')) {
          addressData.country = component.short_name
        }
      })

      console.log('✅ Extracted address data:', addressData)
      console.log('📤 Calling onChange with addressData')
      onChange(addressData)
      console.log('✅ onChange called')
    })

    console.log('✅ Event listener attached')

    return () => {
      console.log('🧹 Cleaning up autocomplete')
      if (listener) {
        google.maps.event.removeListener(listener)
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    // When user types manually, send minimal AddressData with just the formatted_address
    onChange({ formatted_address: newValue })
  }

  const handleBlur = () => {
    if (onBlur) {
      onBlur()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="off"
    />
  )
}
