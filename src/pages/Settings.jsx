import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Settings() {
    const [email, setEmail] = useState('')
    const [savedEmail, setSavedEmail] = useState('')
    const [isEditingEmail, setIsEditingEmail] = useState(false)
    const [status, setStatus] = useState({ loading: true, error: '', success: '' })

    useEffect(() => {
        let isMounted = true

        const loadEmail = async () => {
            const { data: { user }, error } = await supabase.auth.getUser()

            if (!isMounted) return

            if (error || !user) {
                setStatus({
                    loading: false,
                    error: error?.message || 'You must be signed in to change your email.',
                    success: '',
                })
                return
            }

            setEmail(user.email || '')
            setSavedEmail(user.email || '')
            setStatus({ loading: false, error: '', success: '' })
        }

        loadEmail()

        return () => {
            isMounted = false
        }
    }, [])

    // Scrum 62: clicking the email field opens edit mode. Closing it discards unsaved changes.
    const toggleEditMode = () => {
        if (isEditingEmail) {
            setEmail(savedEmail)
        }

        setIsEditingEmail((current) => !current)
        setStatus((current) => ({ ...current, error: '', success: '' }))
    }

    // Scrum 62: keep the controlled email field in sync and clear stale validation messages.
    const handleEmailChange = (e) => {
        setEmail(e.target.value)
        setStatus((current) => ({ ...current, error: '', success: '' }))
    }

    const validateEmail = () => {
        const normalizedEmail = email.trim()

        if (!normalizedEmail) {
            return 'Email is required.'
        }

        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return 'Please enter a valid email address.'
        }

        if (normalizedEmail === savedEmail) {
            return 'Enter a different email address before saving.'
        }

        return ''
    }

    // Scrum 62: update the user's real Supabase Auth login email.
    const saveEmailAddress = async () => {
        const normalizedEmail = email.trim()
        const { data, error } = await supabase.auth.updateUser({ email: normalizedEmail })

        if (error) throw error

        setEmail(normalizedEmail)
        setSavedEmail(normalizedEmail)
        setIsEditingEmail(false)

        const confirmationRequired = data.user?.email !== normalizedEmail
        return confirmationRequired
            ? `A confirmation link was sent to ${normalizedEmail}. Your login email will change after confirmation.`
            : 'Email address updated successfully.'
    }

    // Scrum 67: validate and persist the settings changed on this page.
    const handleSave = async (e) => {
        e.preventDefault()

        if (!isEditingEmail) {
            setStatus({ loading: false, error: 'Click the email field before making a change.', success: '' })
            return
        }

        const validationError = validateEmail()
        if (validationError) {
            setStatus({ loading: false, error: validationError, success: '' })
            return
        }

        setStatus({ loading: true, error: '', success: '' })

        try {
            const success = await saveEmailAddress()
            setStatus({ loading: false, error: '', success })
        } catch (error) {
            setStatus({
                loading: false,
                error: error.message || 'Unable to update your email. Please try again.',
                success: '',
            })
        }
    }

    return (
        <main className="section">
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <h2 className="section-title">Change User Settings</h2>
                    <p className="section-subtitle">Update your account information below</p>
                </div>

                <form
                    className="signin-form"
                    style={{ maxWidth: '500px', margin: '0 auto' }}
                    onSubmit={handleSave}
                    noValidate
                >
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onClick={() => {
                                if (!isEditingEmail) toggleEditMode()
                            }}
                            onChange={handleEmailChange}
                            readOnly={!isEditingEmail}
                            placeholder="new-email@example.com"
                            aria-invalid={Boolean(status.error)}
                            aria-describedby={status.error ? 'settings-error' : undefined}
                            style={status.error ? { borderColor: 'crimson' } : undefined}
                        />
                        {isEditingEmail && (
                            <button
                                type="button"
                                onClick={toggleEditMode}
                                style={{ marginTop: 'var(--space-sm)' }}
                            >
                                Cancel email edit
                            </button>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Change Phone Number</label>
                        <input type="tel" id="phone" placeholder="(XXX) XXX-XXXX" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">Change Business or Residential Address</label>
                        <input type="text" id="address" placeholder="123 Main St, City, State, Zip Code" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Change Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Re-Enter New Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>

                    {status.error && (
                        <p id="settings-error" role="alert" style={{ color: 'crimson', textAlign: 'center', fontSize: '0.85rem' }}>
                            {status.error}
                        </p>
                    )}
                    {status.success && (
                        <p role="status" style={{ color: 'green', textAlign: 'center', fontSize: '0.85rem' }}>
                            {status.success}
                        </p>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
                        <button type="submit" className="button button-main" disabled={status.loading}>
                            {status.loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>

                    <div className="signin-footer" style={{ marginTop: 'var(--space-md)' }}>
                        <Link to="/portal" style={{ textDecoration: 'underline', fontSize: '0.85rem' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    )
}
