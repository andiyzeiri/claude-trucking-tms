'use client'

import React, { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
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

// Every truck at its last ELD position (Peak), refreshed each minute.
// Leaflet with OpenStreetMap tiles; a label per truck instead of pin images.
export function TruckMap({ trucks, height }: { trucks: TruckLocation[]; height: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const layer = useRef<any>(null)
  const L = useRef<any>(null)
  const fitted = useRef(false)

  useEffect(() => {
    let cancelled = false
    import('leaflet').then(mod => {
      if (cancelled || !box.current || map.current) return
      L.current = mod.default || mod
      map.current = L.current.map(box.current, { zoomControl: true, attributionControl: true }).setView([39.5, -94], 4)
      // OpenStreetMap's own tiles: no API key (CARTO's now ask for one).
      L.current.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current)
      layer.current = L.current.layerGroup().addTo(map.current)
      draw()
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = () => {
    if (!map.current || !L.current) return
    layer.current.clearLayers()
    const points: [number, number][] = []
    trucks.forEach(t => {
      const moving = (t.speed_mph || 0) > 3
      const label = esc(t.truck_number || t.unit)
      const icon = L.current.divIcon({
        className: '',
        html: `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:10px;background:#fff;border:1px solid ${moving ? '#16a34a' : '#94a3b8'};box-shadow:0 1px 3px rgba(0,0,0,.25);font:600 11px system-ui,sans-serif;color:#1f2937;white-space:nowrap;transform:translate(-50%,-50%)"><span style="width:7px;height:7px;border-radius:50%;background:${moving ? '#16a34a' : '#94a3b8'}"></span>${label}</div>`,
        iconSize: [0, 0],
      })
      const popup = [
        `<b>Truck ${label}</b>`,
        t.driver_name && esc(t.driver_name),
        t.location && esc(t.location),
        t.speed_mph != null && (moving ? `${Math.round(t.speed_mph)} mph${t.bearing ? ' ' + esc(t.bearing) : ''}` : 'Stopped'),
        t.located_at && `<span style="color:#6b7280">Updated ${ago(t.located_at)}</span>`,
      ].filter(Boolean).join('<br/>')
      L.current.marker([t.lat, t.lng], { icon }).bindPopup(popup).addTo(layer.current)
      points.push([t.lat, t.lng])
    })
    // Zoom to the trucks once; after that the view stays where the user left it.
    if (points.length && !fitted.current) {
      map.current.fitBounds(points, { padding: [30, 30], maxZoom: 9 })
      fitted.current = true
    }
  }

  useEffect(draw, [trucks])

  // isolation keeps Leaflet's own z-indexes (up to 1000) from covering menus and dialogs.
  return <div ref={box} style={{ height, width: '100%', borderRadius: 8, isolation: 'isolate' }} />
}
