import { useState, useEffect, useRef } from 'react'
import { X, Search, MapPin, ArrowDown } from 'lucide-react'
import Button from '../ui/Button'
import { geocodePlace, fetchRoute } from '../../lib/maptiler'
import { fmtDuration, transportIcon, nextRegionColor, haversine } from '../../lib/utils'

const TRANSPORTS = [
  { value: 'voiture', label: 'Voiture' },
  { value: 'avion',   label: 'Avion'   },
  { value: 'ferry',   label: 'Ferry'   },
  { value: 'autre',   label: 'Autre'   },
]

const emptyFrom = { id: null, nom: '', lieu_label: '', lat: null, lng: null }
const emptyTo   = {
  id: null, nom: '', lieu_label: '', lat: null, lng: null,
  type_transport: 'voiture',
  date_debut: '', date_fin: '',
  description: '', notes_trajet: '', region_id: '',
}

// ── Champ géocodage avec pill ────────────────────────────────────────
function GeoField({ label, city, onPick, placeholder }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  // Vide la recherche quand la city est réinitialisée de l'extérieur
  useEffect(() => { if (!city) setQuery('') }, [city])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      const r = await geocodePlace(query)
      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer.current)
  }, [query])

  const pick = (feature) => {
    const [lng, lat] = feature.geometry.coordinates
    const label = feature.place_name || ''
    // Auto-détecte région depuis le contexte MapTiler
    let regionCtx = null
    const ctx = feature.context || []
    const rc = ctx.find(c => c.id?.startsWith('region') || c.id?.startsWith('state') || c.id?.startsWith('province'))
    if (rc?.text) regionCtx = rc.text
    onPick({
      nom:        feature.text || label.split(',')[0],
      lieu_label: label,
      lat:        parseFloat(lat.toFixed(6)),
      lng:        parseFloat(lng.toFixed(6)),
    }, regionCtx)
    setQuery(''); setResults([])
  }

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}
      </label>

      {city?.lat ? (
        // Ville sélectionnée → pill
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-navy/25 bg-navy/5">
          <MapPin size={13} className="text-navy flex-shrink-0" />
          <span className="text-sm font-semibold text-navy flex-1 truncate">{city.nom}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        // Champ de recherche
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</span>
          )}
          {results.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              {results.slice(0, 5).map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(f)}
                  className="flex items-start gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                >
                  <MapPin size={12} className="mt-0.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 line-clamp-2">{f.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────
export default function SegmentPanel({
  fromStep,       // step départ existant (null si nouveau)
  toStep,         // step arrivée existant (null si nouveau)
  lastStep,       // dernière étape du voyage → pré-remplit le départ si fromStep=null
  isNew,          // true = création, false = modification
  regions = [],
  onSave,
  onDelete,       // optionnel — supprime le step d'arrivée
  onClose,
  onCreateRegion,
}) {
  const [from, setFrom]       = useState({ ...emptyFrom })
  const [to, setTo]           = useState({ ...emptyTo })
  const [preview, setPreview] = useState(null)  // { distance, duration }
  const [previewLoading, setPreviewLoading] = useState(false)
  const [newRegionName, setNewRegionName]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [err, setErr]         = useState('')
  // Durée manuelle (avion / ferry) en heures + minutes
  const [dureeManuH, setDureeManuH] = useState('')
  const [dureeManuM, setDureeManuM] = useState('')
  const previewTimer = useRef(null)

  // ── Init form ──────────────────────────────────────────────
  useEffect(() => {
    // Départ : fromStep si édition, sinon lastStep (pré-remplissage)
    const initFrom = fromStep || lastStep
    if (initFrom) {
      setFrom({ id: initFrom.id, nom: initFrom.nom || '', lieu_label: initFrom.lieu_label || '', lat: initFrom.lat, lng: initFrom.lng })
    } else {
      setFrom({ ...emptyFrom })
    }
    // Arrivée
    if (toStep) {
      setTo({ id: toStep.id, nom: toStep.nom || '', lieu_label: toStep.lieu_label || '', lat: toStep.lat, lng: toStep.lng, type_transport: toStep.type_transport || 'voiture', date_debut: toStep.date_debut || '', date_fin: toStep.date_fin || '', description: toStep.description || '', notes_trajet: toStep.notes_trajet || '', region_id: toStep.region_id || '' })
    } else {
      setTo({ ...emptyTo })
    }
    // Pré-remplir la durée manuelle si avion/ferry et valeur existante
    const transport = toStep?.type_transport || 'voiture'
    if (fromStep?.duree_vers_suivante && (transport === 'avion' || transport === 'ferry')) {
      const mins = fromStep.duree_vers_suivante
      setDureeManuH(String(Math.floor(mins / 60)))
      setDureeManuM(String(mins % 60))
    } else {
      setDureeManuH(''); setDureeManuM('')
    }
    setPreview(null); setErr(''); setConfirmDel(false)
  }, [fromStep?.id, toStep?.id, lastStep?.id])

  // ── Preview route ──────────────────────────────────────────
  useEffect(() => {
    if (!from.lat || !from.lng || !to.lat || !to.lng) { setPreview(null); return }
    clearTimeout(previewTimer.current)
    setPreviewLoading(true)
    previewTimer.current = setTimeout(async () => {
      try {
        if (to.type_transport === 'voiture' || to.type_transport === 'autre') {
          const r = await fetchRoute({ lng: from.lng, lat: from.lat }, { lng: to.lng, lat: to.lat })
          setPreview(r || { distance: Math.round(haversine(from.lat, from.lng, to.lat, to.lng)), duration: null })
        } else {
          setPreview({ distance: Math.round(haversine(from.lat, from.lng, to.lat, to.lng)), duration: null })
        }
      } catch { setPreview(null) }
      setPreviewLoading(false)
    }, 700)
    return () => clearTimeout(previewTimer.current)
  }, [from.lat, from.lng, to.lat, to.lng, to.type_transport])

  // ── Geo pick helpers ───────────────────────────────────────
  const pickFrom = (geo, _regionCtx) => {
    if (!geo) { setFrom({ ...emptyFrom }); return }
    setFrom({ id: null, ...geo })  // nouvelle ville → pas d'id
  }

  const pickTo = async (geo, regionCtx) => {
    if (!geo) { setTo(p => ({ ...p, ...emptyFrom })); return }
    let matchedRegionId = to.region_id || ''
    if (regionCtx) {
      const existing = regions.find(r => r.nom.toLowerCase() === regionCtx.toLowerCase())
      if (existing) {
        matchedRegionId = existing.id
      } else {
        const created = await onCreateRegion?.({ nom: regionCtx, couleur: nextRegionColor(regions) })
        if (created) matchedRegionId = created.id
      }
    }
    setTo(p => ({ ...p, id: null, ...geo, region_id: matchedRegionId }))
  }

  // ── Save ───────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    if (!from.nom || !from.lat) { setErr('Renseignez le départ'); return }
    if (!to.nom   || !to.lat)   { setErr("Renseignez l'arrivée"); return }
    setSaving(true); setErr('')
    // Durée manuelle → minutes (pour avion/ferry uniquement)
    const isAir = to.type_transport === 'avion' || to.type_transport === 'ferry'
    const dureeMins = isAir
      ? (parseInt(dureeManuH || 0) * 60 + parseInt(dureeManuM || 0)) || null
      : null
    try {
      await onSave({
        from: { id: fromStep?.id || from.id, nom: from.nom, lieu_label: from.lieu_label, lat: from.lat, lng: from.lng },
        to:   { id: toStep?.id   || to.id,   nom: to.nom,   lieu_label: to.lieu_label,   lat: to.lat,   lng: to.lng,
                type_transport: to.type_transport, date_debut: to.date_debut || null, date_fin: to.date_fin || null,
                description: to.description, notes_trajet: to.notes_trajet, region_id: to.region_id || null,
                duree_manuelle: dureeMins },
      })
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleCreateRegion = async () => {
    if (!newRegionName.trim()) return
    const r = await onCreateRegion({ nom: newRegionName.trim(), couleur: nextRegionColor(regions) })
    if (r) { setTo(p => ({ ...p, region_id: r.id })); setNewRegionName('') }
  }

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          {isNew ? 'Ajouter un trajet' : 'Modifier le trajet'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Départ */}
        <GeoField
          label="Départ"
          city={from.lat ? from : null}
          onPick={pickFrom}
          placeholder="Rechercher une ville…"
        />

        {/* Flèche */}
        <div className="flex items-center justify-center">
          <div className="w-px h-4 bg-gray-200 relative">
            <ArrowDown size={14} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 text-gray-400" />
          </div>
        </div>

        {/* Arrivée */}
        <GeoField
          label="Arrivée"
          city={to.lat ? to : null}
          onPick={pickTo}
          placeholder="Rechercher une ville…"
        />

        {/* Preview route */}
        {(from.lat && to.lat) && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition ${
            previewLoading ? 'bg-gray-50 text-gray-400' : 'bg-green-50 text-green-700'
          }`}>
            <span>{transportIcon(to.type_transport)}</span>
            {previewLoading
              ? 'Calcul en cours…'
              : (() => {
                  const isAir = to.type_transport === 'avion' || to.type_transport === 'ferry'
                  // Pour avion/ferry : afficher la durée manuelle si saisie
                  const manuMins = isAir
                    ? (parseInt(dureeManuH || 0) * 60 + parseInt(dureeManuM || 0)) || null
                    : null
                  const dur = isAir ? manuMins : preview?.duration
                  const dist = preview?.distance
                  return <>
                    {dur  && <span className="font-bold">{fmtDuration(dur)}</span>}
                    {dist && <span className="text-green-600">{dur ? '· ' : '~'}{dist} km</span>}
                    {!dur && !dist && 'Calcul impossible'}
                    <span className="text-green-500 ml-auto">
                      {isAir ? 'vol d\'oiseau' : 'route calculée'}
                    </span>
                  </>
                })()
            }
          </div>
        )}

        {/* Durée manuelle — uniquement pour avion et ferry */}
        {(to.type_transport === 'avion' || to.type_transport === 'ferry') && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Durée du trajet <span className="text-gray-300 normal-case font-normal">(modifiable)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number" min="0" max="99"
                  value={dureeManuH}
                  onChange={e => setDureeManuH(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-16 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
                />
                <span className="text-sm text-gray-500 font-medium">h</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number" min="0" max="59"
                  value={dureeManuM}
                  onChange={e => setDureeManuM(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-16 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
                />
                <span className="text-sm text-gray-500 font-medium">min</span>
              </div>
            </div>
          </div>
        )}

        {/* Transport */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Transport
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TRANSPORTS.map(t => (
              <button key={t.value} type="button"
                onClick={() => setTo(p => ({ ...p, type_transport: t.value }))}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                  to.type_transport === t.value
                    ? 'bg-navy text-white border-navy'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {transportIcon(t.value)} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Départ</label>
            <input type="date" value={to.date_debut} onChange={e => setTo(p => ({ ...p, date_debut: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Arrivée</label>
            <input type="date" value={to.date_fin} onChange={e => setTo(p => ({ ...p, date_fin: e.target.value }))} className={inp} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Description <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
          </label>
          <textarea value={to.description} onChange={e => setTo(p => ({ ...p, description: e.target.value }))}
            rows={2} placeholder="Points d'intérêt, hébergement…" className={inp + ' resize-none'} />
        </div>

        {/* Notes trajet */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Notes sur le trajet <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
          </label>
          <textarea value={to.notes_trajet} onChange={e => setTo(p => ({ ...p, notes_trajet: e.target.value }))}
            rows={2} placeholder="Conseils de route, arrêts recommandés…" className={inp + ' resize-none'} />
        </div>

        {/* Région */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Région / Groupe <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
          </label>
          <select value={to.region_id} onChange={e => setTo(p => ({ ...p, region_id: e.target.value }))} className={inp}>
            <option value="">— Aucune —</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
          <div className="flex gap-2 mt-1.5">
            <input value={newRegionName} onChange={e => setNewRegionName(e.target.value)}
              placeholder="Nouvelle région…" className={`${inp} text-xs`}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateRegion() } }} />
            <Button type="button" size="sm" variant="secondary" onClick={handleCreateRegion}>+</Button>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-1 pb-2">
          {!isNew && onDelete && (
            <Button type="button" variant="danger" size="sm"
              onClick={() => confirmDel ? onDelete(toStep?.id) : setConfirmDel(true)}
              className={confirmDel ? 'ring-2 ring-red-400' : ''}>
              {confirmDel ? 'Confirmer ?' : '✕'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" disabled={saving || !from.lat || !to.lat} className="flex-1">
            {saving ? 'Enregistrement…' : isNew ? 'Créer le trajet' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition'
