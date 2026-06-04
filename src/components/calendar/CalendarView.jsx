import { useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isWithinInterval,
  format, addMonths, subMonths, parseISO,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { stepStatus } from '../../lib/utils'

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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

  // For each step, determine which days it spans
  const stepsOnDay = (day) => {
    return steps.filter(s => {
      if (!s.date_debut || !s.date_fin) return false
      try {
        return isWithinInterval(day, {
          start: parseISO(s.date_debut),
          end:   parseISO(s.date_fin),
        })
      } catch { return false }
    })
  }

  const regionColor = (regionId) => {
    if (!regionId) return '#1a2744'
    const r = regions.find(r => r.id === regionId)
    return r?.couleur || '#1a2744'
  }

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
            const daySteps = stepsOnDay(day)

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
                    : inMonth
                      ? 'text-gray-700'
                      : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>

                {/* Step blocks */}
                <div className="space-y-0.5">
                  {daySteps.map(s => {
                    const status = stepStatus(s.date_debut, s.date_fin)
                    const color  = regionColor(s.region_id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelectStep?.(s)}
                        className="w-full text-left px-1.5 py-0.5 rounded text-white text-xs truncate transition hover:opacity-90"
                        style={{
                          background: status === 'passé' ? '#9ca3af' : color,
                          opacity: status === 'passé' ? 0.6 : 1,
                        }}
                      >
                        {s.nom}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
