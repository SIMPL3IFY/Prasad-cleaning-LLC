import { useState } from "react"
import { useNavigate } from "react-router-dom"

// SCRUM-119: admin email routes to admin dashboard.
const ADMIN_EMAIL = 'admin@prasad'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false) // Scrum 71: Controls which form is visible
  const [resetEmail, setResetEmail] = useState('') // Scrum 71: Email input for forgot password form
  const [resetMessage, setResetMessage] = useState('') // Scrum 71: Confirmation message after submission

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      navigate('/admin')
    } else {
      navigate('/portal')
    }
  }

  // Scrum 71: Handles forgot password form submission
  const handleForgotSubmit = (e) => {
    e.preventDefault()
    setResetMessage(`A reset link has been sent to ${resetEmail}.`)
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
          <p style={{ color: '#155724', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {resetMessage}
          </p>
        )}

        <button type="submit" className="button button-main button-big signin-btn">
          Send Reset Link
        </button>

        <p className="signin-footer">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setShowForgotPassword(false); setResetMessage(''); setResetEmail('') }}
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
                  <input id="password" type="password" placeholder="••••••••" required />
                </div>

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

                <p className="signin-footer">
                  Don't have an account? <a href="#">Create one</a>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
