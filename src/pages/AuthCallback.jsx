import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Scrum 177: Landing page for the email confirmation link sent on sign up.
export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    let settled = false
    let timeoutId

    // Supabase puts link errors (expired, already used) in the URL hash.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const linkError = hashParams.get('error_description') || hashParams.get('error')
    if (linkError) {
      setErrorMessage(linkError.replace(/\+/g, ' '))
      setStatus('error')
      return
    }

    const markConfirmed = async () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      // The link signs the user in; clear that so they sign in themselves.
      await supabase.auth.signOut({ scope: 'local' })
      if (!isMounted) return
      setStatus('confirmed')
      timeoutId = setTimeout(() => navigate('/signin', { replace: true }), 2500)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) markConfirmed()
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      if (session) {
        markConfirmed()
        return
      }
      timeoutId = setTimeout(() => {
        if (!isMounted || settled) return
        settled = true
        setErrorMessage('This confirmation link is invalid or has expired.')
        setStatus('error')
      }, 5000)
    })

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card" style={{ textAlign: 'center' }}>
          {status === 'checking' && (
            <>
              <h1 className="section-title">Confirming your email...</h1>
              <p role="status" className="section-subtitle">Please wait a moment.</p>
            </>
          )}

          {status === 'confirmed' && (
            <>
              <h1 className="section-title">Email confirmed</h1>
              <p role="status" className="section-subtitle" style={{ color: '#155724' }}>
                Your email has been verified. Redirecting you to sign in...
              </p>
              <p className="signin-footer">
                <Link to="/signin">Go to Sign In</Link>
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="section-title">Confirmation failed</h1>
              <p role="alert" className="section-subtitle" style={{ color: 'crimson' }}>
                {errorMessage}
              </p>
              <p className="signin-footer">
                <Link to="/signin">Go to Sign In</Link> to request a new confirmation email.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
