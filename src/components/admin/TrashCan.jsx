import { useState } from 'react'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'

const DAYS_RETENTION = 30

export default function TrashCan({ trashedTrips = [], agences = [], onRefresh }) {
  const [confirmId, setConfirmId] = useState(null)
  const [loading, setLoading]     = useState(false)

  const agenceName = (agenceId) =>
    agences.find(a => a.id === agenceId)?.nom || 'Admin'

  const daysLeft = (deletedAt) => {
    if (!deletedAt) return DAYS_RETENTION
    const elapsed = differenceInDays(new Date(), parseISO(deletedAt))
    return Math.max(0, DAYS_RETENTION - elapsed)
  }

  const restore = async (tripId) => {
    setLoading(true)
    await supabase.from('voyages')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', tripId)
    setLoading(false)
    onRefresh()
  }

  const deletePermanently = async (tripId) => {
    setLoading(true)
    await supabase.from('voyages').delete().eq('id', tripId)
    setLoading(false)
    setConfirmId(null)
    onRefresh()
  }

  // Nettoie les voyages expirés (> 30 jours) — exécuté côté client en complément de pg_cron
  const cleanExpired = async () => {
    const expired = trashedTrips.filter(t => daysLeft(t.deleted_at) === 0)
    for (const t of expired) {
      await supabase.from('voyages').delete().eq('id', t.id)
    }
    if (expired.length) onRefresh()
  }

  // Lance le nettoyage à chaque affichage de la corbeille
  useState(() => { cleanExpired() }, [])

  if (trashedTrips.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Trash2 size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">La corbeille est vide</p>
        <p className="text-xs mt-1">Les voyages supprimés apparaissent ici pendant {DAYS_RETENTION} jours.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Les voyages sont supprimés définitivement après {DAYS_RETENTION} jours.
      </p>

      {trashedTrips.map(trip => {
        const remaining = daysLeft(trip.deleted_at)
        const isExpiring = remaining <= 5
        const isConfirming = confirmId === trip.id

        return (
          <div key={trip.id}
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
            {/* Icône état */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isExpiring ? 'bg-red-50' : 'bg-gray-100'
            }`}>
              {isExpiring
                ? <AlertTriangle size={16} className="text-red-500" />
                : <Trash2 size={16} className="text-gray-400" />
              }
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{trip.nom}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-500">
                  {agenceName(trip.agence_id)}
                </span>
                <span className="text-xs text-gray-400">
                  Supprimé {trip.deleted_at
                    ? formatDistanceToNow(parseISO(trip.deleted_at), { addSuffix: true, locale: fr })
                    : ''}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isExpiring
                    ? 'bg-red-50 text-red-600'
                    : 'bg-orange-50 text-orange-600'
                }`}>
                  {remaining}j restant{remaining > 1 ? 's' : ''}
                </span>
              </div>
              {trip.deleted_by && (
                <p className="text-xs text-gray-400 mt-0.5">par {trip.deleted_by}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isConfirming ? (
                <>
                  <span className="text-xs text-red-500 font-medium">Définitif ?</span>
                  <Button size="sm" variant="danger" disabled={loading}
                    onClick={() => deletePermanently(trip.id)}>
                    Oui
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => setConfirmId(null)}>
                    Non
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => restore(trip.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Restaurer
                  </button>
                  <button
                    onClick={() => setConfirmId(trip.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
                  >
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
