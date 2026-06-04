import { useState } from 'react'
import { fmtDateShort, fmtDuration, transportIcon } from '../../lib/utils'
import { Pencil, Trash2 } from 'lucide-react'

export default function SegmentItem({ from, to, index, isSelected, onClick, isEditor, onEdit, onDelete, regionColor, regionBg }) {
  const [hovered, setHovered] = useState(false)
  const transport = to?.type_transport || 'voiture'

  const bg = isSelected
    ? (regionBg || 'rgba(26,39,68,0.04)')
    : hovered && regionBg
    ? regionBg
    : '#ffffff'

  const borderLeft = isSelected
    ? `3px solid ${regionColor || '#1a2744'}`
    : regionColor
    ? `2px solid ${regionColor}44`
    : '2px solid transparent'

  const cityColor = regionColor || '#374151'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: bg, borderLeft }}
      className={`px-3 py-2.5 cursor-pointer transition-all duration-150 group border-b border-gray-100 last:border-b-0 ${
        isSelected ? 'shadow-sm' : ''
      }`}
    >
      {/* Segment number */}
      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">
        Trajet {index + 1}
      </p>

      <div className="flex items-start justify-between gap-1">
        {/* Cities + meta */}
        <div className="flex-1 min-w-0">
          {/* City names in region color */}
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: cityColor }}>
            {from.nom}
            {to && (
              <>
                <span className="opacity-40 font-normal mx-1">→</span>
                {to.nom}
              </>
            )}
          </p>

          {/* Duration + distance */}
          {to && (from.duree_vers_suivante || from.distance_vers_suivante) && (
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="mr-1">{transportIcon(transport)}</span>
              {from.duree_vers_suivante ? fmtDuration(from.duree_vers_suivante) : ''}
              {from.distance_vers_suivante
                ? `${from.duree_vers_suivante ? ' · ' : ''}${Math.round(from.distance_vers_suivante)} km`
                : ''}
            </p>
          )}

          {/* Dates */}
          {(from.date_debut || from.date_fin) && (
            <p className="text-xs text-gray-400">
              {fmtDateShort(from.date_debut)}
              {to?.date_debut && to.date_debut !== from.date_debut
                ? ` → ${fmtDateShort(to.date_debut)}`
                : from.date_fin
                  ? ` → ${fmtDateShort(from.date_fin)}`
                  : ''}
            </p>
          )}
        </div>

        {/* Editor actions — visible on hover */}
        {isEditor && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(from, to) }}
              className="text-gray-300 hover:text-navy p-0.5 rounded transition"
              title="Modifier"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.() }}
              className="text-gray-300 hover:text-red-400 p-0.5 rounded transition"
              title="Supprimer"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
