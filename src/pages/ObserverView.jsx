import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Map, Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import MapView from '../components/map/MapView'
import Sidebar from '../components/sidebar/Sidebar'
import SegmentDetail from '../components/steps/SegmentDetail'
import CalendarView from '../components/calendar/CalendarView'

export default function ObserverView() {
  const { uuid } = useParams()
  const mapApi   = useRef(null)

  const [trip, setTrip]         = useState(null)
  const [steps, setSteps]       = useState([])
  const [regions, setRegions]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [view, setView]                     = useState('map')
  const [selectedFrom, setSelectedFrom]     = useState(null)  // step départ du segment
  const [selectedTo, setSelectedTo]         = useState(null)  // step arrivée (destination)
  const [selectedSegIdx, setSelectedSegIdx] = useState(null)
  const [panelOpen, setPanelOpen]           = useState(false)
  const [highlightRegion, setHighlightRegion] = useState(null)
  const [isFullscreen, setIsFullscreen]     = useState(false)

  const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)

  useEffect(() => {
    const load = async () => {
      const { data: tripData, error } = await supabase
        .from('voyages').select('*').eq('lien_uuid', uuid).single()
      // Voyage introuvable OU en corbeille (soft delete)
      if (error || !tripData || tripData.deleted_at) { setNotFound(true); setLoading(false); return }
      setTrip(tripData)

      const [stepsRes, regionsRes] = await Promise.all([
        supabase.from('etapes').select('*').eq('voyage_id', tripData.id).order('ordre'),
        supabase.from('regions').select('*').eq('voyage_id', tripData.id),
      ])
      setSteps(stepsRes.data || [])
      setRegions(regionsRes.data || [])
      setLoading(false)
    }
    load()
  }, [uuid])

  const handleSelectStep = (step) => {
    // Clic sur un marqueur : affiche le segment qui ARRIVE à ce step
    const idx  = sorted.findIndex(s => s.id === step.id)
    const prev = sorted[idx - 1] || null
    setSelectedFrom(prev)
    setSelectedTo(step)
    setSelectedSegIdx(idx > 0 ? idx - 1 : null)
    setPanelOpen(true)
  }
  const handleSelectSegment = (fromStepId, segIndex) => {
    const from = sorted.find(s => s.id === fromStepId)
    const to   = sorted[sorted.indexOf(from) + 1]
    setSelectedSegIdx(segIndex ?? sorted.indexOf(from))
    setSelectedFrom(from)
    setSelectedTo(to)
    setPanelOpen(true)
    if (mapApi.current?.fitSegment && from && to) mapApi.current.fitSegment(from, to)
  }
  const handleGlobalView = () => {
    setHighlightRegion(null)
    if (mapApi.current?.fitAll) mapApi.current.fitAll()
  }
  const handleRegionClick = (regionId) => {
    setHighlightRegion(prev => prev === regionId ? null : regionId)
    if (mapApi.current?.fitAll) mapApi.current.fitAll(regionId)
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-gray-400">
      Chargement de votre itinéraire…
    </div>
  )
  if (notFound) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-gray-500">
      <p className="text-3xl">🗺️</p>
      <p className="font-medium">Itinéraire introuvable</p>
      <p className="text-sm text-gray-400">Ce lien n'existe pas ou a été supprimé.</p>
    </div>
  )

  const theMap = (
    <MapView
      steps={steps} regions={regions}
      selectedStepId={selectedTo?.id}
      selectedSegmentIndex={selectedSegIdx}
      onSelectStep={handleSelectStep}
      onSelectSegment={(fromId) => {
        const idx = sorted.findIndex(s => s.id === fromId)
        handleSelectSegment(fromId, idx)
      }}
      isEditor={false}
      highlightRegionId={highlightRegion}
      mapContainerRef={mapApi}
    />
  )

  // ── MODE PLEIN ÉCRAN ────────────────────────────────────────
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {theMap}

        {trip?.logo_url && (
          <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg border border-white/50">
            <img src={trip.logo_url} alt="Logo agence" className="h-8 object-contain" style={{ maxWidth: 120 }} />
          </div>
        )}

        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-lg border border-white/50 flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm font-medium transition"
        >
          <Minimize2 size={15} />
          Quitter
        </button>
      </div>
    )
  }

  // ── MODE NORMAL ─────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{trip?.nom}</h1>
          {trip?.nom_client && <p className="text-xs text-gray-400 truncate">{trip.nom_client}</p>}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[{ key: 'map', label: 'Carte', Icon: Map }, { key: 'calendar', label: 'Calendrier', Icon: Calendar }].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                view === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Plein écran */}
        <button
          onClick={() => setIsFullscreen(true)}
          title="Plein écran"
          className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <Maximize2 size={15} />
        </button>

        {trip?.logo_url && (
          <div className="bg-white border border-gray-100 rounded-xl px-2 py-1 shadow-sm">
            <img src={trip.logo_url} alt="Logo agence" className="h-8 object-contain" style={{ maxWidth: 120 }} />
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          steps={steps} regions={regions}
          selectedSegmentIndex={selectedSegIdx}
          isEditor={false}
          onSelectSegment={handleSelectSegment}
          onGlobalView={handleGlobalView}
          onRegionClick={handleRegionClick}
        />

        <main className="flex-1 flex overflow-hidden">
          {view === 'map' ? theMap : (
            <CalendarView steps={steps} regions={regions} onSelectStep={handleSelectStep} />
          )}
        </main>

        {panelOpen && selectedTo && (
          <SegmentDetail
            from={selectedFrom}
            to={selectedTo}
            regions={regions}
            isEditor={false}       // pas de bouton "Modifier"
            onClose={() => { setPanelOpen(false); setSelectedFrom(null); setSelectedTo(null); setSelectedSegIdx(null) }}
          />
        )}
      </div>
    </div>
  )
}
