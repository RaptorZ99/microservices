'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: number
  user: string
  item: string
  createdAt: string
}

/**
 * Dashboard utilisateur interactif :
 * - récupère les commandes
 * - permet de créer une commande
 * - permet de supprimer une commande
 */
export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Charger les commandes de l'utilisateur
  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setOrders(data)
      setLoading(false)
    } catch {
      setError('Impossible de charger les commandes')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Créer une commande
  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    setCreating(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: newItem }),
    })
    setCreating(false)

    if (res.ok) {
      setNewItem('')
      loadOrders()
    } else {
      alert('Erreur lors de la création')
    }
  }

  // Supprimer une commande
  const deleteOrder = async (id: number) => {
    if (!confirm('Supprimer cette commande ?')) return

    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    if (res.ok) loadOrders()
    else alert('Erreur de suppression')
  }

  if (loading) return <p className="p-6 text-gray-600">Chargement…</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>

  return (
    <main className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold mb-6">📦 Mes commandes</h1>

      {/* Formulaire de création */}
      <form onSubmit={createOrder} className="flex items-center gap-2 mb-8">
        <input type="text"
          placeholder="Nom du produit…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit"
          disabled={creating}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <p className="text-gray-500">Aucune commande pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}
              className="flex justify-between items-center border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-800">{o.item}</p>
                <p className="text-sm text-gray-500">
                  Commandé le {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => deleteOrder(o.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}