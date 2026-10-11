import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const prefix = '#token_hash='

function getVerificationUrl() {
  if (!window.location.hash.startsWith(prefix)) return null

  try {
    const tokenHash = window.location.hash.slice(prefix.length)
    if (!tokenHash || tokenHash.length > 512 || !/^[A-Za-z0-9_-]+$/.test(tokenHash)) return null
    const url = new URL('/auth/v1/verify', import.meta.env.VITE_SUPABASE_URL)
    url.searchParams.set('token', tokenHash)
    url.searchParams.set('type', 'recovery')
    url.searchParams.set('redirect_to', `${window.location.origin}/reset-password`)
    return url.href
  } catch {
    return null
  }
}

export default function ResetConfirmation() {
  const [verificationUrl] = useState(getVerificationUrl)

  useEffect(() => {
    // Keep the one-time link out of the address bar after this page loads.
    if (window.location.hash.startsWith(prefix)) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          <h1 className="section-title">Reset Password</h1>
          {verificationUrl ? (
            <>
              <p>Click Continue to open your password reset form.</p>
              <button
                type="button"
                className="button button-main button-big signin-btn"
                onClick={() => window.location.assign(verificationUrl)}
              >
                Continue
              </button>
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
