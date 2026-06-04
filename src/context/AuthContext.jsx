/**
 * AuthContext — source de vérité unique pour l'authentification.
 *
 * MIGRATION FUTURE → Supabase Auth :
 *   Remplacer ce contexte par un contexte basé sur supabase.auth.
 *   Points de migration marqués // [MIGRATION].
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// [MIGRATION] Remplacer cette clé par supabase.auth.session()
const SESSION_KEY = 'travelmap_session_v2'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // session = null | { type:'admin', id } | { type:'agency', id, nom, logo_url }
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── Restore session ──────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setSession(JSON.parse(raw))
    } catch {
      localStorage.removeItem(SESSION_KEY)
    }
    setLoading(false)
  }, [])

  // ── Helpers ──────────────────────────────────────────────
  const persist = (sess) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess))
    setSession(sess)
  }

  // ── Premier lancement : existe-t-il un compte admin ? ────
  const adminExists = useCallback(async () => {
    const { data } = await supabase.from('compte_agent').select('id').limit(1)
    return (data?.length ?? 0) > 0
  }, [])

  // ── Création du compte admin (première fois) ─────────────
  const createAdmin = useCallback(async (pin) => {
    setError(null)
    try {
      const pin_hash = await bcrypt.hash(pin, 10)
      const { data, error: err } = await supabase
        .from('compte_agent').insert({ pin_hash }).select().single()
      if (err) throw err
      persist({ type: 'admin', id: data.id, logo_url: data.logo_url })
      return true
    } catch (e) { setError(e.message); return false }
  }, [])

  // ── Login — détecte automatiquement admin ou agence ──────
  // [MIGRATION] Remplacer par supabase.auth.signInWithPassword()
  const login = useCallback(async (pin) => {
    setError(null)
    try {
      // 1. Essai admin
      const { data: admin } = await supabase
        .from('compte_agent').select('*').limit(1).single()
      if (admin && await bcrypt.compare(pin, admin.pin_hash)) {
        persist({ type: 'admin', id: admin.id, logo_url: admin.logo_url })
        return true
      }

      // 2. Essai agences actives
      const { data: agences } = await supabase
        .from('agences').select('*').eq('actif', true)
      for (const ag of (agences || [])) {
        if (await bcrypt.compare(pin, ag.pin_hash)) {
          persist({ type: 'agency', id: ag.id, nom: ag.nom, logo_url: ag.logo_url })
          return true
        }
      }

      throw new Error('PIN incorrect — vérifiez votre code.')
    } catch (e) { setError(e.message); return false }
  }, [])

  // ── Logout ───────────────────────────────────────────────
  // [MIGRATION] Ajouter supabase.auth.signOut()
  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.clear()
    setSession(null)
    setError(null)
  }, [])

  const updateSession = useCallback((updates) => {
    setSession(prev => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isAdmin  = session?.type === 'admin'
  const isAgency = session?.type === 'agency'

  return (
    <AuthContext.Provider value={{
      session, loading, error,
      isAdmin, isAgency,
      adminExists, createAdmin,
      login, logout,
      updateSession,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
