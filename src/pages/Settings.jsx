import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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

    // Tracks save requests status: loading, error and or success. Displays above Save button.
    const [status, setStatus] = useState({ loading: false, error: '', success: '' })

    //Scrum 94: Controls the visibility of the save popup saying "Account Updated!"
    const [showSavePopup, setShowSavePopup] = useState(false)

    // This pulls the users email from Supabase Auth, along with saved phone_number from Settings table.
    // It prefills the form if values are found so user can edit current values.
    useEffect(() => {
        const loadSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setFormData((prev) => ({ ...prev, email: user.email || '' }))
            const { data } = await supabase
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
            }
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
    }

    // Scrum 63: handleAddressChange updates address field as user types.
    const handleAddressChange = (e) => {
        setFormData((prev) => ({ ...prev, address: e.target.value }))
    }

    // Scrum 64: checks the typed value and if it meets standard US phone number.
    const validatePhoneNumber = async () => {
        const digitsOnly = formData.phone.replace(/\D/g, '')
        if (digitsOnly.length !== 10) {
            setStatus({ loading: false, error: 'Enter a valid 10-digit US phone number.', success: '' })
            return
        }
        await savePhoneNumber(digitsOnly)
    }

    // Scrum 64: submits valid phone number to Supabase table.
    const savePhoneNumber = async (digitsOnly) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setStatus({ loading: false, error: 'You must be signed in.', success: '' })
            return
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
            setStatus({ loading: false, error: settingsError.message, success: '' })
            return
        }

        setStatus({ loading: false, error: '', success: 'Phone number updated.' })
        //navigate('/portal')
        //Scrum 94: Call the function to handle the save popup and redirect to /portal
        handleSavePopup()
    }

    // Scrum 64: form submit handler skips the database entirely if the field is blank, otherwise runs it through validatePhoneNumber.
    const handleSave = async (e) => {
        e.preventDefault()
        setStatus({ loading: true, error: '', success: '' })
        if (!formData.phone) {
            setStatus({ loading: false, error: '', success: '' })
            //navigate('/portal')
            //Scrum 94: Call the function to handle the save popup and redirect to /portal
            handleSavePopup()
            return
        }
        await validatePhoneNumber()
    }

    // Scrum 63: submits the address to the Supabase settings table.
    const saveAddress = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setStatus({ loading: false, error: 'You must be signed in.', success: '' })
            return
        }
        const { error: settingsError } = await supabase
            .from('settings')
            .upsert(
                {
                    user_id: user.id,
                    address: formData.address.trim(),
                    updated_at: new Date(),
                },
                { onConflict: 'user_id' }
            )

        if (settingsError) {
            setStatus({ loading: false, error: settingsError.message, success: '' })
            return
        }

        setStatus({ loading: false, error: '', success: 'Address updated.' })
        handleSavePopup()
    }

    // Scrum 63: form submit handler skips the database if the address is blank, otherwise saves it.
    const handleAddressSave = async (e) => {
        e.preventDefault()
        setStatus({ loading: true, error: '', success: '' })
        if (!formData.address.trim()) {
            setStatus({ loading: false, error: '', success: '' })
            handleSavePopup()
            return
        }
        await saveAddress()
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
                {/* Scrum 63: submitting the form saves the address to the database */}
                <form className="signin-form" style={{ maxWidth: '500px', margin: '0 auto' }} onSubmit={handleAddressSave}>

                    {/* Scrum 115: Create all the boxes to change settings */}
                    <div className="form-group">
                        <label htmlFor="email">Change Email Address</label>
                        <input type="email" id="email" placeholder="new-email@example.com" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="phone">Change Phone Number</label>
                        <input type="tel" id="phone" placeholder="(XXX) XXX-XXXX" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="address">Change Business or Residential Address</label>
                        {/* Scrum 63: controlled input so the typed address can be saved */}
                        <input type="text"
                        id="address"
                        placeholder="123 Main St, City, State, Zip Code"
                        value={formData.address}
                        onChange={handleAddressChange} />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Change Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Re-Enter New Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>
                    
                    {/* Button for user to change settings
                         Scrum 115, redirects to customer portal page but
                         in a later Scrum, will update database*/}
                    {/* Scrum 63: show database error above the Save button */}
                    {status.error && (
                        <p style={{ color: 'crimson', textAlign: 'center', fontSize: '0.85rem' }}>{status.error}</p>
                    )}

                    {/* Scrum 63: submit button so the form saves the address to the database */}
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
