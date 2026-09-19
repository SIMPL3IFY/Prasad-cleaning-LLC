import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// SCRUM 172: Shares the persisted Supabase session and account role with every page.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // SCRUM 172: Restores the saved session on refresh and follows later sign-in/sign-out events.
  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted) {
        setRoleLoading(Boolean(currentSession?.user))
        setSession(currentSession)
        setSessionLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep account navigation hidden until the matching role query finishes.
      setRoleLoading(Boolean(nextSession?.user))
      setSession(nextSession)
      setSessionLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // SCRUM 172: Loads the user's role so Dashboard points to the correct customer or admin page.
  useEffect(() => {
    let isMounted = true
    const userId = session?.user?.id

    if (!userId) {
      setIsAdmin(false)
      setRoleLoading(false)
      return undefined
    }

    setRoleLoading(true)

    const loadRole = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle()

      if (isMounted) {
        setIsAdmin(!error && profile?.is_admin === true)
        setRoleLoading(false)
      }
    }

    loadRole()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    isAdmin,
    loading: sessionLoading || roleLoading,
  }), [session, isAdmin, sessionLoading, roleLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
