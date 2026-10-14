'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface TruckLocation {
  eld_id: string
  unit: string
  truck_id: number | null
  truck_number: string | null
  driver_name: string | null
  lat: number
  lng: number
  location: string | null
  speed_mph: number | null
  bearing: string | null
  located_at: string | null
}

const REFRESH_MS = 60_000

export function useTruckLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['eld-locations'],
    queryFn: async (): Promise<TruckLocation[]> => (await api.get('/v1/eld/locations')).data,
    enabled,
    refetchInterval: REFRESH_MS,
    retry: false,
  })
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function ago(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 48 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} days ago`
}

// Every truck at its last ELD position (Peak), refreshed each minute, on a
// Google map (the Maps JavaScript API the app already loads for address search).
export function TruckMap({ trucks, height }: { trucks: TruckLocation[]; height: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const markers = useRef<google.maps.Marker[]>([])
  const info = useRef<google.maps.InfoWindow | null>(null)
  const fitted = useRef(false)
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)

  // The script loads before the page, but wait for it just in case.
  useEffect(() => {
    let tries = 0
    const t = setInterval(() => {
      if (window.google?.maps?.Map) {
        clearInterval(t)
        setReady(true)
      } else if (++tries > 50) {
        clearInterval(t)
        setMissing(true)
      }
    }, 200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!ready || !box.current || map.current) return
    map.current = new google.maps.Map(box.current, {
      center: { lat: 39.5, lng: -94 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    })
    info.current = new google.maps.InfoWindow()
  }, [ready])

  useEffect(() => {
    if (!map.current) return
    markers.current.forEach(m => m.setMap(null))
    markers.current = []
    const bounds = new google.maps.LatLngBounds()
    trucks.forEach(t => {
      const moving = (t.speed_mph || 0) > 3
      const label = t.truck_number || t.unit
      const marker = new google.maps.Marker({
        map: map.current!,
        position: { lat: t.lat, lng: t.lng },
        title: `Truck ${label}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: moving ? '#16a34a' : '#64748b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          labelOrigin: new google.maps.Point(0, -2.6),
        },
        label: { text: label, fontSize: '11px', fontWeight: '700', color: '#1f2937' },
      })
      const popup = [
        `<b>Truck ${esc(label)}</b>`,
        t.driver_name && esc(t.driver_name),
        t.location && esc(t.location),
        t.speed_mph != null && (moving ? `${Math.round(t.speed_mph)} mph${t.bearing ? ' ' + esc(t.bearing) : ''}` : 'Stopped'),
        t.located_at && `<span style="color:#6b7280">Updated ${ago(t.located_at)}</span>`,
      ].filter(Boolean).join('<br/>')
      marker.addListener('click', () => {
        info.current?.setContent(`<div style="font:13px system-ui,sans-serif;line-height:1.45">${popup}</div>`)
        info.current?.open({ map: map.current!, anchor: marker })
      })
      markers.current.push(marker)
      bounds.extend(marker.getPosition()!)
    })
    // Zoom to the trucks once; after that the view stays where the user left it.
    if (trucks.length && !fitted.current) {
      map.current.fitBounds(bounds, 40)
      google.maps.event.addListenerOnce(map.current, 'idle', () => {
        if ((map.current?.getZoom() || 0) > 9) map.current?.setZoom(9)
      })
      fitted.current = true
    }
  }, [trucks, ready])

  if (missing) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--monday-border-light)', fontSize: 12, color: 'var(--monday-text-muted)' }}>
        Google Maps didn&apos;t load.
      </div>
    )
  }
  return <div ref={box} style={{ height, width: '100%', borderRadius: 8 }} />
}
