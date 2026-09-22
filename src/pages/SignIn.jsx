import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"


export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false) // Scrum 71: Controls which form is visible
  const [resetEmail, setResetEmail] = useState('') // Scrum 71: Email input for forgot password form
  const [resetMessage, setResetMessage] = useState('') // Scrum 71: Confirmation message after submission
  const [resetError, setResetError] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // SCRUM-177: unconfirmed accounts fail here with "Email not confirmed"
    if (error) {
      setError(error.message)
      return
    }
    navigate('/portal')
  }

  const handleAdminSignIn = () => {
    navigate('/admin/login')
  }

  // Scrum 36: Redirects a user without an account to the sign up page
  const handleSignUp = () => {
    navigate('/signup')
  }
  

  // Scrum 71: Handles forgot password form submission
  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setResetMessage('')
    setResetError('')
    setIsSendingReset(true)

    const normalizedEmail = resetEmail.trim()
    const { error: resetRequestError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSendingReset(false)

    if (resetRequestError) {
      setResetError(resetRequestError.message)
      return
    }

    setResetMessage(`A reset link has been sent to ${normalizedEmail}. Please check your inbox.`)
    setResetEmail('')
  }

  // Scrum 71: Renders the forgot password form
  const renderForgotPasswordForm = () => (
    <>
      <h1 className="section-title">Reset Password</h1>
      <p className="section-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
        Enter your email and we'll send you a reset link.
      </p>

      <form className="signin-form" onSubmit={handleForgotSubmit}>
        <div className="form-group">
          <label htmlFor="reset-email">Email Address</label>
          <input
            id="reset-email"
            type="email"
            placeholder="you@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
          />
        </div>

        {resetMessage && (
          <p className="form-success" role="status">
            {resetMessage}
          </p>
        )}

        {resetError && <p className="form-error" role="alert">{resetError}</p>}

        <button type="submit" className="button button-main button-big signin-btn" disabled={isSendingReset}>
          {isSendingReset ? 'Sending...' : 'Send Reset Link'}
        </button>

        <p className="signin-footer">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setShowForgotPassword(false); setResetMessage(''); setResetError(''); setResetEmail('') }}
          >
            Back to Sign In
          </a>
        </p>
      </form>
    </>
  )

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          {showForgotPassword ? renderForgotPasswordForm() : ( // Scrum 71: Toggle between sign in and forgot password
            <>
              <h1 className="section-title">Sign In</h1>
              <p className="section-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
                Access your account to manage bookings and services.
              </p>


          <form className="signin-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && (
              <p style={{ color: 'crimson', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
            )}

            <div className="form-footer-row">
                  <a
                    href="#"
                    className="forgot-link"
                    onClick={(e) => { e.preventDefault(); setShowForgotPassword(true) }}
                  >
                    Forgot password?
                  </a>
                </div>

            <button type="submit" className="button button-main button-big signin-btn">
              Sign In
            </button>

            <button
              type="button"
              onClick={handleAdminSignIn}
              className="button button-main button-big signin-btn"
              style={{ marginTop: '1rem' }}
            >
              Admin Login
            </button>

            {/* Scrum 36: Redirects a user without an account to the sign up page */}
            <button
              type="button"
              onClick={handleSignUp}
              className="button button-main button-big signin-btn"
              style={{ marginTop: '1rem' }}
            >
              Sign Up
            </button>

            <p className="signin-footer">
              Don't have an account? <Link to="/signup">Create one</Link>
            </p>
          </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
