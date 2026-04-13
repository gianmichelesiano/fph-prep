import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getStats, getRegistrationTrend, getRecentActivity, getAreaQuestionCounts } from '../../lib/adminApi'
import { AREAS } from '../../data/areas'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function buildChartPaths(data) {
  if (!data.length) return null
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * 100 : 50,
    y: 10 + (1 - d.count / maxCount) * 80,
  }))
  if (pts.length === 1) {
    return { line: `M${pts[0].x},${pts[0].y}`, area: '' }
  }
  let line = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cp = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    line += ` C${cp},${pts[i - 1].y.toFixed(1)} ${cp},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
  }
  return { line, area: `${line} L100,100 L0,100 Z` }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState([])
  const [activity, setActivity] = useState([])
  const [areaCounts, setAreaCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStats(), getRegistrationTrend(30), getRecentActivity(5), getAreaQuestionCounts()])
      .then(([s, t, a, counts]) => {
        setStats(s)
        setTrend(t)
        setActivity(a)
        setAreaCounts(counts)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const conversionRate = stats?.totalUsers > 0
    ? Math.round((stats.premiumUsers / stats.totalUsers) * 100)
    : 0
  const passRate = stats?.completedQuizzes > 0
    ? Math.round((stats.passedQuizzes / stats.completedQuizzes) * 100)
    : 0

  const kpis = [
    {
      label: 'Total Users',
      value: stats?.totalUsers != null ? stats.totalUsers.toLocaleString() : '—',
      icon: 'person',
      iconBg: 'bg-primary/5 text-primary',
      badge: stats?.totalUsers > 0 ? `${conversionRate}% conv.` : null,
      badgeStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Premium Revenue',
      value: stats ? `CHF ${Math.round(stats.totalRevenue).toLocaleString()}` : '—',
      icon: 'payments',
      iconBg: 'bg-primary/5 text-primary',
      badge: stats?.premiumUsers > 0 ? `${stats.premiumUsers} active` : null,
      badgeStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Tests Completed',
      value: stats?.completedQuizzes != null ? stats.completedQuizzes.toLocaleString() : '—',
      icon: 'task_alt',
      iconBg: 'bg-surface-container text-on-surface-variant',
      badge: 'Total',
      badgeStyle: 'bg-surface-container text-outline',
    },
    {
      label: 'Overall Pass Rate',
      value: stats ? `${passRate}%` : '—',
      icon: 'school',
      iconBg: 'bg-secondary-container/30 text-secondary',
      badge: passRate > 0 ? (passRate >= 67 ? '▲ Good' : '▼ Low') : null,
      badgeStyle: passRate >= 67
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-error-container/20 text-error',
    },
  ]

  const chartPaths = buildChartPaths(trend)

  // Content health: merge AREAS data with actual question counts from DB
  const contentHealth = Object.entries(AREAS).map(([id, area]) => {
    const count = areaCounts[Number(id)] || 0
    const maxCount = Math.max(...Object.values(areaCounts), 1)
    const pct = Math.round((count / maxCount) * 100)
    return { id, name: area.name, count, pct }
  }).sort((a, b) => b.count - a.count)

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">
              System Overview
            </h2>
            <p className="text-secondary font-body mt-1">
              Academic performance and operational metrics for the FPH Prep ecosystem.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-surface-container-high rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-highest transition-colors">
              Export Report
            </button>
            <button
              className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl text-sm font-medium shadow-card hover:opacity-90 transition-opacity"
              onClick={() => navigate('/admin/simulations')}
            >
              Manage Areas
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 animate-pulse h-32" />
              ))
            : kpis.map(({ label, value, icon, iconBg, badge, badgeStyle }) => (
                <div key={label} className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${iconBg}`}>
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>
                    {badge && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-outline text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
                  <h3 className="text-2xl font-headline font-bold text-on-surface">{value}</h3>
                </div>
              ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* User Registrations — SVG line chart */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-card">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="font-headline font-bold text-lg text-on-surface">User Registrations</h4>
                <p className="text-sm text-secondary">New students over the last 30 days</p>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">30 Days</span>
              </div>
            </div>

            {chartPaths ? (
              <>
                <div className="relative h-64">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="border-t border-outline-variant/15 w-full" />
                    ))}
                  </div>
                  {/* SVG chart */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#005f6a" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#005f6a" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {chartPaths.area && (
                      <path d={chartPaths.area} fill="url(#chartGradient)" />
                    )}
                    <path
                      d={chartPaths.line}
                      fill="none"
                      stroke="#005f6a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
                <div className="flex justify-between mt-4 text-[10px] text-outline font-medium tracking-widest uppercase">
                  <span>{trend[0]?.date?.slice(5)}</span>
                  <span>{trend[Math.floor(trend.length / 3)]?.date?.slice(5)}</span>
                  <span>{trend[Math.floor((trend.length * 2) / 3)]?.date?.slice(5)}</span>
                  <span>{trend[trend.length - 1]?.date?.slice(5)}</span>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-secondary text-sm">No registration data available</p>
              </div>
            )}
          </div>

          {/* Revenue vs Conversions */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-card flex flex-col">
            <h4 className="font-headline font-bold text-lg text-on-surface mb-1">Revenue vs. Conversions</h4>
            <p className="text-sm text-secondary mb-8">Quarterly performance</p>
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-on-surface-variant">Revenue</span>
                  <span className="text-primary">
                    {stats ? `CHF ${Math.round(stats.totalRevenue).toLocaleString()}` : '—'}
                  </span>
                </div>
                <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(conversionRate * 1.2, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-on-surface-variant">Conversions</span>
                  <span className="text-primary-container">{stats?.premiumUsers ?? 0} users</span>
                </div>
                <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full transition-all"
                    style={{ width: `${conversionRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-on-surface-variant">Pass Rate</span>
                  <span className="text-secondary">{passRate}%</span>
                </div>
                <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: `${passRate}%` }} />
                </div>
              </div>
            </div>
            {/* Mini bar chart */}
            <div className="grid grid-cols-4 gap-2 h-16 items-end mt-8">
              {[40, 60, 85, 75].map((h, i) => (
                <div
                  key={i}
                  className={`rounded-t-sm ${i === 3 ? 'bg-primary' : 'bg-primary/20'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom grid: Recent Activity + Content Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-headline font-bold text-lg text-on-surface">Recent Activity</h4>
              <button
                className="text-primary text-xs font-semibold hover:underline"
                onClick={() => navigate('/admin/users')}
              >
                View All
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-surface-container rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activity.length > 0 ? (
              <div className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-outline text-xs border-b border-outline-variant/20">
                      <th className="pb-3 pr-4 font-medium">User</th>
                      <th className="pb-3 px-4 font-medium">Action</th>
                      <th className="pb-3 px-4 font-medium">Status</th>
                      <th className="pb-3 pl-4 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {activity.map((row, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {row.initials}
                            </div>
                            <span className="font-medium text-on-surface text-xs">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-on-surface-variant text-xs">{row.action}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === 'PASSED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-right text-outline text-xs">{timeAgo(row.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">history</span>
                <p className="text-secondary text-sm">No recent activity</p>
              </div>
            )}
          </div>

          {/* Content Health */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-card">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="font-headline font-bold text-lg text-on-surface">Content Health</h4>
                <p className="text-sm text-secondary">Question distribution by area</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto max-h-72 pr-1">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-surface-container rounded-lg animate-pulse" />
                ))
              ) : contentHealth.map(({ id, name, count, pct }) => (
                <div key={id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-on-surface">{name}</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded">
                      {count} Qs
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 min-w-[36px]">
                      <span
                        className="material-symbols-outlined text-amber-500 text-[14px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      <span className="text-xs font-bold text-on-surface-variant">
                        {count > 0 ? (4.5 + Math.min(count / 1000, 0.4)).toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
