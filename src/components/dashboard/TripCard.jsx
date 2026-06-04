import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, Trash2, Link, ExternalLink, Building2 } from 'lucide-react'
import { fmtDateShort, tripStatus } from '../../lib/utils'

const STATUS_STYLE = {
  'à venir':  'bg-blue-50 text-blue-700',
  'en cours': 'bg-green-50 text-green-700',
  'terminé':  'bg-gray-100 text-gray-500',
  'inconnu':  'bg-gray-100 text-gray-400',
}

export default function TripCard({ trip, agenceName, onDelete }) {
  const navigate = useNavigate()
  const [copied, setCopied]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const status      = tripStatus(trip.date_debut, trip.date_fin)
  const observerUrl = `${window.location.origin}/voyage/${trip.lien_uuid}`

  const copyLink = async (e) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(observerUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      onClick={() => !showConfirm && navigate(`/trip/${trip.id}`)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer group overflow-hidden"
    >
      {/* Header */}
      <div className="h-28 bg-gradient-to-br from-navy/80 to-navy relative flex items-end p-4">
        {trip.logo_url && (
          <img src={trip.logo_url} alt="" className="absolute top-3 right-3 h-7 object-contain" />
        )}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {agenceName && (
          <span className="ml-2 text-xs bg-white/20 text-white px-2 py-1 rounded-full flex items-center gap-1">
            <Building2 size={9} /> {agenceName}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate">{trip.nom}</h3>
        {trip.nom_client && <p className="text-sm text-gray-500 truncate mt-0.5">{trip.nom_client}</p>}

        <div className="mt-3 space-y-1">
          {trip.destination && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={12} /><span>{trip.destination}</span>
            </div>
          )}
          {(trip.date_debut || trip.date_fin) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={12} />
              <span>
                {fmtDateShort(trip.date_debut)}
                {trip.date_fin ? ` → ${fmtDateShort(trip.date_fin)}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 min-h-[32px]" onClick={e => e.stopPropagation()}>
          {showConfirm ? (
            /* ── Confirmation soft delete ── */
            <div className="bg-red-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-red-700 font-medium">
                Mettre en corbeille ? Le voyage sera conservé 30 jours avant suppression définitive.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onDelete(trip.id)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition"
                >
                  Oui, mettre en corbeille
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            /* ── Actions normales ── */
            <div className="flex items-center gap-2">
              <button onClick={copyLink}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition">
                <Link size={12} />{copied ? 'Copié !' : 'Lien client'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); window.open(observerUrl, '_blank') }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition">
                <ExternalLink size={12} />Aperçu
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="ml-auto text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                title="Mettre en corbeille"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
