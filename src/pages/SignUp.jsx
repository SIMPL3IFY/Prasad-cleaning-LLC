import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"

export default function SignUp() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateSignup = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRedirect = () => {
    navigate('/portal')
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()

    if (!validateSignup()) {
      return
    }

    setIsLoading(true)
    setSignupError('')
    setConfirmMessage('')

    // Saves the new user to the database (Supabase auth.users).
    const { data, error } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: { full_name: formData.name.trim() }
      }
    })

    setIsLoading(false)

    if (error) {
      setSignupError(error.message)
      return
    }

    // With email confirmation enabled, no session is returned until the user
    // clicks the link in their email, so there is nothing to redirect into the portal until they confirm their email. WORKING PROCESS!!!
    if (!data.session) {
      setConfirmMessage(`Account created. Check ${formData.email.trim()} to confirm your email before signing in.`)
      setFormData({ name: '', email: '', password: '', confirmPassword: '' })
      return
    }

    handleRedirect()
  }

  const renderErrorMessages = (fieldName) => {
    if (errors[fieldName]) {
      return (
        <span className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
          {errors[fieldName]}
        </span>
      )
    }
    return null
  }

  const renderLoadingState = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-color, #333)' }}>
          <span>Creating account...</span>
        </div>
      )
    }
    return null
  }

  return (
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          <h1 className="section-title">Sign Up</h1>
          <p className="section-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
            Create an account to get started.
          </p>

          <form className="signin-form" onSubmit={handleSignupSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'input-error' : ''}
              />
              {renderErrorMessages('name')}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'input-error' : ''}
              />
              {renderErrorMessages('email')}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                id="password" 
                name="password"
                type="password" 
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? 'input-error' : ''}
              />
              {renderErrorMessages('password')}
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input 
                id="confirmPassword" 
                name="confirmPassword"
                type="password" 
                placeholder="••••••••" 
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? 'input-error' : ''}
              />
              {renderErrorMessages('confirmPassword')}
            </div>

            {renderLoadingState()}

            // Red error shown if the signup request fails (e.g., email already exists, network error, etc.)
            {signupError && (
              <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {signupError}
              </p>
            )}

            // Green confirmation message shown if the signup request is successful and the user needs to confirm their email
            {confirmMessage && (
              <p style={{ color: '#155724', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {confirmMessage}
              </p>
            )}

            <button type="submit" className="button button-main button-big signin-btn" disabled={isLoading}>
              Sign Up
            </button>

            <p className="signin-footer">
              Already have an account? <Link to="/signin">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
