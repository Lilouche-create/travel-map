import * as maptilersdk from '@maptiler/sdk'

export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

maptilersdk.config.apiKey = MAPTILER_KEY

export { maptilersdk }

// Geocoding — forward search
export async function geocodePlace(query) {
  try {
    const res = await maptilersdk.geocoding.forward(query, {
      limit: 6,
      language: ['fr', 'en'],
    })
    return res.features || []
  } catch (err) {
    console.error('Geocoding error', err)
    return []
  }
}

// Routing via OSRM (driving)
export async function fetchRoute(from, to) {
  // from/to: { lng, lat }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null
    const route = data.routes[0]
    return {
      geometry:   route.geometry,                         // GeoJSON LineString
      distance:   Math.round(route.distance / 1000),      // km
      duration:   Math.round(route.duration / 60),        // minutes
    }
  } catch (err) {
    console.error('Routing error', err)
    return null
  }
}

// Build a curved arc (for flights / ferries) as GeoJSON
export function buildArc(from, to, steps = 100) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const t   = i / steps
    const lng = from.lng + (to.lng - from.lng) * t
    const lat = from.lat + (to.lat - from.lat) * t
    // Lift the midpoint to create a curve
    const lift = Math.sin(Math.PI * t) * Math.abs(to.lng - from.lng) * 0.18
    coords.push([lng, lat + lift])
  }
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
  }
}
