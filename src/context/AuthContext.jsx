import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { trackPasswordRecovery } from '../lib/passwordRecovery'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let authEventReceived = false

    // SCRUM-177: picks up the session a confirmation link creates, app-wide
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      authEventReceived = true
      trackPasswordRecovery(nextSession)
      setSession(nextSession)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted && !authEventReceived) {
        trackPasswordRecovery(currentSession)
        setSession(currentSession)
        setLoading(false)
      }
    }).catch(() => {
      if (isMounted && !authEventReceived) {
        setSession(null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
