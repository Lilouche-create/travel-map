import { useState, useEffect, useCallback } from 'react'
import { MapPin, LogOut, Plus, Search, Building2, Trash2, ShieldCheck } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import TripCard from '../components/dashboard/TripCard'
import NewTripModal from '../components/dashboard/NewTripModal'
import AgencyManagement from '../components/admin/AgencyManagement'
import TrashCan from '../components/admin/TrashCan'
import Button from '../components/ui/Button'
import { tripStatus } from '../lib/utils'

const FILTER_OPTS = ['tous', 'à venir', 'en cours', 'terminé']
const TABS_ADMIN  = ['voyages', 'agences', 'corbeille']

export default function Dashboard() {
  const { session, isAdmin, isAgency, logout } = useAuth()

  const [tab, setTab]               = useState('voyages')
  const [trips, setTrips]           = useState([])
  const [agences, setAgences]       = useState([])
  const [trashedTrips, setTrashedTrips] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showNew, setShowNew]       = useState(false)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('tous')
  const [viewAgenceId, setViewAgenceId] = useState(null) // vue "comme une agence" en mode admin

  // ── Chargement des données ───────────────────────────────
  const loadTrips = useCallback(async () => {
    if (!session) return
    let query = supabase.from('voyages').select('*').is('deleted_at', null)

    if (isAgency) {
      query = query.eq('agence_id', session.id)
    } else if (isAdmin && viewAgenceId) {
      query = query.eq('agence_id', viewAgenceId)
    }
    // admin sans filtre → tous les voyages

    const { data } = await query.order('date_debut', { ascending: true })
    setTrips(data || [])
  }, [session, isAdmin, isAgency, viewAgenceId])

  const loadAgences = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase.from('agences').select('*').order('nom')
    setAgences(data || [])
  }, [isAdmin])

  const loadTrashed = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase
      .from('voyages').select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setTrashedTrips(data || [])
  }, [isAdmin])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadTrips(), loadAgences(), loadTrashed()])
    setLoading(false)
  }, [loadTrips, loadAgences, loadTrashed])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Création d'un voyage ─────────────────────────────────
  const handleCreate = async (form) => {
    const agenceId = isAgency ? session.id : (form.agence_id || null)
    const { data, error } = await supabase.from('voyages').insert({
      ...form,
      agence_id:       agenceId,
      compte_agent_id: isAdmin ? session.id : null,
      lien_uuid:       uuidv4(),
    }).select().single()
    if (error) throw error
    setTrips(prev => [data, ...prev])
    window.location.href = `/trip/${data.id}`
  }

  // ── Soft delete d'un voyage ──────────────────────────────
  const handleDelete = async (tripId) => {
    const deletedBy = isAdmin ? 'Admin' : (session.nom || 'Agence')
    await supabase.from('voyages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', tripId)
    setTrips(prev => prev.filter(t => t.id !== tripId))
    loadTrashed()
  }

  // ── Filtrage côté client ─────────────────────────────────
  const agenceMap = Object.fromEntries(agences.map(a => [a.id, a.nom]))

  const filtered = trips.filter(t => {
    const q       = search.toLowerCase()
    const match   = !q || t.nom?.toLowerCase().includes(q) || t.destination?.toLowerCase().includes(q)
    const status  = tripStatus(t.date_debut, t.date_fin)
    const statOk  = filter === 'tous' || status === filter
    return match && statOk
  })

  const trashCount = trashedTrips.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center">
          <MapPin size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900 leading-tight">Travel Map</h1>
          {isAdmin && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <ShieldCheck size={10} className="text-navy" /> Administrateur
            </p>
          )}
          {isAgency && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Building2 size={10} /> {session.nom}
            </p>
          )}
        </div>

        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} /> Nouveau voyage
        </Button>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
          title="Se déconnecter"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Tabs admin ── */}
        {isAdmin && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 mb-6 w-fit">
            {TABS_ADMIN.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium capitalize transition ${
                  tab === t ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'agences'  && <Building2 size={13} />}
                {t === 'corbeille' && <Trash2 size={13} />}
                {t === 'voyages'  && <MapPin size={13} />}
                {t}
                {t === 'corbeille' && trashCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {trashCount > 9 ? '9+' : trashCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab Agences ── */}
        {tab === 'agences' && isAdmin && (
          <AgencyManagement agences={agences} onRefresh={loadAgences} />
        )}

        {/* ── Tab Corbeille ── */}
        {tab === 'corbeille' && isAdmin && (
          <TrashCan trashedTrips={trashedTrips} agences={agences} onRefresh={loadAll} />
        )}

        {/* ── Tab Voyages ── */}
        {tab === 'voyages' && (
          <>
            {/* Vue comme une agence (admin) */}
            {isAdmin && agences.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-gray-500">Vue :</span>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setViewAgenceId(null)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      !viewAgenceId ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tous
                  </button>
                  {agences.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setViewAgenceId(viewAgenceId === a.id ? null : a.id)}
                      className={`text-xs px-3 py-1 rounded-full border transition ${
                        viewAgenceId === a.id
                          ? 'bg-navy text-white border-navy'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {a.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA création */}
            <button
              onClick={() => setShowNew(true)}
              className="w-full bg-navy hover:bg-navy-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-medium transition mb-6"
            >
              <Plus size={18} /> Créer un nouveau voyage
            </button>

            {/* Recherche + filtres */}
            {trips.length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un voyage…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
                  />
                </div>
                <div className="flex gap-1">
                  {FILTER_OPTS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                        filter === f ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grille des voyages */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(trip => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    agenceName={isAdmin ? agenceMap[trip.agence_id] : null}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-16">
                <MapPin size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">Aucun voyage — créez-en un !</p>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-12">
                Aucun résultat pour "{search}"
              </p>
            )}
          </>
        )}
      </main>

      <NewTripModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSave={handleCreate}
        agences={agences}
        isAdmin={isAdmin}
        defaultAgenceId={isAgency ? session.id : viewAgenceId}
      />
    </div>
  )
}
