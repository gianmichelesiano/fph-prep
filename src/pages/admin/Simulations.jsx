import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllSimulations, deleteSimulation } from '../../lib/adminApi'
import { AREAS } from '../../data/areas'

export default function AdminSimulations() {
  const navigate = useNavigate()
  const [simulations, setSimulations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllSimulations()
      .then(data => { setSimulations(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa simulazione?')) return
    await deleteSimulation(id)
    setSimulations(prev => prev.filter(s => s.id !== id))
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Simulazioni</h2>
            <p className="text-sm text-secondary">{simulations.length} simulazioni</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/admin/simulations/new')}>
            + Nuova simulazione
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card animate-pulse h-16 bg-surface-container-high" />
            ))}
          </div>
        ) : simulations.length === 0 ? (
          <div className="card text-center py-12 text-outline">Nessuna simulazione</div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs text-secondary uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Titolo</th>
                  <th className="px-4 py-3 text-left">Area</th>
                  <th className="px-4 py-3 text-left">Domande</th>
                  <th className="px-4 py-3 text-left">Timer</th>
                  <th className="px-4 py-3 text-left">Accesso</th>
                  <th className="px-4 py-3 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {simulations
                  .sort((a, b) => (a.area || 0) - (b.area || 0))
                  .map(sim => (
                    <tr
                      key={sim.id}
                      className="hover:bg-surface-container-low cursor-pointer"
                      onClick={() => navigate(`/admin/simulations/${sim.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-on-surface">{sim.title}</p>
                        {sim.lang && <p className="text-xs text-outline">{sim.lang}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AREAS[sim.area]?.color || 'bg-surface-container-high text-on-surface-variant'}`}>
                          R{sim.area}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{sim.question_count ?? '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{sim.timer ? `${sim.timer} min` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sim.is_free ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                          {sim.is_free ? 'Gratis' : 'Premium'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => handleDelete(sim.id, e)}
                          className="text-error hover:text-error/80 text-xs"
                        >
                          Elimina
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
