import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

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

    // Simulate API call for account creation
    setTimeout(() => {
      setIsLoading(false)
      handleRedirect()
    }, 1000)
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
