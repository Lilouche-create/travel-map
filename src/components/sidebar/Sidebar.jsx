import { useState, useEffect, useRef } from 'react'
import {
  Globe, ChevronDown, ChevronRight, Plus, MapPin,
  Pencil, GripVertical, Check, ChevronUp, ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import SegmentItem from './SegmentItem'
import Button from '../ui/Button'
import { stepStatus, regionBgColor } from '../../lib/utils'

export default function Sidebar({
  steps = [],
  regions = [],
  selectedSegmentIndex,
  onSelectSegment,
  isEditor,
  onEditSegment,
  onEditLastStep,
  onAddStep,
  onGlobalView,
  onRegionClick,
  onShareLink,
  onDeleteSegment,
  onReorder,
}) {
  const [collapsed, setCollapsed]         = useState({})
  const [reorderMode, setReorderMode]     = useState(false)
  const [localSteps, setLocalSteps]       = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const dragFromRef  = useRef(null)
  const didInitRef   = useRef(false)
  const [dragOver, setDragOver] = useState(null)

  const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)

  // Sync localSteps when not in reorder mode
  useEffect(() => {
    if (!reorderMode) setLocalSteps(sorted)
  }, [steps, reorderMode])

  // One-time init: expand the region containing the 'en_cours' step, collapse others
  useEffect(() => {
    if (didInitRef.current || steps.length === 0) return
    didInitRef.current = true

    const activeStep     = sorted.find(s => stepStatus(s.date_debut, s.date_fin) === 'en_cours')
    const activeRegionId = activeStep?.region_id ?? null
    if (!activeRegionId) return

    const init = { _ungrouped: true }
    regions.forEach(r => { if (r.id !== activeRegionId) init[r.id] = true })
    setCollapsed(init)
  }, [steps, regions])

  const displaySteps = reorderMode ? localSteps : sorted

  // Segments derived from current steps
  const segments = displaySteps.slice(0, -1).map((from, i) => ({
    from, to: displaySteps[i + 1], index: i,
  }))
  const lastStep = displaySteps.length > 0 ? displaySteps[displaySteps.length - 1] : null

  // Group segments by region — region_id lives on the destination step (seg.to)
  const regionGroups = {}
  const ungrouped    = []
  segments.forEach(seg => {
    const rId = seg.to.region_id
    if (rId) { if (!regionGroups[rId]) regionGroups[rId] = []; regionGroups[rId].push(seg) }
    else      { ungrouped.push(seg) }
  })

  // Regions that actually have segments (preserve display order)
  const activeRegions = regions.filter(r => regionGroups[r.id]?.length > 0)

  const toggleRegion = (id) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  // ── Drag & drop ──────────────────────────────────────────────
  const handleDragStart = (e, index) => {
    dragFromRef.current = index
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    setDragOver(index)
    if (dragFromRef.current === null || dragFromRef.current === index) return
    const next = [...localSteps]
    const [moved] = next.splice(dragFromRef.current, 1)
    next.splice(index, 0, moved)
    dragFromRef.current = index
    setLocalSteps(next)
  }
  const handleDragEnd = () => { dragFromRef.current = null; setDragOver(null) }

  const moveStep = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= localSteps.length) return
    const next = [...localSteps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setLocalSteps(next)
  }

  const handleSaveOrder = () => {
    onReorder?.(localSteps.map((s, i) => ({ ...s, ordre: i })))
    setReorderMode(false)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    await onDeleteSegment?.(confirmDelete.from, confirmDelete.to)
    setConfirmDelete(null)
  }

  // ── Render one segment row ───────────────────────────────────
  const renderSegment = (seg, regionColor = null, regionBg = null) => (
    <div key={`${seg.from.id}-${seg.to?.id}`}>
      <SegmentItem
        from={seg.from}
        to={seg.to}
        index={seg.index}
        isSelected={selectedSegmentIndex === seg.index}
        isEditor={isEditor && !reorderMode}
        onEdit={(from, to) => onEditSegment?.(from, to)}
        onDelete={() => setConfirmDelete({ from: seg.from, to: seg.to })}
        onClick={() => !reorderMode && onSelectSegment?.(seg.from.id, seg.index)}
        regionColor={regionColor}
        regionBg={regionBg}
      />

      {/* Inline delete confirmation */}
      {confirmDelete && confirmDelete.from.id === seg.from.id && (
        <div className="mx-2 mb-1 bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
          <p className="text-xs text-red-700 font-medium leading-snug">
            Supprimer le trajet <strong>{seg.from.nom} → {seg.to?.nom}</strong> ?<br/>
            <span className="font-normal text-red-500">La destination "{seg.to?.nom}" sera retirée de l'itinéraire.</span>
          </p>
          <div className="flex gap-2">
            <button onClick={handleConfirmDelete}
              className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition">
              Supprimer
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="flex-1 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="px-3 py-2 border-b border-gray-50 flex items-center gap-2">
        <button
          onClick={() => { onGlobalView?.(); setConfirmDelete(null) }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition flex-1"
        >
          <Globe size={13} /> Vue globale
        </button>

        {isEditor && (
          reorderMode ? (
            <button onClick={handleSaveOrder}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition">
              <Check size={13} /> Terminer
            </button>
          ) : (
            <button
              onClick={() => { setReorderMode(true); setLocalSteps(sorted); setConfirmDelete(null) }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition"
              title="Réorganiser les étapes"
            >
              <GripVertical size={13} /> Réorganiser
            </button>
          )
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto py-2">

        {/* ══ REORDER MODE ══ */}
        {reorderMode ? (
          <div className="space-y-1 px-2">
            <p className="text-[10px] text-gray-400 px-2 pb-1">
              Glissez les étapes ou utilisez ↑ ↓ pour changer l'ordre.
            </p>
            {localSteps.map((step, i) => (
              <div
                key={step.id}
                draggable
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                onDrop={e => e.preventDefault()}
                className={`flex items-center gap-2 px-2 py-2.5 rounded-xl border transition select-none ${
                  dragOver === i ? 'border-navy/30 bg-navy/5' : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <GripVertical size={14} className="text-gray-300 cursor-grab flex-shrink-0" />
                <span className="w-5 h-5 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{step.nom}</span>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition p-0.5">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === localSteps.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition p-0.5">
                    <ChevronDownIcon size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        ) : (
          /* ══ NORMAL MODE — accordion par région ══ */
          <div>
            {displaySteps.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8 px-4">
                Aucune étape — cliquez sur "Ajouter un trajet" pour commencer.
              </p>
            )}

            {/* Regions with segments */}
            {activeRegions.map(region => {
              const group  = regionGroups[region.id]
              const open   = !collapsed[region.id]
              const rColor = region.couleur
              const rBg    = regionBgColor(rColor)

              return (
                <div key={region.id} className="mb-0.5">
                  {/* Accordion header */}
                  <button
                    onClick={() => { toggleRegion(region.id); onRegionClick?.(region.id) }}
                    style={{ backgroundColor: rBg, borderLeft: `3px solid ${rColor}` }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 transition-opacity hover:opacity-80"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rColor }} />
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest flex-1 text-left truncate"
                      style={{ color: rColor }}
                    >
                      {region.nom}
                    </span>
                    <span style={{ color: rColor }} className="flex-shrink-0">
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  </button>

                  {/* Segment rows */}
                  {open && (
                    <div>
                      {group.map(seg => renderSegment(seg, rColor, rBg))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Ungrouped segments — "Sans région" at bottom */}
            {ungrouped.length > 0 && (
              <div className="mb-0.5">
                <button
                  onClick={() => toggleRegion('_ungrouped')}
                  style={{ borderLeft: '3px solid #888888', backgroundColor: '#f5f5f5' }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 transition-opacity hover:opacity-80"
                >
                  <span className="w-2 h-2 rounded-full bg-[#888888] flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-widest flex-1 text-left text-[#888888]">
                    Sans région
                  </span>
                  <span className="text-gray-400 flex-shrink-0">
                    {!collapsed['_ungrouped'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                </button>
                {!collapsed['_ungrouped'] && (
                  <div>
                    {ungrouped.map(seg => renderSegment(seg, null, null))}
                  </div>
                )}
              </div>
            )}

            {/* Destination finale */}
            {lastStep && displaySteps.length > 1 && (
              <div className="mt-2 pt-2 mx-2 border-t border-gray-100">
                <div className="flex items-center justify-between px-2 py-1.5 rounded-xl group">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destination finale</p>
                      <p className="text-sm font-bold text-gray-900">{lastStep.nom}</p>
                    </div>
                  </div>
                  {isEditor && (
                    <button onClick={() => onEditLastStep?.(lastStep)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-navy p-0.5 rounded transition-all">
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actions bas ── */}
      {isEditor && !reorderMode && (
        <div className="px-3 py-3 border-t border-gray-100 space-y-2">
          <Button onClick={onAddStep} className="w-full" size="sm">
            <Plus size={14} /> Ajouter un trajet
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={onShareLink}>
            Lien client
          </Button>
        </div>
      )}

      {/* ── Légende régions ── */}
      {regions.length > 0 && !reorderMode && (
        <div className="px-3 py-3 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Régions</p>
          <div className="flex flex-wrap gap-1.5">
            {regions.map(r => (
              <button
                key={r.id}
                onClick={() => onRegionClick?.(r.id)}
                style={{ borderColor: r.couleur, color: r.couleur, backgroundColor: regionBgColor(r.couleur) }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition hover:opacity-80"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.couleur }} />
                {r.nom}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
