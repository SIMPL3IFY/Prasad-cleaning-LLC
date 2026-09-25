import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from '../lib/supabaseClient'

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
  const [successMessage, setSuccessMessage] = useState('')
  // Scrum 177: Email awaiting confirmation, and resend cooldown state
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')

  // Scrum 177: Count down the resend cooldown one second at a time
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])
  
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
    
    const specialCharPattern = /[!@#$%^&*(),.?":{}|<>_\-+=[\]/\\~`]/

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!specialCharPattern.test(formData.password)) {
      newErrors.password = 'Password must include at least 1 special character'
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /*const handleRedirect = () => {
    navigate('/portal')
  }*/

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateSignup()) {
      return
    }

    setErrors({})
    setSuccessMessage('')
    setIsLoading(true)

    const email = formData.email.trim()

    const {data, error } = await supabase.auth.signUp({
      email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.name.trim()
        },
        // Scrum 177: Send the confirmation link back to our callback page
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    setIsLoading(false)

    if (error) {
      setErrors({ general: error.message})
      return
    }

    // SCRUM-177: a session here means email confirmation is OFF in Supabase
    if (data.session) {
      setSuccessMessage('Account created successfully. Redirecting...')
      setTimeout(() => navigate('/portal'), 1200)
      return
    }

    // Scrum 177: Stay on this page so the user can resend the confirmation email
    setPendingEmail(email)
    setResendCooldown(60)
    setSuccessMessage(`Account created. We sent a confirmation link to ${email}. Confirm your email, then sign in.`)
  }

  // Scrum 177: Resend the sign-up confirmation email
  const handleResend = async () => {
    setResendMessage('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })

    if (error) {
      setResendMessage(error.message)
      return
    }

    setResendCooldown(60) // Scrum 177: Set a longer cooldown for resending confirmation emails
    setResendMessage(`A new confirmation link was sent to ${pendingEmail}.`)
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
          {/* Scrum 177: After sign up, show the confirmation panel instead of the form */}
          {pendingEmail ? (
            <div style={{ textAlign: 'center' }}>
              <h1 className="section-title">Confirm your email</h1>
              <p role="status" className="section-subtitle" style={{ color: '#155724', marginBottom: '1rem' }}>
                {successMessage}
              </p>

              {resendMessage && (
                <p role="status" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {resendMessage}
                </p>
              )}

              <button
                type="button"
                className="button button-main button-big signin-btn"
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend confirmation email'}
              </button>

              <p className="signin-footer">
                Already confirmed? <Link to="/signin">Sign In</Link>
              </p>
            </div>
          ) : (
          <>
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
               <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #666)', display: 'block', marginTop: '0.25rem' }}>
                Must be at least 8 characters and include 1 special character
              </span>
              
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

            {renderErrorMessages('general')}

            {successMessage && (
              <p role="status" style={{ color: 'green', textAlign: 'center', marginBottom: '1rem'}}>
                {successMessage}
              </p>
            )}
            
            {renderLoadingState()}

            {errors.submit && (
              <p className="error-text" style={{ color: 'red', marginBottom: '1rem' }}>
                {errors.submit}
              </p>
            )}

            {successMessage && (
              <p style={{ color: '#155724', marginBottom: '1rem' }}>
                {successMessage}
              </p>
            )}

            <button type="submit" className="button button-main button-big signin-btn" disabled={isLoading}>
              Sign Up
            </button>

            <p className="signin-footer">
              Already have an account? <Link to="/signin">Sign In</Link>
            </p>
          </form>
          </>
          )}
        </div>
      </div>
    </section>
  )
}
