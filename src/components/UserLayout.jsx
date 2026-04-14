import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function UserLayout({ children }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { t } = useTranslation()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '?'

  const NAV = [
    { to: '/',         label: t('nav.dashboard'),  icon: 'dashboard',         end: true },
    { to: '/stats',    label: t('nav.stats'),       icon: 'analytics' },
    { to: '/upgrade',  label: t('nav.upgrade'),     icon: 'workspace_premium' },
    { to: '/settings', label: t('nav.settings'),    icon: 'settings' },
  ]

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Fixed left sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant/20 p-4 z-30">
        {/* Brand */}
        <div className="mb-8 px-2">
          <h1 className="font-headline font-black text-primary text-xl tracking-tight">
            FPH Prep
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-outline mt-0.5">
            FPH Exam Prep
          </p>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate">
              {profile?.full_name || profile?.email?.split('@')[0] || 'Utente'}
            </p>
            <p className="text-[10px] text-outline truncate">
              {profile?.is_premium ? t('nav.fphPremium') : t('nav.fphCandidate')}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: premium CTA or sign out */}
        <div className="mt-auto space-y-2">
          {profile?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              Admin Console
            </button>
          )}
          {!profile?.is_premium && (
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-xs font-headline font-bold tracking-wide shadow-editorial"
            >
              {t('nav.getPremium')}
            </button>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
