import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './AdminQuoteForm.css'

const INITIAL_FORM = {
    customer_name: '', email: '', phone: '', address: '', property: '', service: '',
    appointment_date: '', appointment_time: '', message: ''
}
const PROPERTY_TYPES = ['Residential', 'Commercial']
const SERVICES = ['Standard Cleaning', 'Deep Cleaning', 'Move-in / Move-Out', 'Custom Requests']

// SCRUM-241: Admin-only entry point; uses the existing quote columns and pending workflow.
export default function AdminQuoteForm({ onClose, onCreated }) {
    const [form, setForm] = useState(INITIAL_FORM)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const inFlight = useRef(false)
    const update = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }))

    const submit = async event => {
        event.preventDefault()
        if (inFlight.current) return
        setError('')
        const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
        if (!payload.customer_name || !payload.address || !payload.message) {
            setError('Enter a customer name, address, and message.'); return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            setError('Enter a valid email address.'); return
        }
        if (payload.phone.replace(/\D/g, '').length !== 10) {
            setError('Enter a valid 10-digit phone number.'); return
        }
        if (!PROPERTY_TYPES.includes(payload.property) || !SERVICES.includes(payload.service)) {
            setError('Select a property type and service.'); return
        }
        if (Boolean(payload.appointment_date) !== Boolean(payload.appointment_time)) {
            setError('Enter both an appointment date and time, or leave both blank.'); return
        }
        inFlight.current = true
        setBusy(true)
        try {
            // Check the signed-in admin again before writing; do not accept demo-only access.
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) throw new Error('Sign in as an administrator to create a quote.')
            const { data: profile, error: profileError } = await supabase.from('profiles')
                .select('is_admin').eq('id', user.id).maybeSingle()
            if (profileError || !profile?.is_admin) throw new Error('Administrator access required.')
            const { error: saveError } = await supabase.from('quotes').insert({
                ...payload,
                appointment_date: payload.appointment_date || null,
                appointment_time: payload.appointment_time || null,
                status: 'pending'
            })
            if (saveError) throw saveError
        } catch (failure) {
            setError(failure.message || 'Unable to create the quote. Please try again.')
            return
        } finally {
            inFlight.current = false
            setBusy(false)
        }
        onCreated()
    }

    return (
        <div className="admin-modal">
            <section role="dialog" aria-modal="true" aria-labelledby="create-quote-title"
                className="admin-modal-box admin-modal-box--wide admin-modal-box--scroll">
                <h3 id="create-quote-title" className="admin-modal-title">Create Quote</h3>
                <p className="admin-modal-text">Add a quote directly. It will appear in Manage Quotes as pending.</p>
                <form onSubmit={submit}>
                    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                        <div className="admin-field-grid admin-create-quote-grid">
                            {[
                                ['customer_name', 'Customer name', 'text'], ['email', 'Email', 'email'],
                                ['phone', 'Phone', 'tel'], ['address', 'Address', 'text'],
                                ['appointment_date', 'Appointment date (optional)', 'date'],
                                ['appointment_time', 'Appointment time (optional, Pacific time)', 'time']
                            ].map(([name, label, type]) => (
                                <div className="admin-field" key={name}>
                                    <label className="admin-label" htmlFor={`create-quote-${name}`}>{label}</label>
                                    <input autoFocus={name === 'customer_name'} id={`create-quote-${name}`} name={name}
                                        className="admin-input" type={type} value={form[name]} onChange={update}
                                        required={!name.startsWith('appointment_')} />
                                </div>
                            ))}
                            {[
                                ['property', 'Property type', PROPERTY_TYPES], ['service', 'Service', SERVICES]
                            ].map(([name, label, options]) => (
                                <div className="admin-field" key={name}>
                                    <label className="admin-label" htmlFor={`create-quote-${name}`}>{label}</label>
                                    <select id={`create-quote-${name}`} className="admin-input" name={name}
                                        value={form[name]} onChange={update} required>
                                        <option value="">Select {label.toLowerCase()}</option>
                                        {options.map(option => <option key={option}>{option}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="admin-field">
                            <label className="admin-label" htmlFor="create-quote-message">Message</label>
                            <textarea id="create-quote-message" className="admin-textarea" name="message"
                                value={form.message} onChange={update} rows={3} required />
                        </div>
                        {error && <p role="alert" className="admin-note admin-note--danger">{error}</p>}
                        <div className="admin-btn-row">
                            <button type="submit" className="admin-btn admin-btn--primary">{busy ? 'Creating…' : 'Save Quote'}</button>
                            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>Cancel</button>
                        </div>
                    </fieldset>
                </form>
            </section>
        </div>
    )
}
