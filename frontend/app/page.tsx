'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [loading, setL] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setL(true)
    setErr('')

    // Appel à l’API Gateway (sera implémenté dans une étape ultérieure)
    const res = await fetch('/api/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    setL(false)
    if (res.ok) {
      window.location.href = '/dashboard'
    } else {
      const j = await res.json().catch(() => ({ detail: 'Erreur' }))
      setErr(j.detail || 'Échec de connexion')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800">
          Connexion
        </h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom d’utilisateur
            </label>
            <input type="text"
              value={username}
              onChange={(e) => setU(e.target.value)}
              placeholder="john.doe"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input type="password"
              value={password}
              onChange={(e) => setP(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg
            font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}