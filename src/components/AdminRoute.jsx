import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return <Outlet />
}
