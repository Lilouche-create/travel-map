import { format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

// Format date in French
export function fmtDate(d) {
  if (!d) return ''
  const parsed = typeof d === 'string' ? parseISO(d) : d
  return format(parsed, 'd MMM yyyy', { locale: fr })
}

export function fmtDateShort(d) {
  if (!d) return ''
  const parsed = typeof d === 'string' ? parseISO(d) : d
  return format(parsed, 'd MMM', { locale: fr })
}

// Trip status
export function tripStatus(dateDebut, dateFin) {
  const now    = startOfDay(new Date())
  const debut  = dateDebut ? parseISO(dateDebut) : null
  const fin    = dateFin   ? parseISO(dateFin)   : null
  if (!debut || !fin) return 'inconnu'
  if (isBefore(fin, now))  return 'terminé'
  if (isAfter(debut, now)) return 'à venir'
  return 'en cours'
}

// Step status relative to today
export function stepStatus(dateDebut, dateFin) {
  const now   = startOfDay(new Date())
  const debut = dateDebut ? parseISO(dateDebut) : null
  const fin   = dateFin   ? parseISO(dateFin)   : null
  if (!debut || !fin) return 'futur'
  if (isBefore(fin, now)) return 'passé'
  if (isAfter(debut, now)) return 'futur'
  return 'en_cours'
}

// Duration in human readable
export function fmtDuration(minutes) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// Palette for regions (up to 8) — soft desaturated tones
export const REGION_PALETTE = [
  { color: '#6B8CAE', bg: '#EEF2F7' }, // Bleu ardoise
  { color: '#7A9E7E', bg: '#EFF5EF' }, // Vert sauge
  { color: '#C4956A', bg: '#FAF3EC' }, // Terre cuite
  { color: '#9B89A8', bg: '#F4F0F7' }, // Mauve grisé
  { color: '#B8A86E', bg: '#F7F4E9' }, // Ocre
  { color: '#6A9E9E', bg: '#EEF5F5' }, // Bleu-vert
  { color: '#C49898', bg: '#F7EFEF' }, // Rose poudré
  { color: '#8A9E8A', bg: '#EFF3EF' }, // Gris-vert
]

export const REGION_COLORS = REGION_PALETTE.map(p => p.color)

export function nextRegionColor(existing = []) {
  const used = existing.map(r => r.couleur)
  return REGION_COLORS.find(c => !used.includes(c)) || REGION_COLORS[0]
}

export function regionBgColor(color) {
  return REGION_PALETTE.find(p => p.color === color)?.bg || (color ? color + '18' : '#f5f5f5')
}

// Transport icon
export function transportIcon(type) {
  switch (type) {
    case 'avion':  return '✈️'
    case 'ferry':  return '⛴️'
    case 'autre':  return '🚶'
    default:       return '🚗'
  }
}

// Encode / decode polyline (for GeoJSON ↔ Supabase storage)
export function geojsonToWKT(geojson) {
  return JSON.stringify(geojson)
}
export function wktToGeojson(str) {
  try { return JSON.parse(str) } catch { return null }
}

// Distance à vol d'oiseau (km) — utilisée pour avion/ferry
export function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function deg2rad(deg) { return deg * (Math.PI / 180) }
