import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchRoute, buildArc } from '../lib/maptiler'
import { geojsonToWKT } from '../lib/utils'

export function useTrip(tripId) {
  const [trip, setTrip]       = useState(null)
  const [steps, setSteps]     = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const [tripRes, stepsRes, regionsRes] = await Promise.all([
        supabase.from('voyages').select('*').eq('id', tripId).single(),
        supabase.from('etapes').select('*').eq('voyage_id', tripId).order('ordre'),
        supabase.from('regions').select('*').eq('voyage_id', tripId),
      ])
      if (tripRes.error) throw tripRes.error
      setTrip(tripRes.data)
      setSteps(stepsRes.data || [])
      setRegions(regionsRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { load() }, [load])

  // ── ROUTE RECALC ────────────────────────────────────────────

  // type_transport est sur le step DESTINATION (comment on ARRIVE à ce step)
  const recalcSegment = useCallback(async (from, to) => {
    if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return
    const transport = to.type_transport || 'voiture'
    const isDriving = transport === 'voiture' || transport === 'autre'

    let routeData = null

    if (isDriving) {
      routeData = await fetchRoute(
        { lng: from.lng, lat: from.lat },
        { lng: to.lng,   lat: to.lat  }
      )
    }

    // Avion / ferry (ou routing échoué) → arc courbe
    if (!routeData) {
      const arc  = buildArc({ lng: from.lng, lat: from.lat }, { lng: to.lng, lat: to.lat })
      const dist = haversine(from.lat, from.lng, to.lat, to.lng)
      routeData  = { geometry: arc.geometry, distance: Math.round(dist), duration: null }
    }

    const update = {
      duree_vers_suivante:    routeData.duration,
      distance_vers_suivante: routeData.distance,
      polyline_vers_suivante: geojsonToWKT(routeData.geometry),
    }

    await supabase.from('etapes').update(update).eq('id', from.id)

    setSteps(prev => prev.map(s => s.id === from.id ? { ...s, ...update } : s))
  }, [])

  // Recalcule les segments adjacents à un step donné
  // On passe la liste à jour pour éviter les problèmes de closure
  const recalcRoutesAround = useCallback(async (stepId, currentSteps) => {
    const sorted = [...currentSteps].sort((a, b) => a.ordre - b.ordre)
    const idx    = sorted.findIndex(s => s.id === stepId)
    if (idx === -1) return

    const pairs = []
    if (idx > 0)                   pairs.push([sorted[idx - 1], sorted[idx]])
    if (idx < sorted.length - 1)   pairs.push([sorted[idx],     sorted[idx + 1]])

    for (const [from, to] of pairs) {
      await recalcSegment(from, to)
    }
  }, [recalcSegment])

  const recalcAllRoutes = useCallback(async (sortedSteps) => {
    for (let i = 0; i < sortedSteps.length - 1; i++) {
      await recalcSegment(sortedSteps[i], sortedSteps[i + 1])
    }
  }, [recalcSegment])

  // ── STEP CRUD ───────────────────────────────────────────────

  const saveStep = useCallback(async (stepData) => {
    const isNew = !stepData.id
    let saved
    let newSteps

    if (isNew) {
      const maxOrdre = steps.length ? Math.max(...steps.map(s => s.ordre)) + 1 : 0
      const { data, error: err } = await supabase
        .from('etapes')
        .insert({ ...stepData, voyage_id: tripId, ordre: maxOrdre })
        .select()
        .single()
      if (err) throw err
      saved    = data
      newSteps = [...steps, saved].sort((a, b) => a.ordre - b.ordre)
    } else {
      const { data, error: err } = await supabase
        .from('etapes')
        .update(stepData)
        .eq('id', stepData.id)
        .select()
        .single()
      if (err) throw err
      saved    = data
      newSteps = steps.map(s => s.id === saved.id ? saved : s)
    }

    setSteps(newSteps)
    // Passer newSteps pour éviter le problème de closure stale
    await recalcRoutesAround(saved.id, newSteps)
    return saved
  }, [steps, tripId, recalcRoutesAround])

  // ── SAVE SEGMENT (2 steps à la fois) ────────────────────────
  // from.id = null → crée un nouveau step départ
  // from.id = uuid → met à jour le step départ existant
  // to.id   = null → crée un nouveau step arrivée
  // to.id   = uuid → met à jour le step arrivée existant
  const saveSegment = useCallback(async ({ from, to }) => {
    let newSteps = [...steps]
    const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)

    // ── Step départ ──
    let fromSaved
    if (from.id) {
      const { data, error } = await supabase
        .from('etapes')
        .update({ nom: from.nom, lieu_label: from.lieu_label, lat: from.lat, lng: from.lng })
        .eq('id', from.id).select().single()
      if (error) throw error
      fromSaved = data
      newSteps = newSteps.map(s => s.id === fromSaved.id ? fromSaved : s)
    } else {
      const ordre = sorted.length > 0 ? sorted[sorted.length - 1].ordre + 1 : 0
      const { data, error } = await supabase
        .from('etapes')
        .insert({ nom: from.nom, lieu_label: from.lieu_label, lat: from.lat, lng: from.lng, voyage_id: tripId, ordre })
        .select().single()
      if (error) throw error
      fromSaved = data
      newSteps = [...newSteps, fromSaved]
    }

    // ── Step arrivée ──
    let toSaved
    const toPayload = {
      nom:            to.nom,
      lieu_label:     to.lieu_label,
      lat:            to.lat,
      lng:            to.lng,
      type_transport: to.type_transport || 'voiture',
      date_debut:     to.date_debut  || null,
      date_fin:       to.date_fin    || null,
      description:    to.description || null,
      notes_trajet:   to.notes_trajet || null,
      region_id:      to.region_id   || null,
    }
    if (to.id) {
      const { data, error } = await supabase
        .from('etapes').update(toPayload).eq('id', to.id).select().single()
      if (error) throw error
      toSaved = data
      newSteps = newSteps.map(s => s.id === toSaved.id ? toSaved : s)
    } else {
      const ordre = fromSaved.ordre + 1
      const { data, error } = await supabase
        .from('etapes')
        .insert({ ...toPayload, voyage_id: tripId, ordre })
        .select().single()
      if (error) throw error
      toSaved = data
      newSteps = [...newSteps, toSaved]
    }

    newSteps = newSteps.sort((a, b) => a.ordre - b.ordre)
    setSteps(newSteps)
    await recalcRoutesAround(fromSaved.id, newSteps)

    // Durée manuelle (avion/ferry) : écrase le null laissé par recalcSegment
    const dureeMins = to.duree_manuelle
    const isAir = to.type_transport === 'avion' || to.type_transport === 'ferry'
    if (isAir && dureeMins != null && dureeMins > 0) {
      await supabase.from('etapes')
        .update({ duree_vers_suivante: dureeMins })
        .eq('id', fromSaved.id)
      setSteps(prev => prev.map(s =>
        s.id === fromSaved.id ? { ...s, duree_vers_suivante: dureeMins } : s
      ))
    }

    return { from: fromSaved, to: toSaved }
  }, [steps, tripId, recalcRoutesAround])

  const deleteStep = useCallback(async (stepId) => {
    const { error: err } = await supabase.from('etapes').delete().eq('id', stepId)
    if (err) throw err
    setSteps(prev => prev.filter(s => s.id !== stepId).map((s, i) => ({ ...s, ordre: i })))
  }, [])

  // Supprime le step destination (toStep) d'un segment from→to.
  // Recalcule automatiquement la liaison from → newNext si elle existe.
  const deleteSegment = useCallback(async (fromStep, toStep) => {
    const sorted   = [...steps].sort((a, b) => a.ordre - b.ordre)
    const toIdx    = sorted.findIndex(s => s.id === toStep.id)
    const newNext  = sorted[toIdx + 1] // step qui suivait toStep (peut être undefined)

    // Supprimer le step destination en base
    const { error } = await supabase.from('etapes').delete().eq('id', toStep.id)
    if (error) throw error

    // Mettre à jour le state local et renuméroter l'ordre
    const newSteps = sorted
      .filter(s => s.id !== toStep.id)
      .map((s, i) => ({ ...s, ordre: i }))
    setSteps(newSteps)

    // Persister les nouveaux ordres
    await Promise.all(newSteps.map(s =>
      supabase.from('etapes').update({ ordre: s.ordre }).eq('id', s.id)
    ))

    // Recalculer from → newNext si les deux existent encore
    const fromInNew = newSteps.find(s => s.id === fromStep.id)
    const nextInNew = newNext ? newSteps.find(s => s.id === newNext.id) : null
    if (fromInNew && nextInNew) {
      await recalcSegment(fromInNew, nextInNew)
    }
  }, [steps, recalcSegment])

  const reorderSteps = useCallback(async (newSteps) => {
    setSteps(newSteps)
    const updates = newSteps.map((s, i) =>
      supabase.from('etapes').update({ ordre: i }).eq('id', s.id)
    )
    await Promise.all(updates)
    await recalcAllRoutes(newSteps)
  }, [recalcAllRoutes])

  // ── REGION CRUD ─────────────────────────────────────────────

  const saveRegion = useCallback(async (regionData) => {
    if (regionData.id) {
      const { data, error: err } = await supabase
        .from('regions').update(regionData).eq('id', regionData.id).select().single()
      if (err) throw err
      setRegions(prev => prev.map(r => r.id === data.id ? data : r))
      return data
    } else {
      const { data, error: err } = await supabase
        .from('regions').insert({ ...regionData, voyage_id: tripId }).select().single()
      if (err) throw err
      setRegions(prev => [...prev, data])
      return data
    }
  }, [tripId])

  const deleteRegion = useCallback(async (regionId) => {
    await supabase.from('regions').delete().eq('id', regionId)
    setRegions(prev => prev.filter(r => r.id !== regionId))
  }, [])

  // ── TRIP UPDATE ─────────────────────────────────────────────

  const updateTrip = useCallback(async (updates) => {
    const { data, error: err } = await supabase
      .from('voyages').update(updates).eq('id', tripId).select().single()
    if (err) throw err
    setTrip(data)
    return data
  }, [tripId])

  return {
    trip, steps, regions, loading, error,
    reload: load,
    saveStep, saveSegment, deleteStep, deleteSegment, reorderSteps,
    saveRegion, deleteRegion,
    updateTrip,
    recalcAllRoutes,
  }
}

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function deg2rad(deg) { return deg * (Math.PI / 180) }
