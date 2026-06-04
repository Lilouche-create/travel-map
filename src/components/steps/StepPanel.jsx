import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Search, MapPin } from 'lucide-react'
import Button from '../ui/Button'
import { geocodePlace } from '../../lib/maptiler'
import { fmtDate, transportIcon, nextRegionColor } from '../../lib/utils'

const TRANSPORTS = [
  { value: 'voiture', label: 'Voiture' },
  { value: 'avion',   label: 'Avion'   },
  { value: 'ferry',   label: 'Ferry'   },
  { value: 'autre',   label: 'Autre'   },
]

const empty = {
  nom: '', lieu_label: '', lat: '', lng: '',
  date_debut: '', date_fin: '',
  type_transport: 'voiture',
  description: '', notes_trajet: '',
  region_id: '',
}

export default function StepPanel({
  step,
  regions = [],
  onSave,
  onDelete,
  onClose,
  onCreateRegion,
  readOnly = false,
}) {
  const [form, setForm]             = useState(empty)
  const [geoQuery, setGeoQuery]     = useState('')
  const [geoResults, setGeoResults] = useState([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const geoTimer = useRef(null)

  useEffect(() => {
    if (step) {
      setForm({
        id:             step.id,
        nom:            step.nom            || '',
        lieu_label:     step.lieu_label     || '',
        lat:            step.lat            || '',
        lng:            step.lng            || '',
        date_debut:     step.date_debut     || '',
        date_fin:       step.date_fin       || '',
        type_transport: step.type_transport || 'voiture',
        description:    step.description   || '',
        notes_trajet:   step.notes_trajet  || '',
        region_id:      step.region_id     || '',
      })
    } else {
      setForm(empty)
    }
    setGeoResults([])
    setGeoQuery('')
    setConfirmDel(false)
  }, [step?.id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Géocodage avec debounce
  useEffect(() => {
    if (!geoQuery.trim() || geoQuery.length < 2) { setGeoResults([]); return }
    clearTimeout(geoTimer.current)
    geoTimer.current = setTimeout(async () => {
      setGeoLoading(true)
      const results = await geocodePlace(geoQuery)
      setGeoResults(results)
      setGeoLoading(false)
    }, 300)
    return () => clearTimeout(geoTimer.current)
  }, [geoQuery])

  const pickGeo = async (feature) => {
    const [lng, lat] = feature.geometry.coordinates
    const label = feature.place_name || feature.properties?.name || ''

    // Auto-détection de la région depuis le contexte MapTiler
    let autoRegionName = null
    const ctx = feature.context || []
    const regionCtx = ctx.find(c =>
      c.id?.startsWith('region') ||
      c.id?.startsWith('state')  ||
      c.id?.startsWith('province')
    )
    if (regionCtx?.text) autoRegionName = regionCtx.text

    let matchedRegionId = ''
    if (autoRegionName) {
      const existing = regions.find(r => r.nom.toLowerCase() === autoRegionName.toLowerCase())
      if (existing) {
        matchedRegionId = existing.id
      } else {
        const created = await onCreateRegion?.({ nom: autoRegionName, couleur: nextRegionColor(regions) })
        if (created) matchedRegionId = created.id
      }
    }

    setForm(p => ({
      ...p,
      lieu_label: label,
      nom:        p.nom || feature.text || label.split(',')[0],
      lat:        parseFloat(lat.toFixed(6)),
      lng:        parseFloat(lng.toFixed(6)),
      region_id:  matchedRegionId || p.region_id,
    }))

    setGeoQuery('')
    setGeoResults([])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        lat:       parseFloat(form.lat) || null,
        lng:       parseFloat(form.lng) || null,
        region_id: form.region_id || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await onDelete(form.id)
  }

  const handleCreateRegion = async () => {
    if (!newRegionName.trim()) return
    const color = nextRegionColor(regions)
    const r = await onCreateRegion({ nom: newRegionName.trim(), couleur: color })
    if (r) { set('region_id', r.id); setNewRegionName('') }
  }

  if (readOnly && !step) return null

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          {readOnly ? (step?.nom || 'Étape') : (step ? "Modifier l'étape" : 'Nouvelle étape')}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {readOnly ? (
          <ReadOnlyStep step={step} />
        ) : (
          <form onSubmit={handleSave} className="p-4 space-y-4">

            {/* Géocodage */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Rechercher un lieu</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={geoQuery}
                  onChange={e => setGeoQuery(e.target.value)}
                  placeholder="Ville, lieu…"
                  className={`${inp} pl-8`}
                />
                {geoLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</span>
                )}
              </div>
              {geoResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {geoResults.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickGeo(f)}
                      className="flex items-start gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition"
                    >
                      <MapPin size={12} className="mt-0.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 line-clamp-2">{f.place_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nom */}
            <Field label="Nom affiché *">
              <input
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                placeholder="Ex: Blue Mountains"
                className={inp}
              />
            </Field>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Arrivée">
                <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className={inp} />
              </Field>
              <Field label="Départ">
                <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className={inp} />
              </Field>
            </div>

            {/* Transport */}
            <Field label="Transport pour arriver ici">
              <div className="grid grid-cols-2 gap-2">
                {TRANSPORTS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('type_transport', t.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                      form.type_transport === t.value
                        ? 'bg-navy text-white border-navy'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {transportIcon(t.value)} {t.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                placeholder="Points d'intérêt, hébergement…"
                className={inp + ' resize-none'}
              />
            </Field>

            {/* Notes trajet */}
            <Field label="Notes sur le trajet">
              <textarea
                value={form.notes_trajet}
                onChange={e => set('notes_trajet', e.target.value)}
                rows={2}
                placeholder="Conseils de route, arrêts…"
                className={inp + ' resize-none'}
              />
            </Field>

            {/* Région */}
            <Field label="Région / Groupe">
              <select value={form.region_id} onChange={e => set('region_id', e.target.value)} className={inp}>
                <option value="">— Aucune —</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-1.5">
                <input
                  value={newRegionName}
                  onChange={e => setNewRegionName(e.target.value)}
                  placeholder="Nouvelle région…"
                  className={`${inp} text-xs`}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateRegion() } }}
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleCreateRegion}>+</Button>
              </div>
            </Field>

            {/* Coordonnées */}
            {(form.lat || form.lng) && (
              <p className="text-xs text-gray-400">
                {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {step && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  className={confirmDel ? 'ring-2 ring-red-400' : ''}
                >
                  <Trash2 size={13} />
                  {confirmDel ? 'Confirmer ?' : ''}
                </Button>
              )}
              <Button type="submit" disabled={saving || !form.nom.trim()} className="flex-1">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ReadOnlyStep({ step }) {
  if (!step) return null
  return (
    <div className="p-4 space-y-4">
      {step.description && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{step.description}</p>
        </div>
      )}
      {step.notes_trajet && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Notes trajet</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{step.notes_trajet}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition'
