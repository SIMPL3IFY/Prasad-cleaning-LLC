import { useState } from 'react'
import { useLocation, useNavigate} from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminLogin() {
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState(
        location.state?.message || ''
    )
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setErrorMessage('')

        const normalizedEmail = email.trim().toLowerCase()

        if (!normalizedEmail || !password) {
            setErrorMessage('Email and password are required')
            return
        }

        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setErrorMessage('Please enter a valid email address.')
            return
        }

        setIsLoading(true)

        const { data, error: signInError} =
            await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            })

            if(signInError) {
                setIsLoading(false)
                setErrorMessage('Unable to sign in. Check your email and password.')
                return
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', data.user.id)
                .maybeSingle()
            
            if (profileError || profile?.is_admin !== true) {
                await supabase.auth.signOut()

                setIsLoading(false)
                setErrorMessage('Access denied. This account is not an administrator.')
                return
            }

            navigate('/admin', { replace: true })
    }

    return(
        <section className="section signin-section">
            <div className="container">
                <div className="signin-card">
                    <h1 className="section-title">Admin Login</h1>

                    <p 
                        className="section-subtitle"
                        style={{ marginBottom: 'var(--space-x1)' }}
                    >Sign in with an authorized administrator account.</p>

                    <form
                        className="signin-form"
                        onSubmit={handleSubmit}
                        noValidate
                    >
                        <div className="form-group">
                            <label htmlFor="admin-email">Email Address</label>
                            <input
                                id="admin-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                disabled={isLoading}/>
                        </div>

                        <div className="form-group">
                            <label htmlFor="admin-password">Password</label>
                            <input
                                id="admin-password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={isLoading}/>
                        </div>
                        {errorMessage && (
                            <p
                                role="alert"
                                style={{
                                    color: '#b42318',
                                    marginBottom: '1rem',
                                }}
                                >{errorMessage}</p>
                        )}
                        <button
                            type="submit"
                            className="button button-main button-big signin-btn"
                            disabled={isLoading}
                        >{isLoading ? 'Signing in...' : 'Login'}</button>
                    </form>
                </div>
            </div>
        </section>
    )
}