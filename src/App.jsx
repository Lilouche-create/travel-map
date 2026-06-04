import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import PinLogin from './components/auth/PinLogin'
import Dashboard from './pages/Dashboard'
import TripEditor from './pages/TripEditor'
import ObserverView from './pages/ObserverView'

function ProtectedRoute({ children }) {
  const { session, loading, error, adminExists, login, createAdmin } = useAuth()
  const [isFirstTime, setIsFirstTime] = useState(null)

  useEffect(() => {
    if (!session && !loading) {
      adminExists().then(exists => setIsFirstTime(!exists))
    }
  }, [session, loading, adminExists])

  if (loading || (!session && isFirstTime === null)) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  if (!session) {
    return (
      <PinLogin
        isFirstTime={isFirstTime}
        onLogin={login}
        onCreate={createAdmin}
        error={error}
      />
    )
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider englobe tout — état auth partagé entre tous les composants */}
      <AuthProvider>
        <Routes>
          {/* Lien observateur — public, sans PIN */}
          <Route path="/voyage/:uuid" element={<ObserverView />} />

          {/* Routes protégées */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/trip/:tripId" element={<ProtectedRoute><TripEditor /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
