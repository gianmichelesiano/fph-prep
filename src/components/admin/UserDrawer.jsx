import { useEffect, useState } from 'react'
import { getUserDetail, setUserPremium, setUserAdmin, setUserBlocked } from '../../lib/adminApi'

export default function UserDrawer({ userId, onClose, onUserUpdated }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setDetail(null)
    getUserDetail(userId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  const profile = detail?.profile
  const progress = detail?.progress || []
  const payments = detail?.payments || []

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '?'

  async function handle(action) {
    setBusy(true)
    try {
      await action()
      const updated = await getUserDetail(userId)
      setDetail(updated)
      onUserUpdated(updated.profile)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[420px] bg-surface-container-lowest shadow-2xl z-50 flex flex-col border-l border-outline-variant/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h3 className="font-headline font-bold text-on-surface">Dettaglio utente</h3>
          <button onClick={onClose} className="material-symbols-outlined text-outline hover:text-on-surface transition-colors">
            close
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
          </div>
        ) : !profile ? (
          <div className="flex-1 flex items-center justify-center text-secondary text-sm">Utente non trovato</div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface text-base truncate">{profile.full_name || '—'}</p>
                  <p className="text-sm text-outline truncate">{profile.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.is_premium && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary-container text-on-secondary-container">Premium</span>
                    )}
                    {profile.is_admin && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">Admin</span>
                    )}
                    {profile.is_blocked && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-error/10 text-error">Bloccato</span>
                    )}
                    {!profile.is_premium && !profile.is_admin && !profile.is_blocked && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-surface-container-high text-outline">Free</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-xs text-outline mb-1">Registrato il</p>
                  <p className="font-medium text-on-surface">
                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString('it-IT') : '—'}
                  </p>
                </div>
                {profile.premium_since && (
                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-xs text-outline mb-1">Premium dal</p>
                    <p className="font-medium text-on-surface">
                      {new Date(profile.premium_since).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                )}
              </div>

              {/* Quiz recenti */}
              <div>
                <p className="text-xs font-semibold text-outline uppercase tracking-wide mb-2">Quiz recenti</p>
                {progress.length === 0 ? (
                  <p className="text-sm text-secondary">Nessun quiz completato</p>
                ) : (
                  <div className="space-y-2">
                    {progress.slice(0, 5).map((q, i) => {
                      const pct = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0
                      const passed = pct >= 67
                      return (
                        <div key={i} className="flex items-center justify-between bg-surface-container-low rounded-xl px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-on-surface truncate">{q.simulations?.title || 'Quiz'}</p>
                            <p className="text-xs text-outline">{q.saved_at ? new Date(q.saved_at).toLocaleDateString('it-IT') : '—'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-sm font-semibold text-on-surface">{pct}%</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${passed ? 'bg-green-100 text-green-700' : 'bg-surface-container-high text-outline'}`}>
                              {passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pagamenti */}
              <div>
                <p className="text-xs font-semibold text-outline uppercase tracking-wide mb-2">Pagamenti</p>
                {payments.length === 0 ? (
                  <p className="text-sm text-secondary">Nessun pagamento</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-surface-container-low rounded-xl px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-on-surface">CHF {((p.amount || 0) / 100).toFixed(2)}</p>
                          <p className="text-xs text-outline">{p.created_at ? new Date(p.created_at).toLocaleDateString('it-IT') : '—'}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-surface-container-high text-outline'
                        }`}>
                          {p.status || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-outline-variant/20 px-6 py-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => handle(() => setUserPremium(profile.id, !profile.is_premium))}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">{profile.is_premium ? 'star_off' : 'star'}</span>
                  {profile.is_premium ? 'Revoca premium' : 'Imposta premium'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => handle(() => setUserAdmin(profile.id, !profile.is_admin))}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">{profile.is_admin ? 'shield_off' : 'shield_person'}</span>
                  {profile.is_admin ? 'Rimuovi admin' : 'Imposta admin'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => handle(() => setUserBlocked(profile.id, !profile.is_blocked))}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
                    profile.is_blocked
                      ? 'border-error/30 text-error hover:bg-error/5'
                      : 'border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{profile.is_blocked ? 'lock_open' : 'block'}</span>
                  {profile.is_blocked ? 'Sblocca' : 'Blocca'}
                </button>
              </div>

            </div>
          </>
        )}
      </aside>
    </>
  )
}
