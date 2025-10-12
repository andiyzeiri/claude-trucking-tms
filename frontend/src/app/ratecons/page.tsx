'use client'

import React, { useRef } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { FileDown } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'
import { Load } from '@/types'
import { useReactToPrint } from 'react-to-print'

// Printable Ratecon Component
const PrintableRatecon = React.forwardRef<HTMLDivElement, { load: Load }>(({ load }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white" style={{ width: '8.5in', minHeight: '11in' }}>
      {/* Header */}
      <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">RATE CONFIRMATION</h1>
        <p className="text-sm text-gray-600 mt-2">Absolute Trucking</p>
      </div>

      {/* Load Information */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Load Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">Load Number:</p>
            <p className="text-base text-gray-900">{load.load_number}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Status:</p>
            <p className="text-base text-gray-900 capitalize">{load.status}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Equipment Type:</p>
            <p className="text-base text-gray-900">{load.equipment_type || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Rate:</p>
            <p className="text-base font-bold text-gray-900">{formatCurrency(load.rate)}</p>
          </div>
        </div>
      </div>

      {/* Pickup Information */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Pickup Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">Location:</p>
            <p className="text-base text-gray-900">{load.pickup_location}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Date:</p>
            <p className="text-base text-gray-900">
              {load.pickup_date ? new Date(load.pickup_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Information */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Delivery Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">Location:</p>
            <p className="text-base text-gray-900">{load.delivery_location}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Date:</p>
            <p className="text-base text-gray-900">
              {load.delivery_date ? new Date(load.delivery_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Commodity Information */}
      {load.commodity && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Commodity Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Type:</p>
              <p className="text-base text-gray-900">{load.commodity}</p>
            </div>
            {load.weight && (
              <div>
                <p className="text-sm font-semibold text-gray-600">Weight:</p>
                <p className="text-base text-gray-900">{load.weight} lbs</p>
              </div>
            )}
            {load.pieces && (
              <div>
                <p className="text-sm font-semibold text-gray-600">Pieces:</p>
                <p className="text-base text-gray-900">{load.pieces}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {load.special_instructions && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Special Instructions</h2>
          <p className="text-base text-gray-900">{load.special_instructions}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-300">
        <p className="text-xs text-gray-600 text-center">
          This rate confirmation is subject to the terms and conditions agreed upon by both parties.
        </p>
        <p className="text-xs text-gray-600 text-center mt-2">
          Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
})

PrintableRatecon.displayName = 'PrintableRatecon'

export default function RateconsPage() {
  const { data: loadsData, isLoading } = useLoads(1, 1000)
  const loads = loadsData?.items || []

  // Debug: Log all customer names
  React.useEffect(() => {
    if (loads.length > 0) {
      console.log('All customer names:', loads.map(l => l.customer?.name).filter(Boolean))
    }
  }, [loads])

  // Filter loads for Absolute Trucking customer (case-insensitive, partial match)
  const absoluteTruckingLoads = loads.filter(
    load => load.customer?.name?.toLowerCase().includes('absolute')
  )

  const printRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  const handlePrint = useReactToPrint({
    content: () => null, // Will be set dynamically
    documentTitle: 'Rate Confirmation',
  })

  const generatePDF = (load: Load) => {
    const printableComponent = printRefs.current[load.id]
    if (printableComponent) {
      handlePrint({ content: () => printableComponent })
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading loads...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Rate Confirmations</h1>
            <p className="text-gray-600">
              Generate rate confirmations for Absolute Trucking loads
            </p>
          </div>
        </div>

        {absoluteTruckingLoads.length === 0 ? (
          <div className="border rounded-lg bg-white p-8 text-center" style={{borderColor: 'var(--cell-borderColor)'}}>
            <p className="text-gray-600">No loads found for Absolute Trucking</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
              <div className="overflow-x-auto">
                <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                  <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Load #</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Customer</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Pickup</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Pickup Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Delivery</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Delivery Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Rate</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white" style={{backgroundColor: 'var(--cell-background-base)'}}>
                    {absoluteTruckingLoads.map((load, index) => {
                      const isEvenRow = index % 2 === 0
                      const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

                      return (
                        <tr
                          key={load.id}
                          className="border-b transition-colors"
                          style={{
                            borderColor: 'var(--cell-borderColor)',
                            backgroundColor: defaultBgColor
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--row-background-cursor)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = defaultBgColor
                          }}
                        >
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div className="font-medium" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {load.load_number}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {load.customer?.name || 'N/A'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {load.pickup_location}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {formatDate(load.pickup_date)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {load.delivery_location}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {formatDate(load.delivery_date)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <div className="font-medium text-right" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
                              {formatCurrency(load.rate)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize"
                              style={{
                                backgroundColor:
                                  load.status === 'delivered' ? '#dcfce7' :
                                  load.status === 'in_transit' ? '#dbeafe' :
                                  load.status === 'assigned' ? '#fef3c7' :
                                  load.status === 'cancelled' ? '#fee2e2' :
                                  '#f3f4f6',
                                color:
                                  load.status === 'delivered' ? '#15803d' :
                                  load.status === 'in_transit' ? '#1e40af' :
                                  load.status === 'assigned' ? '#b45309' :
                                  load.status === 'cancelled' ? '#b91c1c' :
                                  '#4b5563'
                              }}
                            >
                              {load.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5" style={{borderColor: 'var(--cell-borderColor)'}}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generatePDF(load)}
                              className="h-8 px-3 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <FileDown className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hidden printable components */}
            <div style={{ display: 'none' }}>
              {absoluteTruckingLoads.map(load => (
                <PrintableRatecon
                  key={load.id}
                  load={load}
                  ref={(el) => {
                    printRefs.current[load.id] = el
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
