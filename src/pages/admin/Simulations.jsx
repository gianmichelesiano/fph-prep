import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllSimulations, deleteSimulation } from '../../lib/adminApi'

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
    if (!confirm('Eliminare questa simulazione? Tutte le sessioni collegate verranno eliminate.')) return
    await deleteSimulation(id)
    setSimulations(prev => prev.filter(s => s.id !== id))
  }

  const exam = simulations.filter(s => s.type === 'exam')
  const custom = simulations.filter(s => s.type === 'custom')

  function totalQuestions(sim) {
    const cfg = sim.area_config || {}
    return Object.values(cfg).reduce((sum, n) => sum + Number(n), 0)
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Simulazioni</h2>
            <p className="text-sm text-secondary">{simulations.length} template totali</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => navigate('/admin/simulations/new?type=exam')}
            >
              + Esame
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => navigate('/admin/simulations/new?type=custom')}
            >
              + Custom
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse h-14 bg-surface-container-high" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <Section
              title="Simulazioni d'Esame"
              subtitle="Schema fisso — 100 domande, 210 min"
              badge="exam"
              items={exam}
              totalQuestions={totalQuestions}
              onRowClick={id => navigate(`/admin/simulations/${id}`)}
              onDelete={handleDelete}
            />
            <Section
              title="Simulazioni Custom"
              subtitle="Struttura libera — area e tempo configurabili"
              badge="custom"
              items={custom}
              totalQuestions={totalQuestions}
              onRowClick={id => navigate(`/admin/simulations/${id}`)}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Section({ title, subtitle, badge, items, totalQuestions, onRowClick, onDelete }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-headline font-semibold text-lg text-on-surface">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge === 'exam' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
          {items.length}
        </span>
        <p className="text-xs text-outline">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-outline py-4 px-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
          Nessun template
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-outline uppercase border-b border-outline-variant/20">
              <tr>
                <th className="text-left px-4 py-3">Titolo</th>
                <th className="text-left px-4 py-3 w-24">Domande</th>
                <th className="text-left px-4 py-3 w-24">Timer</th>
                <th className="text-left px-4 py-3 w-24">Sessioni</th>
                <th className="text-left px-4 py-3 w-20">Accesso</th>
                <th className="text-left px-4 py-3 w-20">Stato</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {items.map(sim => (
                <tr
                  key={sim.id}
                  className="hover:bg-surface-container cursor-pointer transition-colors"
                  onClick={() => onRowClick(sim.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-on-surface">{sim.title}</p>
                    <p className="text-xs text-outline">{sim.lang}</p>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{totalQuestions(sim)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{sim.timer ? `${sim.timer} min` : '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{sim.sessionCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sim.is_free ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                      {sim.is_free ? 'Gratis' : 'Premium'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      sim.status === 'active' ? 'bg-secondary-container text-on-secondary-container' :
                      sim.status === 'draft' ? 'bg-tertiary-fixed/50 text-on-tertiary-fixed' :
                      'bg-surface-container-high text-outline'
                    }`}>
                      {sim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => onDelete(sim.id, e)}
                      className="material-symbols-outlined text-[18px] text-outline hover:text-error transition-colors"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
