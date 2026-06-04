import { X, Calendar, Pencil } from 'lucide-react'
import { fmtDate, fmtDuration, transportIcon } from '../../lib/utils'

export default function SegmentDetail({ from, to, regions = [], isEditor, onEdit, onClose }) {
  const region = regions.find(r => r.id === to?.region_id)

  if (!to) return null

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-[22px] font-bold text-gray-900 leading-tight truncate">{to.nom}</h2>
          {region && (
            <p className="text-sm text-gray-400 mt-0.5">{region.nom}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition mt-0.5 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Corps scrollable ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Dates */}
        {(to.date_debut || to.date_fin) && (
          <div className="flex items-center gap-2.5 text-sm text-gray-700">
            <Calendar size={15} className="text-gray-400 flex-shrink-0" />
            <span>
              {fmtDate(to.date_debut)}
              {to.date_fin && to.date_fin !== to.date_debut
                ? <> → {fmtDate(to.date_fin)}</>
                : null}
            </span>
          </div>
        )}

        {/* Séparateur */}
        {(to.date_debut || to.date_fin) && <hr className="border-gray-100" />}

        {/* Trajet pour arriver ici */}
        {from && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
              Trajet pour arriver ici
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">{transportIcon(to.type_transport)}</span>
              <span className="font-semibold text-gray-800">{from.nom}</span>
              <span className="text-gray-400">→</span>
              <span className="font-semibold text-gray-800">{to.nom}</span>
            </div>
            {(from.duree_vers_suivante || from.distance_vers_suivante) && (
              <p className="text-sm text-gray-500 mt-1.5 ml-7">
                {from.duree_vers_suivante
                  ? <span className="font-medium text-gray-700">{fmtDuration(from.duree_vers_suivante)}</span>
                  : null}
                {from.duree_vers_suivante && from.distance_vers_suivante ? ' · ' : ''}
                {from.distance_vers_suivante
                  ? <span>{Math.round(from.distance_vers_suivante)} km</span>
                  : null}
              </p>
            )}
          </div>
        )}

        {/* Notes de l'agent */}
        {to.notes_trajet && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Notes de l'agent
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
              {to.notes_trajet}
            </div>
          </div>
        )}

        {/* Description */}
        {to.description && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Description
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {to.description}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!to.notes_trajet && !to.description && !from?.duree_vers_suivante && !to.date_debut && (
          <p className="text-xs text-gray-400 text-center py-6">
            Aucune information supplémentaire pour cette étape.
          </p>
        )}
      </div>

      {/* ── Bouton Modifier (mode créateur) ── */}
      {isEditor && (
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={onEdit}
            className="w-full py-2.5 rounded-xl bg-navy text-white text-sm font-semibold hover:bg-navy-600 transition flex items-center justify-center gap-2"
          >
            <Pencil size={14} />
            Modifier ce trajet
          </button>
        </div>
      )}
    </div>
  )
}
