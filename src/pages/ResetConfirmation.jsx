import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { markPasswordRecovery } from '../lib/passwordRecovery'

const prefix = '#token_hash='

function getTokenHash() {
  if (!window.location.hash.startsWith(prefix)) return null
  const tokenHash = window.location.hash.slice(prefix.length)
  return tokenHash && tokenHash.length <= 512 && /^[A-Za-z0-9_-]+$/.test(tokenHash)
    ? tokenHash : null
}

export default function ResetConfirmation() {
  const navigate = useNavigate()
  const [tokenHash] = useState(getTokenHash)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const verifying = useRef(false)
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    // Keep the one-time link out of the address bar after this page loads.
    if (window.location.hash.startsWith(prefix)) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    return () => { isMounted.current = false }
  }, [])

  const handleContinue = async () => {
    if (!tokenHash || verifying.current) return
    verifying.current = true
    setIsVerifying(true)
    setError('')

    try {
      // Verify directly so the session stays on this origin, without an Auth redirect.
      const { data, error: verificationError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })
      if (verificationError) throw verificationError
      if (!data?.session?.access_token) {
        throw new Error('This password-reset link is invalid or has expired. Please request a new one.')
      }

      markPasswordRecovery(data.session.access_token)
      if (isMounted.current) navigate('/reset-password', { replace: true })
    } catch (verificationError) {
      if (isMounted.current) {
        setError(verificationError.message || 'Unable to verify your reset link. Please try again.')
      }
    } finally {
      verifying.current = false
      if (isMounted.current) setIsVerifying(false)
    }
  }

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          <h1 className="section-title">Reset Password</h1>
          {tokenHash ? (
            <>
              <p>Click Continue to open your password reset form.</p>
              <button
                type="button"
                className="button button-main button-big signin-btn"
                onClick={handleContinue}
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Continue'}
              </button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          ) : (
            <>
              <p className="form-error" role="alert">This password-reset link is invalid. Please request a new one.</p>
              <p className="signin-footer"><Link to="/signin">Return to Sign In</Link></p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
