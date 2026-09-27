import { useState } from 'react'

import { supabase } from '../lib/supabaseClient'

// SCRUM-175: Property types a customer can pick from
const PROPERTY_TYPES = ['Residential', 'Commercial']

// SCRUM-175: Service types a customer can pick from
const SERVICE_TYPES = ['Standard Cleaning', 'Deep Cleaning', 'Move-in / Move-Out', 'Custom Requests']

// Scrum 15: Default/blank state for the quote form
const INITIAL_QUOTE_FORM = {
  customerName: '',
  email: '',
  phone: '',
  address: '',
  propertyType: '',
  serviceType: '',
  message: '',
}

// SCRUM-175: Shared quote form used on both the landing page and the Contact page
export default function QuoteForm() {
  // Scrum 15: Quote form field values
  const [quoteForm, setQuoteForm] = useState(INITIAL_QUOTE_FORM)
  // Scrum 15: Tracks submit status/messages shown near the button
  const [quoteStatus, setQuoteStatus] = useState({ loading: false, error: '', success: '' })

  // SCRUM-175: Submit stays disabled until every field has a value
  const allFieldsFilled = Object.values(quoteForm).every((value) => value.trim() !== '')

  // Scrum 15: Updates quote form state as the user types/selects
  const handleQuoteChange = (e) => {
    const { name, value } = e.target
    setQuoteForm((prev) => ({ ...prev, [name]: value }))
  }

  // Scrum 15: Checks required fields and email/phone formatting before saving
  const validateQuoteForm = (form) => {
    if (!form.customerName.trim()) return 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.'
    if (form.phone.replace(/\D/g, '').length !== 10) return 'Please enter a valid 10-digit phone number.'
    if (!form.address.trim()) return 'Please enter your address.'
    if (!form.propertyType) return 'Please select a property type.'
    if (!form.serviceType) return 'Please select a service type.'
    if (!form.message.trim()) return 'Please tell us how we can help.'
    return ''
  }

  // Scrum 15: Inserts the quote request into the Supabase "quotes" table.
  // SCRUM-175: appointment_date/appointment_time are left null for the admin to fill in.
  const saveQuote = async (form) => {
    const { error } = await supabase.from('quotes').insert({
      customer_name: form.customerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      property: form.propertyType,
      service: form.serviceType,
      message: form.message.trim(),
      status: 'pending',
    })
    return error
  }

  // Scrum 15: Validates, saves, then resets the form on success
  const handleQuoteSubmit = async (e) => {
    e.preventDefault()
    const validationError = validateQuoteForm(quoteForm)
    if (validationError) {
      setQuoteStatus({ loading: false, error: validationError, success: '' })
      return
    }
    setQuoteStatus({ loading: true, error: '', success: '' })
    const error = await saveQuote(quoteForm)
    if (error) {
      setQuoteStatus({ loading: false, error: 'Something went wrong submitting your quote. Please try again.', success: '' })
      return
    }
    setQuoteForm(INITIAL_QUOTE_FORM)
    setQuoteStatus({ loading: false, error: '', success: "Thanks! We've received your quote request and will be in touch shortly." })
  }

  return (
    <form className="contact-form" onSubmit={handleQuoteSubmit}>
      <input type="text" name="customerName" placeholder="Name" value={quoteForm.customerName} onChange={handleQuoteChange} required />
      <input type="email" name="email" placeholder="Email" value={quoteForm.email} onChange={handleQuoteChange} required />
      <input type="tel" name="phone" placeholder="Phone" value={quoteForm.phone} onChange={handleQuoteChange} required />
      <input type="text" name="address" placeholder="Address" value={quoteForm.address} onChange={handleQuoteChange} required />
      <select name="propertyType" value={quoteForm.propertyType} onChange={handleQuoteChange} required>
        <option value="" disabled>Select property type</option>
        {PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select name="serviceType" value={quoteForm.serviceType} onChange={handleQuoteChange} required>
        <option value="" disabled>Select service type</option>
        {SERVICE_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <textarea name="message" placeholder="How can we help?" rows="4" value={quoteForm.message} onChange={handleQuoteChange} required></textarea>

      {quoteStatus.error && <p style={{ color: '#dc3545', margin: 0 }}>{quoteStatus.error}</p>}
      {quoteStatus.success && <p style={{ color: '#155724', margin: 0 }}>{quoteStatus.success}</p>}

      <button type="submit" className="button button-main" disabled={quoteStatus.loading || !allFieldsFilled}>
        {quoteStatus.loading ? 'Submitting...' : 'Get My Free Quote'}
      </button>
    </form>
  )
}
