import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Map, Settings, Link, Maximize2, Minimize2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTrip } from '../hooks/useTrip'
import { useAuth } from '../hooks/useAuth'
import MapView from '../components/map/MapView'
import Sidebar from '../components/sidebar/Sidebar'
import SegmentPanel from '../components/steps/SegmentPanel'
import SegmentDetail from '../components/steps/SegmentDetail'
import StepPanel from '../components/steps/StepPanel'
import CalendarView from '../components/calendar/CalendarView'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'

export default function TripEditor() {
  const { tripId }  = useParams()
  const navigate    = useNavigate()
  const { agent }   = useAuth()
  const mapApi      = useRef(null)

  const {
    trip, steps, regions, loading, error,
    saveStep, saveSegment, deleteStep, deleteSegment, reorderSteps,
    saveRegion,
    updateTrip,
    recalcAllRoutes,
  } = useTrip(tripId)

  const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)

  // ── Panel state ─────────────────────────────────────────────
  // mode: null | 'new-segment' | 'edit-segment' | 'edit-step'
  const [panelMode, setPanelMode]     = useState(null)
  const [editFrom, setEditFrom]       = useState(null)   // step départ
  const [editTo, setEditTo]           = useState(null)   // step arrivée
  const [selectedSegIdx, setSelectedSegIdx] = useState(null)

  const [view, setView]               = useState('map')
  const [highlightRegion, setHighlightRegion] = useState(null)
  const [showShare, setShowShare]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const observerUrl = trip ? `${window.location.origin}/voyage/${trip.lien_uuid}` : ''

  const closePanel = useCallback(() => {
    setPanelMode(null); setEditFrom(null); setEditTo(null); setSelectedSegIdx(null)
  }, [])

  // ── Ajouter un trajet (pré-remplit le départ avec la dernière étape) ──
  const handleAddSegment = useCallback(() => {
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null
    setEditFrom(last)   // null ou la dernière étape
    setEditTo(null)
    setPanelMode('new-segment')
  }, [sorted])

  // ── Clic sur un segment (sidebar ou carte) → panneau détail ──
  const handleSelectSegment = useCallback((fromStepId, segIndex) => {
    const from = sorted.find(s => s.id === fromStepId)
    const to   = sorted[sorted.indexOf(from) + 1]
    setSelectedSegIdx(segIndex ?? sorted.indexOf(from))
    setEditFrom(from); setEditTo(to)
    setPanelMode('view-segment')   // affiche le détail, pas le formulaire
    if (mapApi.current?.fitSegment && from && to) mapApi.current.fitSegment(from, to)
  }, [sorted])

  // ── Édition d'un segment via le crayon du menu (from+to) ────
  const handleEditSegment = useCallback((from, to) => {
    const idx = sorted.findIndex(s => s.id === from.id)
    setSelectedSegIdx(idx)
    setEditFrom(from); setEditTo(to)
    setPanelMode('edit-segment')
  }, [sorted])

  // ── Édition de la destination finale (dernier step seul) ────
  const handleEditLastStep = useCallback((step) => {
    setEditFrom(step); setEditTo(null)
    setPanelMode('edit-step')
  }, [])

  // ── Clic sur un marqueur carte → panneau détail ──────────────
  const handleSelectStep = useCallback((step) => {
    const idx = sorted.findIndex(s => s.id === step.id)
    const next = sorted[idx + 1]
    if (next) {
      setSelectedSegIdx(idx)
      setEditFrom(step); setEditTo(next)
      setPanelMode('view-segment')  // détail d'abord
      if (mapApi.current?.fitSegment) mapApi.current.fitSegment(step, next)
    } else {
      // Dernière étape → pas de suivant, affiche quand même
      setEditFrom(sorted[idx - 1] || null); setEditTo(step)
      setPanelMode('view-segment')
    }
  }, [sorted])

  // ── Save segment ─────────────────────────────────────────────
  const handleSaveSegment = useCallback(async (segmentData) => {
    await saveSegment(segmentData)
    closePanel()
  }, [saveSegment, closePanel])

  // ── Save step seul (dernière étape) ─────────────────────────
  const handleSaveStep = useCallback(async (data) => {
    const saved = await saveStep(data)
    setEditFrom(saved)
  }, [saveStep])

  const handleDeleteStep = useCallback(async (stepId) => {
    await deleteStep(stepId); closePanel()
  }, [deleteStep, closePanel])

  const handleStepDragged = useCallback(async (stepId, pos) => {
    await saveStep({ id: stepId, ...pos })
  }, [saveStep])

  const handleRegionClick = useCallback((regionId) => {
    setHighlightRegion(prev => prev === regionId ? null : regionId)
    if (mapApi.current?.fitAll) mapApi.current.fitAll(regionId)
  }, [])

  const handleGlobalView = useCallback(() => {
    setHighlightRegion(null)
    if (mapApi.current?.fitAll) mapApi.current.fitAll()
  }, [])

  const copyLink = async () => {
    await navigator.clipboard.writeText(observerUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleLogoUpload = async (file) => {
    if (!file) return
    const path = `logos/${trip.id}.${file.name.split('.').pop()}`
    await supabase.storage.from('photos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('photos').getPublicUrl(path)
    await updateTrip({ logo_url: data.publicUrl })
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400">Chargement…</div>
  if (error)   return <div className="h-screen flex items-center justify-center text-red-500">{error}</div>
  if (!trip)   return null

  // ── Panel à afficher ─────────────────────────────────────────
  const rightPanel = (() => {
    if (!panelMode) return null

    // Détail lecture seule → clic sidebar / marqueur / label durée
    if (panelMode === 'view-segment') {
      return (
        <SegmentDetail
          from={editFrom}
          to={editTo}
          regions={regions}
          isEditor
          onEdit={() => setPanelMode('edit-segment')}
          onClose={closePanel}
        />
      )
    }

    // Formulaire édition segment
    if (panelMode === 'new-segment' || panelMode === 'edit-segment') {
      return (
        <SegmentPanel
          fromStep={panelMode === 'edit-segment' ? editFrom : null}
          toStep={panelMode === 'edit-segment' ? editTo : null}
          lastStep={panelMode === 'new-segment' ? editFrom : null}
          isNew={panelMode === 'new-segment'}
          regions={regions}
          onSave={handleSaveSegment}
          onDelete={panelMode === 'edit-segment' ? handleDeleteStep : null}
          onClose={closePanel}
          onCreateRegion={saveRegion}
        />
      )
    }

    if (panelMode === 'edit-step') {
      return (
        <StepPanel
          step={editFrom}
          regions={regions}
          onSave={handleSaveStep}
          onDelete={handleDeleteStep}
          onClose={closePanel}
          onCreateRegion={saveRegion}
        />
      )
    }
    return null
  })()

  // ── Carte ────────────────────────────────────────────────────
  const theMap = (
    <MapView
      steps={steps}
      regions={regions}
      selectedStepId={editFrom?.id}
      selectedSegmentIndex={selectedSegIdx}
      onSelectStep={handleSelectStep}
      onSelectSegment={(fromId) => {
        const idx = sorted.findIndex(s => s.id === fromId)
        handleSelectSegment(fromId, idx)
      }}
      isEditor
      onStepDragged={handleStepDragged}
      highlightRegionId={highlightRegion}
      mapContainerRef={mapApi}
    />
  )

  // ── Plein écran ──────────────────────────────────────────────
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {theMap}
        {trip.logo_url && (
          <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg border border-white/50">
            <img src={trip.logo_url} alt="Logo" className="h-8 object-contain" style={{ maxWidth: 120 }} />
          </div>
        )}
        <button onClick={() => setIsFullscreen(false)}
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-lg border border-white/50 flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm font-medium transition">
          <Minimize2 size={15} /> Quitter
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 z-10">
        <button onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{trip.nom}</h1>
          {trip.nom_client && <p className="text-xs text-gray-400 truncate">{trip.nom_client}</p>}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[{ key: 'map', label: 'Carte', Icon: Map }, { key: 'calendar', label: 'Calendrier', Icon: Calendar }].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
          <Link size={13} />Lien client
        </button>
        <button onClick={() => setIsFullscreen(true)} title="Plein écran"
          className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition">
          <Maximize2 size={15} />
        </button>
        <button onClick={() => setShowSettings(true)}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
          <Settings size={15} />
        </button>
        {trip.logo_url && (
          <div className="bg-white border border-gray-100 rounded-lg px-2 py-1 shadow-sm">
            <img src={trip.logo_url} alt="Logo" className="h-7 object-contain" />
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          steps={steps} regions={regions}
          selectedSegmentIndex={selectedSegIdx}
          isEditor
          onSelectSegment={handleSelectSegment}
          onEditSegment={handleEditSegment}
          onEditLastStep={handleEditLastStep}
          onAddStep={handleAddSegment}
          onGlobalView={handleGlobalView}
          onRegionClick={handleRegionClick}
          onShareLink={() => setShowShare(true)}
          onDeleteSegment={deleteSegment}
          onReorder={reorderSteps}
        />
        <main className="flex-1 flex overflow-hidden">
          {view === 'map' ? theMap : (
            <CalendarView steps={steps} regions={regions} onSelectStep={handleSelectStep} />
          )}
        </main>
        {rightPanel}
      </div>

      {/* Modal partage */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Partager ce voyage">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Partagez ce lien avec votre client pour qu'il consulte l'itinéraire.</p>
          <div className="flex items-center gap-2">
            <input readOnly value={observerUrl} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-700" />
            <Button onClick={copyLink} size="sm">{copied ? '✓ Copié' : 'Copier'}</Button>
          </div>
          <div className="flex justify-center mt-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <QRCodeSVG value={observerUrl} size={160} />
            </div>
          </div>
          <p className="text-xs text-center text-gray-400">QR Code pour partager en rendez-vous</p>
        </div>
      </Modal>

      {/* Modal paramètres */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Paramètres du voyage">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Logo agence (ce voyage)</label>
            <div className="flex items-center gap-3">
              {trip.logo_url && <img src={trip.logo_url} alt="" className="h-10 object-contain rounded-lg border border-gray-100 p-1" />}
              <label className="cursor-pointer px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                {trip.logo_url ? 'Changer' : 'Ajouter logo'}
                <input type="file" accept=".png,.svg,.jpg,.webp" className="hidden"
                  onChange={e => handleLogoUpload(e.target.files?.[0])} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Recalculer tous les itinéraires</label>
            <Button variant="secondary" size="sm"
              onClick={() => recalcAllRoutes([...steps].sort((a, b) => a.ordre - b.ordre))}>
              Recalculer les routes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
