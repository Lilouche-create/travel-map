import { useEffect, useRef, useCallback, useState } from 'react'
import { maptilersdk } from '../../lib/maptiler'
import { wktToGeojson, stepStatus, fmtDuration } from '../../lib/utils'
import { buildArc } from '../../lib/maptiler'

const KEY = import.meta.env.VITE_MAPTILER_KEY

const STYLES = [
  { id: 'bright',    label: 'Streets',   icon: '🗺',  url: `https://api.maptiler.com/maps/bright-v2/style.json?key=${KEY}` },
  { id: 'satellite', label: 'Satellite', icon: '🛰',  url: `https://api.maptiler.com/maps/satellite/style.json?key=${KEY}` },
]

const DEFAULT_CENTER = [134.0, -25.0]
const DEFAULT_ZOOM   = 4
const EMPTY_FC       = { type: 'FeatureCollection', features: [] }

export default function MapView({
  steps = [],
  regions = [],
  selectedStepId,
  selectedSegmentIndex,
  onSelectStep,
  onSelectSegment,
  isEditor = false,
  onStepDragged,
  highlightRegionId,
  mapContainerRef,
}) {
  const wrapRef              = useRef(null)
  const containerRef         = useRef(null)
  const mapRef               = useRef(null)
  const markersRef           = useRef({})   // city markers
  const labelsRef            = useRef({})   // duration badges
  const lastDataRef          = useRef(EMPTY_FC)
  const isFirstStyleLoadRef  = useRef(true) // skip styleVersion bump on initial load
  // Ref stable pour le callback — évite re-créer les labels à chaque render
  const onSegClickRef        = useRef(onSelectSegment)
  useEffect(() => { onSegClickRef.current = onSelectSegment }, [onSelectSegment])

  const [currentStyleId, setCurrentStyleId] = useState('bright')
  // Incremented after each style swap — triggers marker & label effects to rebuild
  const [styleVersion, setStyleVersion]     = useState(0)

  // ─────────────────────────────────────────────────────────────
  // Layer helpers — called on first load AND after every style swap
  // ─────────────────────────────────────────────────────────────
  const setupLayers = useCallback((map) => {
    // Clean up in case of re-init
    ['routes-arc', 'routes-dashed', 'routes-base', 'routes-glow'].forEach(id => {
      try { map.removeLayer(id) } catch (_) {}
    })
    try { map.removeSource('routes') } catch (_) {}

    map.addSource('routes', { type: 'geojson', data: lastDataRef.current })

    // selected  → segment actif, mis en évidence
    // dimmed    → segments non sélectionnés, atténués discrètement
    // (défaut)  → aucun segment sélectionné, rendu normal
    map.addLayer({
      id: 'routes-glow', type: 'line', source: 'routes',
      filter: ['==', ['get', 'transport'], 'voiture'],
      paint: {
        'line-color':   ['get', 'color'],
        'line-width':   ['case', ['get', 'selected'], 18, ['get', 'dimmed'], 0, 12],
        'line-opacity': ['case', ['get', 'selected'], 0.28, ['get', 'dimmed'], 0, 0.12],
        'line-blur': 5,
      },
    })
    map.addLayer({
      id: 'routes-base', type: 'line', source: 'routes',
      filter: ['==', ['get', 'transport'], 'voiture'],
      paint: {
        'line-color':   ['get', 'color'],
        'line-width':   ['case', ['get', 'selected'], 6, ['get', 'dimmed'], 2,   3.5],
        'line-opacity': ['case', ['get', 'selected'], 0.45, ['get', 'dimmed'], 0.1, 0.25],
      },
    })
    map.addLayer({
      id: 'routes-dashed', type: 'line', source: 'routes',
      filter: ['==', ['get', 'transport'], 'voiture'],
      paint: {
        'line-color':     ['get', 'color'],
        'line-width':     ['case', ['get', 'selected'], 6, ['get', 'dimmed'], 2,   3.5],
        'line-opacity':   ['case', ['get', 'selected'], 1, ['get', 'dimmed'], 0.18, 0.85],
        'line-dasharray': [4, 3],
      },
    })
    map.addLayer({
      id: 'routes-arc', type: 'line', source: 'routes',
      filter: ['!=', ['get', 'transport'], 'voiture'],
      paint: {
        'line-color':     ['get', 'color'],
        'line-width':     ['case', ['get', 'selected'], 5, ['get', 'dimmed'], 1.5, 2.5],
        'line-dasharray': [3, 3],
        'line-opacity':   ['case', ['get', 'selected'], 1, ['get', 'dimmed'], 0.18, 0.75],
      },
    })
  }, [])

  // Animation retirée — pointillés statiques

  // ─────────────────────────────────────────────────────────────
  // Map init
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = new maptilersdk.Map({
      container:  containerRef.current,
      style:      STYLES[0].url,
      center:     DEFAULT_CENTER,
      zoom:       DEFAULT_ZOOM,
      attributionControl: false,
      navigationControl:  false,
      geolocateControl:   false,
    })

    map.addControl(new maptilersdk.NavigationControl(), 'bottom-right')
    map.addControl(new maptilersdk.AttributionControl({ compact: true }), 'bottom-right')

    // style.load fires on every style swap; only bump version AFTER initial load
    // (transformStyle keeps our layers alive — no need to call setupLayers here)
    map.on('style.load', () => {
      if (!isFirstStyleLoadRef.current) {
        setStyleVersion(v => v + 1)
      }
      isFirstStyleLoadRef.current = false
    })

    map.on('load', () => {
      // Initial source + layer setup (runs once on first map load)
      setupLayers(map)

      // Click générique — segment detection
      map.on('click', (e) => {
        const feats = map.queryRenderedFeatures(e.point, {
          layers: ['routes-dashed', 'routes-arc'],
        })
        if (feats.length && feats[0].properties?.fromId) {
          onSelectSegment?.(feats[0].properties.fromId)
        }
      })
      map.on('mouseenter', 'routes-dashed', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'routes-dashed', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'routes-arc',    () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'routes-arc',    () => { map.getCanvas().style.cursor = '' })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [setupLayers])

  // ─────────────────────────────────────────────────────────────
  // Style switcher
  // ─────────────────────────────────────────────────────────────
  const changeStyle = useCallback((style) => {
    const map = mapRef.current
    if (!map || style.id === currentStyleId) return

    // Snapshot camera BEFORE the style wipes it
    const camera = {
      center:  map.getCenter(),
      zoom:    map.getZoom(),
      bearing: map.getBearing(),
      pitch:   map.getPitch(),
    }

    setCurrentStyleId(style.id)

    // IDs of our custom GL layers — must survive the style swap
    const CUSTOM_LAYER_IDS = new Set(['routes-glow', 'routes-base', 'routes-dashed', 'routes-arc'])

    // transformStyle merges our custom source + layers INTO the incoming style
    // before style.load fires, so they are never absent even for a single frame.
    map.setStyle(style.url, {
      transformStyle: (prevStyle, nextStyle) => ({
        ...nextStyle,
        sources: {
          ...nextStyle.sources,
          // Carry the routes source forward with the latest data snapshot
          routes: { type: 'geojson', data: lastDataRef.current },
        },
        layers: [
          // Base layers of the new style (streets, satellite tiles, etc.)
          ...nextStyle.layers.filter(l => !CUSTOM_LAYER_IDS.has(l.id)),
          // Our custom route layers from the previous style, appended on top
          ...(prevStyle.layers?.filter(l => CUSTOM_LAYER_IDS.has(l.id)) ?? []),
        ],
      }),
    })

    // Restore exact camera position after the new style finishes loading
    map.once('style.load', () => map.jumpTo(camera))
  }, [currentStyleId])

  // ─────────────────────────────────────────────────────────────
  // Update route GeoJSON
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const buildData = () => {
      const features = []
      for (let i = 0; i < steps.length - 1; i++) {
        const from = steps[i]
        const to   = steps[i + 1]
        if (!from.lat || !from.lng || !to.lat || !to.lng) continue

        const transport    = to.type_transport || 'voiture'
        const isAir        = transport === 'avion' || transport === 'ferry'
        // region_id is saved on the destination step; fall back to from if unset
        const segRegionId  = to.region_id || from.region_id
        const faded        = highlightRegionId && segRegionId !== highlightRegionId
        const hasSelection = selectedSegmentIndex !== null
        const selected     = selectedSegmentIndex === i
        // dimmed = un autre segment est sélectionné → atténuation discrète
        const dimmed       = hasSelection && !selected
        const color        = faded ? '#d1d5db' : regionColor(segRegionId, regions)

        let geometry = from.polyline_vers_suivante
          ? wktToGeojson(from.polyline_vers_suivante)
          : null

        if (!geometry) {
          geometry = isAir
            ? buildArc({ lng: from.lng, lat: from.lat }, { lng: to.lng, lat: to.lat }).geometry
            : { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }
        }

        features.push({
          type: 'Feature',
          properties: { transport: isAir ? 'avion' : 'voiture', color, selected, dimmed, fromId: from.id, segIndex: i },
          geometry,
        })
      }
      return { type: 'FeatureCollection', features }
    }

    const update = () => {
      const fc = buildData()
      lastDataRef.current = fc
      try { map.getSource('routes')?.setData(fc) } catch (_) {}
    }

    if (map.isStyleLoaded()) update()
    else map.once('load', update)
  }, [steps, regions, highlightRegionId, selectedSegmentIndex])

  // ─────────────────────────────────────────────────────────────
  // Markers
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const stepsById = Object.fromEntries(steps.map(s => [s.id, s]))

    Object.keys(markersRef.current).forEach(id => {
      if (!stepsById[id]) { markersRef.current[id].remove(); delete markersRef.current[id] }
    })

    // Endpoints du segment sélectionné (du step départ ET step arrivée)
    const sortedForMarkers = [...steps].sort((a, b) => a.ordre - b.ordre)
    const segFromId = selectedSegmentIndex !== null ? sortedForMarkers[selectedSegmentIndex]?.id     : null
    const segToId   = selectedSegmentIndex !== null ? sortedForMarkers[selectedSegmentIndex + 1]?.id : null
    const hasSegSel = selectedSegmentIndex !== null

    steps.forEach((step, index) => {
      if (!step.lat || !step.lng) return
      const status   = stepStatus(step.date_debut, step.date_fin)
      const faded    = highlightRegionId && step.region_id !== highlightRegionId
      const color    = faded ? '#9ca3af' : regionColor(step.region_id, regions)
      const pulse    = status === 'en_cours' && !faded
      // Endpoint du segment sélectionné → mis en évidence
      const isEndpoint = step.id === segFromId || step.id === segToId
      const selected = isEndpoint || step.id === selectedStepId
      // Marqueurs hors segment actif → discrets
      const dimmedMarker = hasSegSel && !isEndpoint

      const el = createMarkerEl(index + 1, color, pulse, selected, step.nom, dimmedMarker)
      el.addEventListener('click', (e) => { e.stopPropagation(); onSelectStep?.(step) })

      markersRef.current[step.id]?.remove()

      const marker = new maptilersdk.Marker({ element: el, draggable: isEditor })
        .setLngLat([step.lng, step.lat])
        .addTo(map)

      if (isEditor) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          onStepDragged?.(step.id, { lat: ll.lat, lng: ll.lng })
        })
      }
      markersRef.current[step.id] = marker
    })
  }, [steps, regions, selectedStepId, selectedSegmentIndex, isEditor, highlightRegionId, styleVersion])

  // Fly to selected step — skipped when a segment is selected (fitSegment handles it)
  useEffect(() => {
    if (!selectedStepId || !mapRef.current) return
    if (selectedSegmentIndex !== null) return
    const step = steps.find(s => s.id === selectedStepId)
    if (step?.lat && step?.lng) {
      mapRef.current.flyTo({ center: [step.lng, step.lat], zoom: 9, duration: 800 })
    }
  }, [selectedStepId, selectedSegmentIndex])

  // ── Labels durée au milieu de chaque tracé ─────────────────
  useEffect(() => {
    const map = mapRef.current
    // Supprimer les anciens labels
    Object.values(labelsRef.current).forEach(m => { try { m.remove() } catch(_) {} })
    labelsRef.current = {}
    if (!map) return

    const addLabels = () => {
      const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i]
        const to   = sorted[i + 1]
        // N'afficher que si durée calculée/saisie
        if (!from.duree_vers_suivante) continue
        if (!from.lat || !from.lng || !to.lat || !to.lng) continue

        // Point médian à 50 % de la longueur réelle du tracé
        let midLng = (from.lng + to.lng) / 2
        let midLat = (from.lat + to.lat) / 2
        if (from.polyline_vers_suivante) {
          const geo = wktToGeojson(from.polyline_vers_suivante)
          if (geo?.coordinates?.length >= 2) {
            const mid = polylineMidpoint(geo.coordinates)
            if (mid) { midLng = mid[0]; midLat = mid[1] }
          }
        }

        const text   = fmtDuration(from.duree_vers_suivante)
        const fromId = from.id

        const el = document.createElement('div')
        el.style.cssText = [
          'background:rgba(255,255,255,0.96)',
          'border:1.5px solid #e5e7eb',
          'border-radius:10px',
          'padding:3px 8px',
          'font-size:11px',
          'font-weight:600',
          'color:#374151',
          'font-family:Inter,sans-serif',
          'cursor:pointer',
          'white-space:nowrap',
          'box-shadow:0 2px 8px rgba(0,0,0,0.10)',
          'pointer-events:all',
          'user-select:none',
          'transition:background 0.15s,border-color 0.15s,opacity 0.2s',
        ].join(';')
        el.textContent = text
        el.addEventListener('mouseenter', () => {
          el.style.background    = '#f3f4f6'
          el.style.borderColor   = '#9ca3af'
        })
        el.addEventListener('mouseleave', () => {
          el.style.background    = 'rgba(255,255,255,0.96)'
          el.style.borderColor   = '#e5e7eb'
        })
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSegClickRef.current?.(fromId)
        })

        try {
          const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
            .setLngLat([midLng, midLat])
            .addTo(map)
          labelsRef.current[fromId] = marker
        } catch (_) {}
      }
    }

    if (map.isStyleLoaded()) addLabels()
    else map.once('load', addLabels)
  }, [steps, styleVersion])

  // ── Opacité des labels selon la sélection ──────────────────
  // Mise à jour in-place — pas de rebuild des Markers
  useEffect(() => {
    const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)
    sorted.slice(0, -1).forEach((from, i) => {
      const marker = labelsRef.current[from.id]
      if (!marker) return
      const el      = marker.getElement()
      const dimmed  = selectedSegmentIndex !== null && selectedSegmentIndex !== i
      el.style.opacity       = dimmed ? '0.2' : '1'
      el.style.pointerEvents = dimmed ? 'none' : 'all'
    })
  }, [selectedSegmentIndex, steps])

  // Expose fitAll / fitSegment
  const fitAll = useCallback((filterRegion = null) => {
    const map = mapRef.current
    if (!map) return
    const pts = steps.filter(s => s.lat && s.lng && (!filterRegion || s.region_id === filterRegion))
    if (!pts.length) return
    const lngs = pts.map(s => s.lng), lats = pts.map(s => s.lat)
    map.fitBounds(
      [[Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5],
       [Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5]],
      { padding: 80, duration: 900 }
    )
  }, [steps])

  const fitSegment = useCallback((from, to) => {
    const map = mapRef.current
    if (!map || !from || !to) return
    // Use all polyline coords for tighter, route-accurate bounds
    let lngs = [from.lng, to.lng]
    let lats  = [from.lat, to.lat]
    if (from.polyline_vers_suivante) {
      const geo = wktToGeojson(from.polyline_vers_suivante)
      if (geo?.coordinates?.length > 0) {
        lngs = geo.coordinates.map(c => c[0])
        lats = geo.coordinates.map(c => c[1])
      }
    }
    const pad = 0.05
    map.fitBounds(
      [[Math.min(...lngs) - pad, Math.min(...lats) - pad],
       [Math.max(...lngs) + pad, Math.max(...lats) + pad]],
      { padding: 120, duration: 900 }
    )
  }, [])

  useEffect(() => {
    if (mapContainerRef) mapContainerRef.current = { fitAll, fitSegment }
  }, [fitAll, fitSegment, mapContainerRef])

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="relative w-full h-full">
      {/* Map canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Style switcher — bas gauche, horizontal, compact */}
      <div className="absolute bottom-4 left-4 z-10 flex bg-white/92 backdrop-blur-md rounded-2xl shadow-md border border-gray-200/70 overflow-hidden">
        {STYLES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => changeStyle(s)}
            title={s.label}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap
              ${i < STYLES.length - 1 ? 'border-r border-gray-200/60' : ''}
              ${currentStyleId === s.id
                ? 'bg-navy text-white'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <span className="text-sm leading-none">{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

// Returns the [lng, lat] at exactly 50% of the polyline's total arc length.
function polylineMidpoint(coords) {
  if (!coords || coords.length < 2) return null
  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0]
    const dy = coords[i + 1][1] - coords[i][1]
    total += Math.sqrt(dx * dx + dy * dy)
  }
  const half = total / 2
  let cum = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0]
    const dy = coords[i + 1][1] - coords[i][1]
    const d  = Math.sqrt(dx * dx + dy * dy)
    if (cum + d >= half) {
      const t = (half - cum) / d
      return [coords[i][0] + t * dx, coords[i][1] + t * dy]
    }
    cum += d
  }
  return coords[Math.floor(coords.length / 2)]
}

function regionColor(regionId, regions) {
  if (!regionId) return '#1a2744'
  return regions.find(r => r.id === regionId)?.couleur || '#1a2744'
}

function createMarkerEl(number, color, pulse, selected, label, dimmed = false) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:pointer;
    transition:opacity .25s;opacity:${dimmed ? '0.3' : '1'};`

  const circle = document.createElement('div')
  circle.style.cssText = `
    width:30px;height:30px;border-radius:50%;
    background:${color};color:white;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;font-weight:700;font-family:Inter,sans-serif;
    box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2.5px solid white;
    transition:transform .2s,box-shadow .2s;
    ${selected ? 'transform:scale(1.3);box-shadow:0 6px 20px rgba(0,0,0,0.35);' : ''}
    ${pulse    ? 'animation:mapPulse 2s ease-in-out infinite;' : ''}
  `
  circle.textContent = number

  const lbl = document.createElement('div')
  lbl.style.cssText = `
    margin-top:3px;white-space:nowrap;
    font-size:11px;font-weight:600;font-family:Inter,sans-serif;color:#1d1d1f;
    text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 2px 4px rgba(255,255,255,.9);
    pointer-events:none;user-select:none;
  `
  lbl.textContent = label

  wrapper.appendChild(circle)
  wrapper.appendChild(lbl)

  if (!document.getElementById('map-pulse-style')) {
    const st = document.createElement('style')
    st.id = 'map-pulse-style'
    st.textContent = `@keyframes mapPulse{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,0.25),0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 2px 8px rgba(0,0,0,0.25),0 0 0 10px rgba(34,197,94,0)}}`
    document.head.appendChild(st)
  }

  return wrapper
}
