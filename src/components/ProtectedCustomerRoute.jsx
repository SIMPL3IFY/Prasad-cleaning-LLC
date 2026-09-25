import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedCustomerRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="auth-status">Loading your account...</p>
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  return <Outlet />
}
