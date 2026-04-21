import { useState } from "react"
import { useNavigate } from "react-router-dom"

// SCRUM-119: admin email routes to admin dashboard.
const ADMIN_EMAIL = 'admin@prasad'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      navigate('/admin')
    } else {
      navigate('/portal')
    }
  }

  const handleAdminSignIn = () => {
    navigate('/AdminDashboard')
  }
  
  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
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
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>

            <button type="submit" className="button button-main button-big signin-btn">
              Sign In
            </button>

            <p className="signin-footer">
              Don't have an account? <a href="#">Create one</a>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
