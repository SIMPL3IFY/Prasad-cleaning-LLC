import { useEffect, useState } from "react"
import { useNavigate, Link , useLocation } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"


export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation() // Scrum 168: Access the location object to retrieve state passed from navigation
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(location.state?.message || '') // Scrum 168: Initial error message from location state
  const [isLoading, setIsLoading] = useState(false) // Scrum 168: Tracks the state of the sign-in request
  const [showForgotPassword, setShowForgotPassword] = useState(false) // Scrum 71: Controls which form is visible
  const [resetEmail, setResetEmail] = useState('') // Scrum 71: Email input for forgot password form
  const [resetMessage, setResetMessage] = useState('') // Scrum 71: Confirmation message after submission
  const [resetError, setResetError] = useState('') // Scrum 168: Tracks errors for the forgot password form
  const [isSendingReset, setIsSendingReset] = useState(false) // Scrum 168: Tracks the state of the forgot password request
  const [needsConfirmation, setNeedsConfirmation] = useState(false) // Scrum 177: Sign-in blocked until email is confirmed
  const [resendMessage, setResendMessage] = useState('') // Scrum 177: Feedback after resending the confirmation email
  const [resendCooldown, setResendCooldown] = useState(0) // Scrum 177: Seconds until resend is allowed again

  // Scrum 177: Count down the resend cooldown one second at a time
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setNeedsConfirmation(false)
    setResendMessage('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError('Please enter both email and password.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    
    setIsLoading(true) // Scrum 168: Indicate that the sign-in request is in progress

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

    // SCRUM-177: unconfirmed accounts fail here with "Email not confirmed"
    if (error) {
      setIsLoading(false) // Scrum 168: Stop indicating that the sign-in request is in progress

      // Scrum 177: Supabase rejects unconfirmed accounts with this code
      if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
        setNeedsConfirmation(true)
        setError('Please confirm your email before signing in. Check your inbox for the confirmation link.')
        return
      }
      setError(error.message)
      return
    }
    if (!data?.user) {
      setIsLoading(false)
      setError('Unable to identify the signed-in account. Please try again.')
      return
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      await supabase.auth.signOut()
      setIsLoading(false)
      setError('Unable to retrieve user profile. Please try again.')
      return
    }

    if (!profile) {
      await supabase.auth.signOut()
      setIsLoading(false)
      setError('User profile not found. Please try again.')
      return
    }

    setIsLoading(false)

    if (profile.is_admin === true) {
      navigate('/admin', { replace: true })
    } else {
      navigate('/portal', { replace: true })
    }
  }

  // Scrum 177: Resend the sign-up confirmation email
  const handleResendConfirmation = async () => {
    setResendMessage('')
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })

    if (resendError) {
      setResendMessage(resendError.message)
      return
    }

    setResendCooldown(60)
    setResendMessage(`A new confirmation link was sent to ${email}.`)
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
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />
            </div>

            {error && (
              <p style={{ color: 'crimson', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
            )}

            {/* Scrum 177: Offer to resend the confirmation email when sign-in is blocked */}
            {needsConfirmation && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="button button-main button-big signin-btn"
                  onClick={handleResendConfirmation}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend confirmation email'}
                </button>
                {resendMessage && (
                  <p role="status" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{resendMessage}</p>
                )}
              </div>
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

            <button type="submit" className="button button-main button-big signin-btn" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
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
