import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { runPipeline, fetchPipelineJobs, fetchPipelineStatus } from '../../lib/adminBackendApi'

function StatusBadge({ status }) {
  const map = {
    pending: 'bg-surface-container-high text-on-surface-variant',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-error-container text-error',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${map[status] || map.pending}`}>
      {status === 'pending' ? 'In coda' :
       status === 'running' ? 'In corso' :
       status === 'completed' ? 'Completato' :
       status === 'failed' ? 'Fallito' : status}
    </span>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pipeline form
  const [showForm, setShowForm] = useState(false)
  const [pipelineForm, setPipelineForm] = useState({ config: 'default', tema: '', solo_assembla: false })
  const [launching, setLaunching] = useState(false)
  const [launchMsg, setLaunchMsg] = useState(null)

  // Expanded job detail
  const [expandedJob, setExpandedJob] = useState(null)
  const [jobDetail, setJobDetail] = useState(null)

  function loadJobs() {
    fetchPipelineJobs()
      .then(data => { setJobs(data || []); setLoading(false); setError(null) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { loadJobs() }, [])

  // Auto-refresh every 10s while jobs are pending/running
  useEffect(() => {
    const hasRunning = (jobs || []).some(j => j.status === 'pending' || j.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(loadJobs, 10000)
    return () => clearInterval(interval)
  }, [jobs])

  async function handleLaunch() {
    setLaunching(true)
    setLaunchMsg(null)
    try {
      const result = await runPipeline({
        config: pipelineForm.config,
        tema: pipelineForm.tema || undefined,
        solo_assembla: pipelineForm.solo_assembla,
      })
      setLaunchMsg({ type: 'success', text: `Pipeline avviata. Job ID: ${result.job_id || result.id || '—'}` })
      setShowForm(false)
      loadJobs()
    } catch (e) {
      setLaunchMsg({ type: 'error', text: e.message })
    } finally {
      setLaunching(false)
    }
  }

  async function handleExpandJob(jobId) {
    if (expandedJob === jobId) {
      setExpandedJob(null)
      setJobDetail(null)
      return
    }
    setExpandedJob(jobId)
    setJobDetail(null)
    try {
      const detail = await fetchPipelineStatus(jobId)
      setJobDetail(detail)
    } catch (e) {
      setJobDetail({ error: e.message })
    }
  }

  const runningCount = (jobs || []).filter(j => j.status === 'pending' || j.status === 'running').length

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">Jobs</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {jobs.length} job totali{runningCount > 0 && ` · ${runningCount} in esecuzione`}
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setLaunchMsg(null) }}
            className="btn-primary text-sm"
          >
            {showForm ? 'Chiudi' : 'Lancia pipeline'}
          </button>
        </header>

        {/* Pipeline form */}
        {showForm && (
          <div className="card mb-6">
            <h3 className="font-bold text-on-surface mb-3">Lancia pipeline esame</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-outline uppercase mb-1 block">Config</label>
                <input
                  className="input text-sm w-full"
                  placeholder="default"
                  value={pipelineForm.config}
                  onChange={e => setPipelineForm(prev => ({ ...prev, config: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-outline uppercase mb-1 block">Tema (opzionale)</label>
                <input
                  className="input text-sm w-full"
                  placeholder="Es. farmacologia..."
                  value={pipelineForm.tema}
                  onChange={e => setPipelineForm(prev => ({ ...prev, tema: e.target.value }))}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelineForm.solo_assembla}
                    onChange={e => setPipelineForm(prev => ({ ...prev, solo_assembla: e.target.checked }))}
                    className="rounded"
                  />
                  Solo assembla
                </label>
              </div>
            </div>

            {launchMsg && (
              <div className={`mb-3 px-3 py-2 rounded text-sm ${launchMsg.type === 'error' ? 'bg-error-container text-error' : 'bg-green-100 text-green-800'}`}>
                {launchMsg.text}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="btn-primary text-sm"
              >
                {launching ? 'Avvio...' : 'Lancia'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="btn-secondary text-sm"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Jobs table */}
        {loading ? (
          <p className="text-sm text-outline">Caricamento...</p>
        ) : error ? (
          <p className="text-sm text-error">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-outline">Nessun job. Lancia una pipeline per iniziare.</p>
        ) : (
          <div className="rounded-xl bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Stato</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Durata</th>
                  <th className="px-4 py-3 font-semibold">Errore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {jobs.map(j => {
                  const duration = j.started_at && j.completed_at
                    ? Math.round((new Date(j.completed_at) - new Date(j.started_at)) / 1000)
                    : null
                  return (
                    <>
                      <tr
                        key={j.id}
                        className="hover:bg-surface-container-low cursor-pointer"
                        onClick={() => handleExpandJob(j.id)}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{typeof j.id === 'string' ? j.id.slice(0, 8) : j.id}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                            {j.type || j.job_type || 'pipeline'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant">
                          {j.created_at ? new Date(j.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant">
                          {duration ? `${duration}s` : j.status === 'running' ? '...' : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-error max-w-[200px] truncate">
                          {j.error || ''}
                        </td>
                      </tr>
                      {/* Expanded detail */}
                      {expandedJob === j.id && (
                        <tr key={`${j.id}-detail`}>
                          <td colSpan={6} className="px-4 py-3 bg-surface-container-lowest">
                            {jobDetail === null ? (
                              <span className="text-xs text-outline">Caricamento...</span>
                            ) : jobDetail?.error ? (
                              <span className="text-xs text-error">{jobDetail.error}</span>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-on-surface">Dettaglio job</div>
                                <pre className="text-[10px] text-on-surface-variant bg-surface-container-low rounded-lg p-3 max-h-48 overflow-auto font-mono whitespace-pre-wrap">
                                  {JSON.stringify(jobDetail, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
