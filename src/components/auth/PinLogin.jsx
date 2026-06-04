import { useState } from 'react'
import { MapPin } from 'lucide-react'
import Button from '../ui/Button'

export default function PinLogin({ onLogin, onCreate, isFirstTime, error }) {
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localErr, setLocalErr]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalErr('')
    if (isFirstTime) {
      if (pin.length < 4)    { setLocalErr('Le PIN doit avoir au moins 4 chiffres'); return }
      if (pin !== confirm)   { setLocalErr('Les PIN ne correspondent pas'); return }
      setSubmitting(true)
      await onCreate(pin)
      setSubmitting(false)
    } else {
      if (!pin) return
      setSubmitting(true)
      await onLogin(pin)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center mb-4 shadow-lg">
            <MapPin className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Map</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isFirstTime ? 'Configuration initiale' : 'Espace sécurisé'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {isFirstTime ? (
            <div className="mb-6 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              Première connexion — créez le PIN administrateur.
            </div>
          ) : (
            <p className="text-xs text-gray-500 mb-5 text-center">
              Saisissez votre PIN admin ou agence. L'accès est détecté automatiquement.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isFirstTime ? 'Créer le PIN admin' : 'Code PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
              />
            </div>

            {isFirstTime && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmer le PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition"
                />
              </div>
            )}

            {(error || localErr) && (
              <p className="text-sm text-red-600 text-center">{localErr || error}</p>
            )}

            <Button type="submit" disabled={submitting || !pin} className="w-full py-3">
              {submitting
                ? 'Vérification…'
                : isFirstTime ? 'Créer le compte admin' : 'Connexion'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
