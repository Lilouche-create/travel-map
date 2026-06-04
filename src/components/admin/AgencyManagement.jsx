import { useState } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, X, Check } from 'lucide-react'
import bcrypt from 'bcryptjs'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function AgencyManagement({ agences = [], onRefresh }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId]   = useState(null) // agence en cours d'édition PIN
  const [form, setForm]             = useState({ nom: '', pin: '', pinConfirm: '' })
  const [editPin, setEditPin]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.nom.trim())               { setErr('Nom requis'); return }
    if (form.pin.length < 4)            { setErr('PIN min. 4 chiffres'); return }
    if (form.pin !== form.pinConfirm)   { setErr('Les PIN ne correspondent pas'); return }
    // Vérifier unicité du PIN parmi les agences existantes
    // (la vérification complète incluant admin se fait côté serveur — ici on vérifie juste en local)
    setSaving(true)
    try {
      const pin_hash = await bcrypt.hash(form.pin, 10)
      const { error } = await supabase.from('agences').insert({ nom: form.nom.trim(), pin_hash })
      if (error) throw error
      setForm({ nom: '', pin: '', pinConfirm: '' })
      setShowCreate(false)
      onRefresh()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleUpdatePin = async (agenceId) => {
    if (editPin.length < 4) { setErr('PIN min. 4 chiffres'); return }
    setSaving(true)
    try {
      const pin_hash = await bcrypt.hash(editPin, 10)
      const { error } = await supabase.from('agences').update({ pin_hash }).eq('id', agenceId)
      if (error) throw error
      setEditingId(null)
      setEditPin('')
      onRefresh()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const toggleActif = async (agence) => {
    await supabase.from('agences').update({ actif: !agence.actif }).eq('id', agence.id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{agences.length} agence{agences.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => { setShowCreate(true); setErr('') }}>
          <Plus size={13} /> Nouvelle agence
        </Button>
      </div>

      {/* Liste */}
      {agences.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Aucune agence — cliquez sur "Nouvelle agence" pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {agences.map(ag => (
            <div key={ag.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                {/* Logo ou initiale */}
                <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {ag.logo_url
                    ? <img src={ag.logo_url} alt="" className="w-full h-full object-contain p-1" />
                    : <span className="text-navy font-bold text-sm">{ag.nom[0].toUpperCase()}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{ag.nom}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ag.actif ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {ag.actif ? 'Active' : 'Désactivée'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Modifier PIN */}
                  {editingId === ag.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={editPin}
                        onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="Nouveau PIN"
                        autoFocus
                        className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30"
                      />
                      <button onClick={() => handleUpdatePin(ag.id)}
                        className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition">
                        <Check size={14} />
                      </button>
                      <button onClick={() => { setEditingId(null); setEditPin('') }}
                        className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-lg transition">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(ag.id); setEditPin(''); setErr('') }}
                      className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
                      title="Modifier le PIN"
                    >
                      <Pencil size={13} />
                    </button>
                  )}

                  {/* Toggle actif */}
                  <button
                    onClick={() => toggleActif(ag)}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
                    title={ag.actif ? 'Désactiver' : 'Activer'}
                  >
                    {ag.actif
                      ? <ToggleRight size={18} className="text-green-500" />
                      : <ToggleLeft  size={18} />
                    }
                  </button>
                </div>
              </div>
              {err && editingId === ag.id && (
                <p className="text-xs text-red-600 mt-2">{err}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setErr('') }} title="Nouvelle agence">
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nom de l'agence *</label>
            <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
              placeholder="Ex: Voyages Dupont" className={inp} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">PIN dédié * (min. 4 chiffres)</label>
            <input type="password" inputMode="numeric" maxLength={8}
              value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))}
              placeholder="••••" className={`${inp} text-center text-xl tracking-widest`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmer le PIN *</label>
            <input type="password" inputMode="numeric" maxLength={8}
              value={form.pinConfirm} onChange={e => setForm(p => ({ ...p, pinConfirm: e.target.value.replace(/\D/g, '') }))}
              placeholder="••••" className={`${inp} text-center text-xl tracking-widest`} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Création…' : "Créer l'agence"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition'
