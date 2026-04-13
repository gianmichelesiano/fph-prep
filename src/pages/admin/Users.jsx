import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getUsers, setUserPremium } from '../../lib/adminApi'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPremium, setFilterPremium] = useState('')

  useEffect(() => {
    getUsers()
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleTogglePremium(userId, currentPremium) {
    const newVal = !currentPremium
    await setUserPremium(userId, newVal)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_premium: newVal } : u))
  }

  const filtered = users.filter(u => {
    if (filterPremium === 'premium' && !u.is_premium) return false
    if (filterPremium === 'free' && u.is_premium) return false
    if (search && !u.email?.toLowerCase().includes(search.toLowerCase()) && !u.full_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Utenti</h2>
            <p className="text-sm text-secondary">{users.length} utenti registrati</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Cerca email o nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1 min-w-48"
          />
          <select value={filterPremium} onChange={e => setFilterPremium(e.target.value)} className="input">
            <option value="">Tutti</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12 text-secondary">Nessun utente trovato</div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs text-outline uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Utente</th>
                  <th className="px-4 py-3 text-left">Registrato</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface">{u.full_name || '—'}</p>
                      <p className="text-xs text-outline">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.is_premium
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container-high text-outline'
                      }`}>
                        {u.is_premium ? 'Premium' : 'Free'}
                      </span>
                      {u.is_admin && (
                        <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePremium(u.id, u.is_premium)}
                        className="text-xs text-primary hover:text-primary-container font-semibold transition-colors"
                      >
                        {u.is_premium ? 'Revoca premium' : 'Imposta premium'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
