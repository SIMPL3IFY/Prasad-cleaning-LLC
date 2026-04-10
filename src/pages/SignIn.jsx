import { useNavigate } from "react-router-dom"
export default function SignIn() {
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/portal')
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
              <input id="email" type="email" placeholder="you@example.com" required />
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
