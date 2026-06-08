import { useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isWithinInterval,
  format, addMonths, subMonths, addDays, subDays, parseISO, startOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ── Helpers ────────────────────────────────────────────────────
function regionColor(regionId, regions) {
  if (!regionId) return '#1a2744'
  return regions.find(r => r.id === regionId)?.couleur || '#1a2744'
}

/**
 * Build flat event list from sorted steps.
 *
 * Two event types per step:
 *   'travel' — journey days from date_debut (departure) to date_fin (arrival)
 *   'stay'   — days on location, from day-after-arrival to day-before-next-departure
 */
function buildEvents(sorted) {
  const events = []

  sorted.forEach((s, i) => {
    const next = sorted[i + 1]

    // ── Travel event (en route) ──────────────────────────────
    if (s.date_debut && s.date_fin) {
      try {
        const start = parseISO(s.date_debut)
        const end   = parseISO(s.date_fin)
        if (end >= start) {
          events.push({ step: s, start, end, type: 'travel' })
        }
      } catch {}
    }

    // ── Stay event (sur place) ───────────────────────────────
    // Starts the day AFTER arrival, ends the day BEFORE next departure.
    if (s.date_fin && next?.date_debut) {
      try {
        const stayStart = addDays(parseISO(s.date_fin), 1)
        const stayEnd   = subDays(parseISO(next.date_debut), 1)
        if (stayEnd >= stayStart) {
          events.push({ step: s, start: stayStart, end: stayEnd, type: 'stay' })
        }
      } catch {}
    }
  })

  return events
}

function eventStatus(start, end) {
  const today = startOfDay(new Date())
  if (end   < today) return 'passé'
  if (start > today) return 'futur'
  return 'en_cours'
}

// ── Component ──────────────────────────────────────────────────
export default function CalendarView({ steps = [], regions = [], onSelectStep }) {
  const [current, setCurrent] = useState(() => {
    const first = steps.find(s => s.date_debut)
    return first ? startOfMonth(parseISO(first.date_debut)) : startOfMonth(new Date())
  })

  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const sorted    = [...steps].sort((a, b) => a.ordre - b.ordre)
  const allEvents = buildEvents(sorted)

  const eventsOnDay = (day) =>
    allEvents.filter(ev => {
      try { return isWithinInterval(day, { start: ev.start, end: ev.end }) }
      catch { return false }
    })

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => setCurrent(d => subMonths(d, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-base font-semibold text-gray-900 capitalize">
            {format(current, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            onClick={() => setCurrent(d => addMonths(d, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEK_DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const inMonth  = isSameMonth(day, current)
            const today    = isToday(day)
            const dayEvs   = eventsOnDay(day)

            return (
              <div
                key={idx}
                className={`min-h-20 p-1 border-b border-r border-gray-50 ${
                  !inMonth ? 'bg-gray-50/50' : ''
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {/* Date number */}
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  today
                    ? 'bg-navy text-white'
                    : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>

                {/* Event blocks */}
                <div className="space-y-0.5">
                  {dayEvs.map(ev => {
                    const color  = regionColor(ev.step.region_id, regions)
                    const status = eventStatus(ev.start, ev.end)
                    const past   = status === 'passé'

                    if (ev.type === 'travel') {
                      // En route — solid block
                      return (
                        <button
                          key={`${ev.step.id}-travel`}
                          onClick={() => onSelectStep?.(ev.step)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-white text-xs truncate transition hover:opacity-90"
                          style={{
                            background: past ? '#9ca3af' : color,
                            opacity:    past ? 0.6 : 1,
                          }}
                          title={`✈ ${ev.step.nom}`}
                        >
                          {ev.step.nom}
                        </button>
                      )
                    }

                    // Sur place — light tinted background + dashed border
                    return (
                      <button
                        key={`${ev.step.id}-stay`}
                        onClick={() => onSelectStep?.(ev.step)}
                        className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition hover:opacity-80"
                        style={{
                          background:  past ? '#f3f4f6'         : color + '18',
                          border:      past ? '1px dashed #d1d5db' : `1px dashed ${color}`,
                          color:       past ? '#9ca3af'         : color,
                        }}
                        title={`⌂ ${ev.step.nom}`}
                      >
                        {ev.step.nom}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-8 h-3 rounded" style={{ background: '#6B8CAE' }} />
            En route
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-8 h-3 rounded" style={{
              background: '#6B8CAE18',
              border: '1px dashed #6B8CAE',
            }} />
            Sur place
          </div>
        </div>
      </div>
    </div>
  )
}
