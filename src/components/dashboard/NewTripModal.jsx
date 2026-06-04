import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function NewTripModal({ open, onClose, onSave, agences = [], isAdmin = false, defaultAgenceId = null }) {
  const [form, setForm] = useState({
    nom: '', nom_client: '', destination: '',
    date_debut: '', date_fin: '',
    agence_id: defaultAgenceId || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nom.trim()) { setErr('Le nom du voyage est requis'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ ...form, agence_id: form.agence_id || null })
      setForm({ nom: '', nom_client: '', destination: '', date_debut: '', date_fin: '', agence_id: defaultAgenceId || '' })
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau voyage">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <Field label="Nom du voyage *">
          <input value={form.nom} onChange={e => set('nom', e.target.value)}
            placeholder="Ex: Côte Est Australie" className={inp} autoFocus />
        </Field>
        <Field label="Nom du client">
          <input value={form.nom_client} onChange={e => set('nom_client', e.target.value)}
            placeholder="Ex: Famille Martin" className={inp} />
        </Field>
        <Field label="Destination principale">
          <input value={form.destination} onChange={e => set('destination', e.target.value)}
            placeholder="Ex: Australie" className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début">
            <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className={inp} />
          </Field>
          <Field label="Date de fin">
            <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className={inp} />
          </Field>
        </div>

        {/* Sélecteur d'agence — admin uniquement */}
        {isAdmin && agences.length > 0 && (
          <Field label="Agence propriétaire">
            <select value={form.agence_id} onChange={e => set('agence_id', e.target.value)} className={inp}>
              <option value="">— Admin (sans agence) —</option>
              {agences.filter(a => a.actif).map(a => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </Field>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Création…' : 'Créer le voyage'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition'
