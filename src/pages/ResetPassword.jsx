import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isCheckingLink, setIsCheckingLink] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isMounted = true

    // SCRUM-177: depends on detectSessionInUrl — regression-test this ticket
    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (isMounted) {
        setIsReady(Boolean(session))
        setIsCheckingLink(false)
      }
    }

    checkRecoverySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted && (event === 'PASSWORD_RECOVERY' || session)) {
        setIsReady(true)
        setIsCheckingLink(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess('Your password has been updated. Redirecting to your dashboard...')
    setTimeout(() => navigate('/portal', { replace: true }), 1500)
  }

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          <h1 className="section-title">Create New Password</h1>
          <p className="section-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
            Enter and confirm your new password.
          </p>

          {isCheckingLink ? (
            <p className="auth-status">Checking your reset link...</p>
          ) : !isReady ? (
            <>
              <p className="form-error" role="alert">
                This password-reset link is invalid or has expired. Please request a new one.
              </p>
              <p className="signin-footer"><Link to="/signin">Return to Sign In</Link></p>
            </>
          ) : (
            <form className="signin-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {error && <p className="form-error" role="alert">{error}</p>}
              {success && <p className="form-success" role="status">{success}</p>}

              <button type="submit" className="button button-main button-big signin-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
