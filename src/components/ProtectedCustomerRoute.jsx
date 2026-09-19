import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// SCRUM 172: Prevents signed-out visitors from opening customer-only pages.
export default function ProtectedCustomerRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="auth-status">Loading your account...</p>
  }

  if (!user) {
    // Preserve the requested location while returning the visitor to Sign In.
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  return <Outlet />
}
