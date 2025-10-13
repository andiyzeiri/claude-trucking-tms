'use client'

import React, { useRef } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { FileDown } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'
import { Load } from '@/types'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Printable Ratecon Component
const PrintableRatecon = React.forwardRef<HTMLDivElement, { load: Load }>(({ load }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>
      {/* Header with Logo */}
      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1e40af', paddingBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          {/* Company Logo */}
          <img
            src="https://lh3.googleusercontent.com/a/ACg8ocJL_tzu1xh8R0X1-vch91cbmpCbv2CcroaHCqNKTC4Fiiu0bIed=s317-c-no"
            alt="Absolute Trucking Inc Logo"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain',
              borderRadius: '50%',
              border: '3px solid #1e40af',
              backgroundColor: 'white'
            }}
          />
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>ABSOLUTE TRUCKING INC</div>
            <div>MC #: 1116953</div>
            <div>DOT #: 3439947</div>
            <div>Phone: (708) 845-6619</div>
            <div>Email: redi@absolutetrucking.net</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>RATE CONFIRMATION</h1>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            <div><strong>Load #:</strong> {load.load_number}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Customer Information Section */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase' }}>
          CUSTOMER INFORMATION
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Customer Name:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.customer?.name || 'N/A'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>MC Number:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.customer?.mc || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Rate & Equipment Section */}
      <div style={{ marginBottom: '24px', padding: '16px', border: '2px solid #1e40af', borderRadius: '4px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase' }}>
          RATE & EQUIPMENT
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Total Rate:</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>{formatCurrency(load.rate)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Equipment Type:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.equipment_type || 'Dry Van'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Miles:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.miles || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Pickup Section */}
      <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f9fafb', borderLeft: '4px solid #10b981', borderRadius: '4px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase' }}>
          📍 PICKUP INFORMATION
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Location:</div>
            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>{load.pickup_location}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Date & Time:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>
              {load.pickup_date ? new Date(load.pickup_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }) : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Section */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase' }}>
          📍 DELIVERY INFORMATION
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Location:</div>
            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>{load.delivery_location}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Date & Time:</div>
            <div style={{ fontSize: '14px', color: '#1f2937' }}>
              {load.delivery_date ? new Date(load.delivery_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }) : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Commodity Information */}
      {(load.commodity || load.weight || load.pieces) && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase' }}>
            COMMODITY DETAILS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {load.commodity && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>Type:</div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.commodity}</div>
              </div>
            )}
            {load.weight && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>Weight:</div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.weight} lbs</div>
              </div>
            )}
            {load.pieces && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>Pieces:</div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.pieces}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {load.special_instructions && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px', textTransform: 'uppercase' }}>
            ⚠️ SPECIAL INSTRUCTIONS
          </h2>
          <div style={{ fontSize: '14px', color: '#1f2937' }}>{load.special_instructions}</div>
        </div>
      )}

      {/* Terms and Conditions */}
      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>TERMS AND CONDITIONS</h3>
        <ul style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.6', paddingLeft: '20px', margin: 0 }}>
          <li>Payment terms: Net 30 days from delivery date</li>
          <li>Carrier agrees to maintain required insurance coverage</li>
          <li>All claims must be filed within 9 months of delivery date</li>
          <li>This rate confirmation is subject to the terms in the carrier agreement</li>
          <li>Carrier is responsible for securing the load properly and for all cargo loss or damage</li>
        </ul>
      </div>

      {/* Signature Section */}
      <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '2px', marginBottom: '8px', minHeight: '40px' }}></div>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>
            <div style={{ fontWeight: 'bold' }}>Carrier Signature</div>
            <div>Date: _________________</div>
          </div>
        </div>
        <div>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '2px', marginBottom: '8px', minHeight: '40px' }}></div>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>
            <div style={{ fontWeight: 'bold' }}>Broker Signature</div>
            <div>Date: _________________</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '2px solid #1e40af', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
          Document generated on {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })} at {new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        <div style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>
          This is a legally binding document. Please retain for your records.
        </div>
      </div>
    </div>
  )
})

PrintableRatecon.displayName = 'PrintableRatecon'

export default function RateconsPage() {
  const { data: loadsData, isLoading } = useLoads(1, 1000)
  const loads = loadsData?.items || []

  // Debug: Log all loads data
  React.useEffect(() => {
    console.log('Total loads fetched:', loads.length)
    console.log('All customer names:', loads.map(l => l.customer?.name).filter(Boolean))
    console.log('Sample load data:', loads[0])
  }, [loads])

  // Filter loads for Absolute Trucking customer (case-insensitive, partial match)
  // TEMPORARY: Show ALL loads for debugging
  const absoluteTruckingLoads = loads
  // const absoluteTruckingLoads = loads.filter(
  //   load => load.customer?.name?.toLowerCase().includes('absolute')
  // )

  const printRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  const generatePDF = async (load: Load) => {
    console.log('Generating PDF for load:', load.id)
    const printableComponent = printRefs.current[load.id]
    console.log('Found component:', !!printableComponent)

    if (printableComponent) {
      try {
        // Convert HTML to canvas
        const canvas = await html2canvas(printableComponent, {
          scale: 2,
          useCORS: true,
          logging: false,
        })

        // Calculate PDF dimensions
        const imgWidth = 210 // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgData = canvas.toDataURL('image/png')

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

        // Download the PDF
        pdf.save(`rate-confirmation-${load.load_number}.pdf`)
      } catch (error) {
        console.error('Error generating PDF:', error)
        alert('Failed to generate PDF. Please try again.')
      }
    } else {
      console.error('Could not find printable component for load:', load.id)
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

            {/* Off-screen printable components (must be visible for html2canvas) */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
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
