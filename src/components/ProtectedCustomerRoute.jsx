import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { usePasswordRecovery } from '../lib/passwordRecovery'

export default function ProtectedCustomerRoute() {
  const { session, user, loading } = useAuth()
  const recovering = usePasswordRecovery()
  const location = useLocation()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let isMounted = true

    if (loading || recovering) return () => { isMounted = false }

    if (!session || !user) {
      setStatus('signed-out')
      return () => { isMounted = false }
    }

    setStatus('checking')

    const verifySession = async () => {
      try {
        const { data: { user: activeUser }, error } = await supabase.auth.getUser()
        if (!isMounted) return

        if (error || activeUser?.id !== user.id) {
          await supabase.auth.signOut({ scope: 'local' })
          if (isMounted) setStatus('signed-out')
          return
        }

        setStatus('authorized')
      } catch {
        if (isMounted) setStatus('signed-out')
      }
    }

    verifySession()

    return () => { isMounted = false }
  }, [loading, session, user, recovering])

  if (recovering) {
    return <Navigate to="/reset-password" replace />
  }

  if (loading || status === 'checking') {
    return <p className="auth-status">Loading your account...</p>
  }

  if (status !== 'authorized') {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  return <Outlet />
}
