import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Settings() {
    /* Scrum 64: Phone number edit and database integration. 
        This adds a 10 digit phone validation, saving phone_number to "settings",
        and displaying success/error messages to user.*/
    const navigate = useNavigate()
    // Holds all editable settings fields, can update by using input id.
    const [formData, setFormData] = useState({
        email: '',
        phone: '',
        address: '',
        password: '',
        confirmPassword: '',
    })
    const [savedEmail, setSavedEmail] = useState('')
    const [savedPhone, setSavedPhone] = useState('')
    const [isEditingEmail, setIsEditingEmail] = useState(false)

    // Tracks save requests status: loading, error and or success. Displays above Save button.
    const [status, setStatus] = useState({ loading: true, error: '', success: '' })

    //Scrum 94: Controls the visibility of the save popup saying "Account Updated!"
    const [showSavePopup, setShowSavePopup] = useState(false)

    // This pulls the users email from Supabase Auth, along with saved phone_number from Settings table.
    // It prefills the form if values are found so user can edit current values.
    useEffect(() => {
        const loadSettings = async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                setStatus({
                    loading: false,
                    error: userError?.message || 'You must be signed in to change your settings.',
                    success: '',
                })
                return
            }

            setFormData((prev) => ({ ...prev, email: user.email || '' }))
            setSavedEmail(user.email || '')

            const { data, error: settingsError } = await supabase
                .from('settings')
                .select('phone_number, address')
                .eq('user_id', user.id)
                .maybeSingle()
            if (data) {
                setFormData((prev) => ({
                    ...prev,
                    phone: data.phone_number || '',
                    address: data.address || '',
                }))
                setSavedPhone(data.phone_number || '')
            }

            setStatus({ loading: false, error: settingsError?.message || '', success: '' })
        }
        loadSettings()
    }, [])

    /*Scrum 94: Function to show save popup saying "Account Updated!",
    popup has a 2 second delay,
    and then redirects to the /portal page
    */
    const handleSavePopup = () => {
        setShowSavePopup(true)
        setTimeout(() => {
            setShowSavePopup(false)
            navigate('/portal')
        }, 2000)
    }

    // Scrum 64 - SubTask 152: handlePhoneChange updates phone field as user types.
    const handlePhoneChange = (e) => {
        setFormData((prev) => ({ ...prev, phone: e.target.value }))
        setStatus((prev) => ({ ...prev, error: '', success: '' }))
    }

    // Scrum 62: opens and closes edit mode for the email field.
    const toggleEditMode = () => {
        if (isEditingEmail) {
            setFormData((prev) => ({ ...prev, email: savedEmail }))
        }

        setIsEditingEmail((prev) => !prev)
        setStatus((prev) => ({ ...prev, error: '', success: '' }))
    }

    // Scrum 62: updates the email value as the user types.
    const handleEmailChange = (e) => {
        setFormData((prev) => ({ ...prev, email: e.target.value }))
        setStatus((prev) => ({ ...prev, error: '', success: '' }))
    }

    // Scrum 62: checks that the new email is present and properly formatted.
    const validateEmail = () => {
        const normalizedEmail = formData.email.trim()

        if (!normalizedEmail) return 'Email is required.'
        if (!EMAIL_PATTERN.test(normalizedEmail)) return 'Please enter a valid email address.'

        return ''
    }

    // Scrum 62: updates the user's actual Supabase Auth login email.
    const saveEmailAddress = async () => {
        const normalizedEmail = formData.email.trim()
        const { data, error } = await supabase.auth.updateUser({ email: normalizedEmail })

        if (error) throw error

        setFormData((prev) => ({ ...prev, email: normalizedEmail }))
        setSavedEmail(normalizedEmail)
        setIsEditingEmail(false)

        return data.user?.email !== normalizedEmail
            ? `A confirmation link was sent to ${normalizedEmail}. Your login email will change after confirmation.`
            : 'Email address updated successfully.'
    }

    // Scrum 64: checks the typed value and if it meets standard US phone number.
    const validatePhoneNumber = () => {
        const digitsOnly = formData.phone.replace(/\D/g, '')
        if (digitsOnly.length !== 10) {
            setStatus({ loading: false, error: 'Enter a valid 10-digit US phone number.', success: '' })
            return null
        }
        return digitsOnly
    }

    // Scrum 64: submits valid phone number to Supabase table.
    const savePhoneNumber = async (digitsOnly) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            throw new Error('You must be signed in.')
        }
        const { error: settingsError } = await supabase
            .from('settings')
            .upsert(
                {
                    user_id: user.id,
                    phone_number: digitsOnly,
                    updated_at: new Date(),
                },
                { onConflict: 'user_id' }
            )

        if (settingsError) {
            throw settingsError
        }

        setFormData((prev) => ({ ...prev, phone: digitsOnly }))
        setSavedPhone(digitsOnly)
    }

    // Scrum 64: form submit handler skips the database entirely if the field is blank, otherwise runs it through validatePhoneNumber.
    const handleSave = async (e) => {
        e.preventDefault()

        const normalizedEmail = formData.email.trim()
        const emailChanged = isEditingEmail && normalizedEmail !== savedEmail
        const phoneChanged = formData.phone !== savedPhone

        if (!emailChanged && !phoneChanged) {
            setStatus({ loading: false, error: 'Make a change before saving.', success: '' })
            return
        }

        const emailError = emailChanged ? validateEmail() : ''
        if (emailError) {
            setStatus({ loading: false, error: emailError, success: '' })
            return
        }

        const digitsOnly = phoneChanged ? validatePhoneNumber() : ''
        if (phoneChanged && !digitsOnly) return

        setStatus({ loading: true, error: '', success: '' })

        try {
            const successMessages = []

            if (emailChanged) successMessages.push(await saveEmailAddress())
            if (phoneChanged) {
                await savePhoneNumber(digitsOnly)
                successMessages.push('Phone number updated.')
            }

            setStatus({ loading: false, error: '', success: successMessages.join(' ') })

            // Preserve Scrum 94's popup and redirect for phone-only saves.
            if (phoneChanged && !emailChanged) handleSavePopup()
        } catch (error) {
            setStatus({
                loading: false,
                error: error.message || 'Unable to update account settings. Please try again.',
                success: '',
            })
        }
    }
    return (

        //This section is for Scrum 115 to create boxes where users can change their settings
        //this includes their email address, phone number, business or residential address, and password
        <main className="section"> 
            <div className="container">
        
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <h2 className="section-title">Change User Settings</h2>
                    <p className="section-subtitle">Update your account information below</p>
                </div>
                
                {/* Scrum 94: Show popup box that states: "Account Updated!" */}
                {showSavePopup && (
                    <div className="popup-box">
                        <p className="popup-text">Account Updated!</p>
                    </div>
                )}

                {/* Use the format of the Sign-In form, but without floating box outline and adjust the size to center in the page */}
                <form className="signin-form" style={{ maxWidth: '500px', margin: '0 auto' }} onSubmit={handleSave} noValidate>

                    {/* Scrum 115: Create all the boxes to change settings */}
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="new-email@example.com"
                            value={formData.email}
                            onClick={() => {
                                if (!isEditingEmail) toggleEditMode()
                            }}
                            onChange={handleEmailChange}
                            readOnly={!isEditingEmail}
                            aria-invalid={Boolean(status.error)}
                            aria-describedby={status.error ? 'settings-error' : undefined}
                            style={status.error ? { borderColor: 'crimson' } : undefined}
                        />
                        {isEditingEmail && (
                            <button type="button" onClick={toggleEditMode} style={{ marginTop: 'var(--space-sm)' }}>
                                Cancel email edit
                            </button>
                        )}
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="phone">Change Phone Number</label>
                        <input
                            type="tel"
                            id="phone"
                            placeholder="(XXX) XXX-XXXX"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                        />
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

                    {/* Scrum 67: Save validates and persists changed account settings. */}
                    <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
                        <button type="submit" className="button button-main" disabled={status.loading}>
                            {status.loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                    
                    {/* Scrum 115: "Cancel" link button to redirect user back to customer portal page */}
                    <div className="signin-footer" style={{ marginTop: 'var(--space-md)' }}>
                        <Link to="/portal" style={{ textDecoration: 'underline', fontSize: '0.85rem' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
