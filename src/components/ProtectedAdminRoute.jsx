import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ProtectedAdminRoute() {
    const location = useLocation()
    const [status, setStatus] = useState('checking')

    useEffect(() => {
        let isMounted = true
        
        const verifyAdmin = async () => {
            const { data: { user }, error: userError, } = await supabase.auth.getUser()

            if (!isMounted) return

            if (userError || !user) {
                setStatus('signed-out')
                return
            }

            const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle()

            if (!isMounted) return

            if(profileError || profile?.is_admin !== true) {
                setStatus('fordibben')
                return
            }

            setStatus('authorized')
        }

        verifyAdmin()

        return () => {
            isMounted = false
        }
    }, [])

    if (status == 'checking') {
        return (
            <p
                role="status"
                style={{ padding: '2rem', textAlign: 'center' }}
            >Verifying admin access...</p>
        )
    }

    if (status !== 'authorized') {
        return (
            <Navigate
                to="admin/login"
                replace
                state={{
                    from: location.pathname,
                    message:
                        status === 'forbidden'
                        ? 'Access denied. This account is not an administrator.'
                        : 'Please sign in with an administrator account.',
                }}/>
        )
    }

    return <Outlet />
}