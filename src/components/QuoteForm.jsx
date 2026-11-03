import { useState } from 'react'

import AddressFields from './AddressFields'
import AddressSuggestion from './AddressSuggestion'
import { addressError, checkAddress, EMPTY_ADDRESS, formatAddress, INVALID_MESSAGE } from '../lib/addressValidation'
import { supabase } from '../lib/supabaseClient'

// SCRUM-175: Property types a customer can pick from
const PROPERTY_TYPES = ['Residential', 'Commercial']

// SCRUM-175: Service types a customer can pick from
const SERVICE_TYPES = ['Standard Cleaning', 'Deep Cleaning', 'Move-in / Move-Out', 'Custom Requests']

// Scrum 15: Default/blank state for the quote form
// SCRUM-239: address is split into street / unit / city / state / zip so it can be verified
const INITIAL_QUOTE_FORM = {
  customerName: '',
  email: '',
  phone: '',
  address: EMPTY_ADDRESS,
  propertyType: '',
  serviceType: '',
  message: '',
}

const SUCCESS_MESSAGE = "Thanks! We've received your quote request and will be in touch shortly."

// SCRUM-239: Hides the honeypot field from people (bots still see and fill it)
const HONEYPOT_STYLE = { position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }

// SCRUM-175: Shared quote form used on both the landing page and the Contact page
export default function QuoteForm() {
  // Scrum 15: Quote form field values
  const [quoteForm, setQuoteForm] = useState(INITIAL_QUOTE_FORM)
  // Scrum 15: Tracks submit status/messages shown near the button
  // SCRUM-239: checking = waiting on the address check (button reads "Verifying address...")
  const [quoteStatus, setQuoteStatus] = useState({ loading: false, checking: false, error: '', success: '' })
  // SCRUM-239: "Did you mean ...?" result the customer still has to answer
  const [suggestion, setSuggestion] = useState(null)
  // SCRUM-239: Honeypot value; only bots fill it in
  const [honeypot, setHoneypot] = useState('')

  // SCRUM-175: Submit stays disabled until every field has a value
  // SCRUM-239: the apartment/unit field is optional
  const { address, ...otherFields } = quoteForm
  const allFieldsFilled = Object.values(otherFields).every((value) => value.trim() !== '')
    && [address.street, address.city, address.state, address.zip].every((value) => value.trim() !== '')
  const busy = quoteStatus.loading || quoteStatus.checking

  // Scrum 15: Updates quote form state as the user types/selects
  const handleQuoteChange = (e) => {
    const { name, value } = e.target
    setQuoteForm((prev) => ({ ...prev, [name]: value }))
  }

  // SCRUM-239: Editing the address answers any open suggestion, so close it
  const handleAddressChange = (parts) => {
    setQuoteForm((prev) => ({ ...prev, address: parts }))
    setSuggestion(null)
  }

  // Scrum 15: Checks required fields and email/phone formatting before saving
  const validateQuoteForm = (form) => {
    if (!form.customerName.trim()) return 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.'
    if (form.phone.replace(/\D/g, '').length !== 10) return 'Please enter a valid 10-digit phone number.'
    const addressProblem = addressError(form.address) // SCRUM-239: street, city, state and ZIP
    if (addressProblem) return addressProblem
    if (!form.propertyType) return 'Please select a property type.'
    if (!form.serviceType) return 'Please select a service type.'
    if (!form.message.trim()) return 'Please tell us how we can help.'
    return ''
  }

  // Scrum 15: Inserts the quote request into the Supabase "quotes" table.
  // SCRUM-175: appointment_date/appointment_time are left null for the admin to fill in.
  const saveQuote = async (form, savedAddress) => {
    const { error } = await supabase.from('quotes').insert({
      customer_name: form.customerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: savedAddress,
      property: form.propertyType,
      service: form.serviceType,
      message: form.message.trim(),
      status: 'pending',
    })
    return error
  }

  // Scrum 15: Saves, then resets the form on success
  const finishQuote = async (form, savedAddress) => {
    setSuggestion(null)
    setQuoteStatus({ loading: true, checking: false, error: '', success: '' })
    const error = await saveQuote(form, savedAddress)
    if (error) {
      setQuoteStatus({ loading: false, checking: false, error: 'Something went wrong submitting your quote. Please try again.', success: '' })
      return
    }
    setQuoteForm(INITIAL_QUOTE_FORM)
    setQuoteStatus({ loading: false, checking: false, error: '', success: SUCCESS_MESSAGE })
  }

  const showError = (error) => setQuoteStatus({ loading: false, checking: false, error, success: '' })

  // Scrum 15: Validates, then saves
  // SCRUM-239: ...after checking that the address is real
  const handleQuoteSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    const validationError = validateQuoteForm(quoteForm)
    if (validationError) {
      showError(validationError)
      return
    }
    // Bot filled the hidden field: act like it worked, but save nothing and spend no lookup
    if (honeypot) {
      setQuoteForm(INITIAL_QUOTE_FORM)
      setQuoteStatus({ loading: false, checking: false, error: '', success: SUCCESS_MESSAGE })
      return
    }
    setSuggestion(null)
    setQuoteStatus({ loading: false, checking: true, error: '', success: '' })

    const { result, outage, error } = await checkAddress(quoteForm.address, honeypot)
    // Refused (bad input, too many tries): show why and don't save
    if (error) {
      showError(error)
      return
    }
    // Address check is down: never block the customer, save what they typed
    if (outage || result.status === 'unavailable') {
      await finishQuote(quoteForm, formatAddress(quoteForm.address))
      return
    }
    // Not a real address (or only found roughly): block with the standard message
    if (result.status === 'invalid') {
      showError(INVALID_MESSAGE)
      return
    }
    // Found, but spelled differently: the customer decides
    if (result.status === 'suggestion') {
      setSuggestion(result)
      setQuoteStatus({ loading: false, checking: false, error: '', success: '' })
      return
    }
    await finishQuote(quoteForm, result.standardized || formatAddress(quoteForm.address))
  }

  // SCRUM-239: Customer accepted the suggested address: fill it in, then submit it.
  // It is already the verified address, so it's saved without spending a second lookup.
  const handleAcceptSuggestion = async () => {
    const corrected = { ...quoteForm, address: { ...EMPTY_ADDRESS, ...suggestion.parts } }
    setQuoteForm(corrected)
    await finishQuote(corrected, suggestion.standardized)
  }

  return (
    <form className="contact-form" onSubmit={handleQuoteSubmit}>
      <input type="text" name="customerName" placeholder="Name" value={quoteForm.customerName} onChange={handleQuoteChange} disabled={busy} required />
      <input type="email" name="email" placeholder="Email" value={quoteForm.email} onChange={handleQuoteChange} disabled={busy} required />
      <input type="tel" name="phone" placeholder="Phone" value={quoteForm.phone} onChange={handleQuoteChange} disabled={busy} required />
      <AddressFields value={quoteForm.address} onChange={handleAddressChange} idPrefix="quote-address" disabled={busy} />
      {/* SCRUM-239: Honeypot. Hidden from people, so only bots fill it in */}
      <div style={HONEYPOT_STYLE} aria-hidden="true">
        <label htmlFor="quote-website">Website</label>
        <input type="text" id="quote-website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      <select name="propertyType" value={quoteForm.propertyType} onChange={handleQuoteChange} disabled={busy} required>
        <option value="" disabled>Select property type</option>
        {PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select name="serviceType" value={quoteForm.serviceType} onChange={handleQuoteChange} disabled={busy} required>
        <option value="" disabled>Select service type</option>
        {SERVICE_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <textarea name="message" placeholder="How can we help?" rows="4" value={quoteForm.message} onChange={handleQuoteChange} disabled={busy} required></textarea>

      {/* SCRUM-239: "Did you mean ...?" */}
      <AddressSuggestion
        suggestion={suggestion}
        loading={busy}
        onAccept={handleAcceptSuggestion}
        onEdit={() => setSuggestion(null)}
      />
      {quoteStatus.error && <p style={{ color: '#dc3545', margin: 0 }}>{quoteStatus.error}</p>}
      {quoteStatus.success && <p style={{ color: '#155724', margin: 0 }}>{quoteStatus.success}</p>}

      <button type="submit" className="button button-main" disabled={busy || !allFieldsFilled}>
        {quoteStatus.checking ? 'Verifying address...' : quoteStatus.loading ? 'Submitting...' : 'Get My Free Quote'}
      </button>
    </form>
  )
}
