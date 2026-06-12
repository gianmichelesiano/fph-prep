import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { countDueQuestions } from '../lib/srs'

export default function UserLayout({ children }) {
  const navigate = useNavigate()
  const { profile, signOut, user } = useAuth()
  const { t } = useTranslation()
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    if (user) {
      countDueQuestions(user.id).then(setReviewCount).catch(() => {})
    }
  }, [user])

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '?'

  const NAV = [
    { to: '/',         label: t('nav.dashboard'),  icon: 'dashboard',            end: true },
    { to: '/study',    label: t('nav.study'),       icon: 'menu_book',            badge: reviewCount },
    { to: '/stats',    label: t('nav.stats'),       icon: 'analytics' },
    { to: '/upgrade',  label: t('nav.upgrade'),     icon: 'workspace_premium' },
    { to: '/settings', label: t('nav.settings'),    icon: 'settings' },
  ]

  const BOTTOM_NAV = [
    { to: '/',       icon: 'dashboard',       label: t('nav.dashboard') },
    { to: '/study',  icon: 'menu_book',       label: t('nav.study'),     badge: reviewCount },
    { to: '/stats',  icon: 'analytics',       label: t('nav.stats') },
    { to: '/settings', icon: 'person',        label: t('nav.settings') },
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
          {NAV.map(({ to, label, icon, end, badge }) => (
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
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
                  {badge}
                </span>
              )}
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

      {/* Bottom nav (mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/20 z-30 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {BOTTOM_NAV.map(({ to, icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-outline hover:text-on-surface-variant'
                }`
              }
            >
              <span className="material-symbols-outlined text-[22px] relative">
                {icon}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-tight truncate max-w-[64px]">
                {label}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
