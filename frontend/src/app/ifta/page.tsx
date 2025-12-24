'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import { useIfta, useIftaSummary, useCreateIfta, useUpdateIfta, useDeleteIfta, IFTA } from '@/hooks/use-ifta'
import { useTrucks } from '@/hooks/use-trucks'

// All IFTA member jurisdictions
const JURISDICTIONS = [
  // US States
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  // Canadian Provinces
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
]

type EditingCell = {
  entryId: number
  field: string
} | null

export default function IFTAPage() {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [showAddRow, setShowAddRow] = useState(false)
  const [newEntry, setNewEntry] = useState({
    jurisdiction: '',
    total_miles: 0,
    taxable_miles: 0,
    tax_paid_gallons: 0,
  })

  const { data: trucksData } = useTrucks()
  const trucks = trucksData?.items || []

  const { data: iftaData, isLoading } = useIfta({ year: selectedYear, quarter: selectedQuarter })
  const { data: summary } = useIftaSummary(selectedYear, selectedQuarter)
  const createIfta = useCreateIfta()
  const updateIfta = useUpdateIfta()
  const deleteIfta = useDeleteIfta()

  // Generate years for selector (last 5 years)
  const years = useMemo(() => {
    const yrs = []
    for (let i = currentYear; i >= currentYear - 4; i--) {
      yrs.push(i)
    }
    return yrs
  }, [currentYear])

  const quarters = [1, 2, 3, 4]

  const getQuarterLabel = (q: number) => {
    const months: Record<number, string> = {
      1: 'Jan - Mar',
      2: 'Apr - Jun',
      3: 'Jul - Sep',
      4: 'Oct - Dec'
    }
    return `Q${q} (${months[q]})`
  }

  // Get jurisdictions that haven't been added yet
  const availableJurisdictions = useMemo(() => {
    if (!iftaData) return JURISDICTIONS
    const usedCodes = new Set(iftaData.map(e => e.jurisdiction))
    return JURISDICTIONS.filter(j => !usedCodes.has(j.code))
  }, [iftaData])

  const handleCellClick = (entryId: number, field: string, currentValue: any) => {
    setEditingCell({ entryId, field })
    setEditValue(currentValue?.toString() || '')
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const entry = iftaData?.find(e => e.id === editingCell.entryId)
    if (!entry) {
      setEditingCell(null)
      return
    }

    const numValue = parseFloat(editValue) || 0

    // Only update if value changed
    const currentValue = entry[editingCell.field as keyof IFTA]
    if (numValue !== Number(currentValue)) {
      try {
        await updateIfta.mutateAsync({
          id: entry.id,
          data: { [editingCell.field]: numValue }
        })
      } catch (error) {
        console.error('Failed to update IFTA entry:', error)
      }
    }

    setEditingCell(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const handleAddEntry = async () => {
    if (!newEntry.jurisdiction) return

    try {
      await createIfta.mutateAsync({
        year: selectedYear,
        quarter: selectedQuarter,
        jurisdiction: newEntry.jurisdiction,
        total_miles: newEntry.total_miles,
        taxable_miles: newEntry.taxable_miles,
        tax_paid_gallons: newEntry.tax_paid_gallons,
      })
      setShowAddRow(false)
      setNewEntry({ jurisdiction: '', total_miles: 0, taxable_miles: 0, tax_paid_gallons: 0 })
    } catch (error) {
      console.error('Failed to create IFTA entry:', error)
    }
  }

  const handleDeleteEntry = async (id: number) => {
    if (confirm('Delete this IFTA entry?')) {
      try {
        await deleteIfta.mutateAsync(id)
      } catch (error) {
        console.error('Failed to delete IFTA entry:', error)
      }
    }
  }

  const getJurisdictionName = (code: string) => {
    return JURISDICTIONS.find(j => j.code === code)?.name || code
  }

  if (isLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  return (
    <Layout>
      <div className="p-4 page-ifta">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>IFTA</h1>

          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="appearance-none px-4 py-2 pr-8 rounded-lg border text-sm font-medium cursor-pointer"
                style={{
                  borderColor: 'var(--monday-border)',
                  backgroundColor: 'var(--monday-bg-primary)',
                  color: 'var(--monday-text-primary)'
                }}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--monday-text-secondary)' }} />
            </div>

            {/* Quarter Selector */}
            <div className="relative">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                className="appearance-none px-4 py-2 pr-8 rounded-lg border text-sm font-medium cursor-pointer"
                style={{
                  borderColor: 'var(--monday-border)',
                  backgroundColor: 'var(--monday-bg-primary)',
                  color: 'var(--monday-text-primary)'
                }}
              >
                {quarters.map(q => (
                  <option key={q} value={q}>{getQuarterLabel(q)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--monday-text-secondary)' }} />
            </div>

            <button
              onClick={() => setShowAddRow(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'var(--monday-blue)',
                color: 'white'
              }}
            >
              <Plus className="h-4 w-4" />
              Add Jurisdiction
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-4 py-3 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Jurisdiction</th>
                <th className="px-4 py-3 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total Miles</th>
                <th className="px-4 py-3 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Taxable Miles</th>
                <th className="px-4 py-3 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Fuel Gallons</th>
                <th className="px-4 py-3 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>MPG</th>
                <th className="px-4 py-3 border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Add New Row */}
              {showAddRow && (
                <tr style={{ backgroundColor: 'var(--monday-bg-hover)' }}>
                  <td className="px-4 py-2 border-b border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <select
                      value={newEntry.jurisdiction}
                      onChange={(e) => setNewEntry({ ...newEntry, jurisdiction: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      style={{ borderColor: 'var(--monday-border)' }}
                      autoFocus
                    >
                      <option value="">Select Jurisdiction</option>
                      {availableJurisdictions.map(j => (
                        <option key={j.code} value={j.code}>{j.code} - {j.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 border-b border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <input
                      type="number"
                      value={newEntry.total_miles || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, total_miles: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-right text-sm"
                      style={{ borderColor: 'var(--monday-border)' }}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 border-b border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <input
                      type="number"
                      value={newEntry.taxable_miles || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, taxable_miles: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-right text-sm"
                      style={{ borderColor: 'var(--monday-border)' }}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 border-b border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={newEntry.tax_paid_gallons || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, tax_paid_gallons: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-right text-sm"
                      style={{ borderColor: 'var(--monday-border)' }}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 border-b border-r text-right" style={{ borderColor: 'var(--monday-border-light)', color: 'var(--monday-text-muted)', fontSize: '13px' }}>
                    -
                  </td>
                  <td className="px-4 py-2 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleAddEntry}
                        disabled={!newEntry.jurisdiction}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: newEntry.jurisdiction ? 'var(--monday-done)' : 'var(--monday-border)',
                          color: newEntry.jurisdiction ? 'white' : 'var(--monday-text-muted)'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowAddRow(false)
                          setNewEntry({ jurisdiction: '', total_miles: 0, taxable_miles: 0, tax_paid_gallons: 0 })
                        }}
                        className="px-2 py-1 rounded text-xs"
                        style={{ color: 'var(--monday-text-secondary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {iftaData?.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)' }}
                >
                  <td className="px-4 py-3 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--monday-text-primary)', fontWeight: 500 }}>
                      {entry.jurisdiction}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)' }}>
                      {getJurisdictionName(entry.jurisdiction)}
                    </div>
                  </td>

                  <td className="px-4 py-3 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                    {editingCell?.entryId === entry.id && editingCell?.field === 'total_miles' ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border rounded text-right text-sm"
                        style={{ borderColor: 'var(--monday-border)' }}
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(entry.id, 'total_miles', entry.total_miles)}
                        className="cursor-pointer rounded px-2 py-1"
                        style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}
                      >
                        {entry.total_miles?.toLocaleString() || '0'}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                    {editingCell?.entryId === entry.id && editingCell?.field === 'taxable_miles' ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border rounded text-right text-sm"
                        style={{ borderColor: 'var(--monday-border)' }}
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(entry.id, 'taxable_miles', entry.taxable_miles)}
                        className="cursor-pointer rounded px-2 py-1"
                        style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}
                      >
                        {entry.taxable_miles?.toLocaleString() || '0'}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                    {editingCell?.entryId === entry.id && editingCell?.field === 'tax_paid_gallons' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border rounded text-right text-sm"
                        style={{ borderColor: 'var(--monday-border)' }}
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(entry.id, 'tax_paid_gallons', entry.tax_paid_gallons)}
                        className="cursor-pointer rounded px-2 py-1"
                        style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}
                      >
                        {Number(entry.tax_paid_gallons).toFixed(2)}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-blue)', fontWeight: 500 }}>
                    {entry.mpg ? Number(entry.mpg).toFixed(2) : '-'}
                  </td>

                  <td className="px-4 py-3" style={{ borderColor: 'var(--monday-border-light)' }}>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--monday-stuck)' }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Empty State */}
              {(!iftaData || iftaData.length === 0) && !showAddRow && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                    No IFTA entries for Q{selectedQuarter} {selectedYear}. Click "Add Jurisdiction" to add data.
                  </td>
                </tr>
              )}

              {/* Summary Row */}
              {summary && summary.jurisdiction_count > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)', fontWeight: 600 }}>
                  <td className="px-4 py-3 border-t" style={{ borderColor: 'var(--monday-border)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    Total ({summary.jurisdiction_count} jurisdictions)
                  </td>
                  <td className="px-4 py-3 border-t text-right" style={{ borderColor: 'var(--monday-border)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {summary.total_miles?.toLocaleString() || '0'}
                  </td>
                  <td className="px-4 py-3 border-t text-right" style={{ borderColor: 'var(--monday-border)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {summary.total_taxable_miles?.toLocaleString() || '0'}
                  </td>
                  <td className="px-4 py-3 border-t text-right" style={{ borderColor: 'var(--monday-border)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {Number(summary.total_gallons).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 border-t text-right" style={{ borderColor: 'var(--monday-border)', fontSize: '13px', color: 'var(--monday-done)', fontWeight: 600 }}>
                    {summary.overall_mpg ? Number(summary.overall_mpg).toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 border-t" style={{ borderColor: 'var(--monday-border)' }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
