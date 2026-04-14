import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/admin',             label: 'Dashboard',        icon: 'dashboard',     end: true },
  { to: '/admin/users',       label: 'User Management',  icon: 'group' },
  { to: '/admin/questions',   label: 'Question Bank',    icon: 'database' },
  { to: '/admin/simulations', label: 'Simulations',      icon: 'assignment' },
  { to: '/admin/catalog',     label: 'Catalog',          icon: 'category' },
  { to: '/admin/generate',    label: 'AI Generate',      icon: 'auto_awesome' },
]

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '?'

  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      {/* Sidebar */}
      <aside className="flex flex-col h-screen w-64 border-r border-outline-variant/20 bg-surface-container-low sticky top-0 py-6 shrink-0">
        <div className="px-6 mb-8">
          <h1 className="font-headline font-bold text-primary text-lg">FPH Prep</h1>
          <p className="text-xs text-outline font-medium tracking-wide mt-0.5">Admin Console</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'border-r-4 border-primary bg-primary/5 text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user info */}
        <div className="px-6 pt-6 mt-auto border-t border-outline-variant/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">
                {profile?.full_name || profile?.email?.split('@')[0] || 'Admin'}
              </p>
              <p className="text-[10px] text-outline">Chief Editor</p>
            </div>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors rounded hover:bg-primary/5"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Back to App
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-on-surface-variant hover:text-error transition-colors rounded hover:bg-error/5"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex justify-between items-center px-8 w-full border-b border-outline-variant/20 h-16 bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-0 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-body outline-none"
                placeholder="Search clinical data..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-outline">
              <button className="material-symbols-outlined hover:text-primary transition-colors">notifications</button>
              <button className="material-symbols-outlined hover:text-primary transition-colors">help_outline</button>
            </div>
            <div className="h-8 w-px bg-outline-variant/30" />
            <span className="text-sm font-headline font-semibold text-primary">FPH Prep Admin</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
