import { Link } from 'react-router-dom'
import { useState } from 'react'

import { SERVICES_LIST } from '../data/ServicesData';
import { supabase } from '../lib/supabaseClient'

// Scrum 15: Default/blank state for the quote form
const INITIAL_QUOTE_FORM = {
  customerName: '',
  email: '',
  phone: '',
  message: '',
}

export default function Home() {

  const featuredServices = SERVICES_LIST.filter(service =>
    service.name === "Residential Cleaning" ||
    service.name === "Commercial Cleaning" ||
    service.name === "Special Offers"
  );

  // Scrum 15: Quote form field values
  const [quoteForm, setQuoteForm] = useState(INITIAL_QUOTE_FORM)
  // Scrum 15: Tracks submit status/messages shown near the button
  const [quoteStatus, setQuoteStatus] = useState({ loading: false, error: '', success: '' })

  // Scrum 15: Updates quote form state as the user types/selects
  const handleQuoteChange = (e) => {
    const { name, value } = e.target
    setQuoteForm((prev) => ({ ...prev, [name]: value }))
  }

  // Scrum 15: Checks required fields and email/phone formatting before saving
  // (customer_name, email, phone, and message are all NOT NULL in the "quotes" table)
  const validateQuoteForm = (form) => {
    if (!form.customerName.trim()) return 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.'
    if (form.phone.replace(/\D/g, '').length !== 10) return 'Please enter a valid 10-digit phone number.'
    if (!form.message.trim()) return 'Please tell us how we can help.'
    return ''
  }

  // Scrum 15: Inserts the quote request into the Supabase "quotes" table.
  // service/property/appointment_date/appointment_time/address aren't collected on this
  // form, but are nullable columns, so they're left for the admin to fill in later.
  const saveQuote = async (form) => {
    const { error } = await supabase.from('quotes').insert({
      customer_name: form.customerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
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
    <>
      <section className="banner">
        <div className="container banner-content">
          <h1 className="page-title">Professional Cleaning Services</h1>
          <p className="page-subtitle">Trusted, reliable cleaning for your home or business. Get a free quote today.</p>
          <div className="banner-buttons">
            <Link to="/contact" className="button button-main button-big">Book Now</Link>
            <Link to="/services" className="button button-alt button-big">Our Services</Link>
          </div>
        </div>
      </section>

      <section id="services" className="section services">
        <div className="container">
          <h2 className="section-title">Our Services</h2>
          <p className="section-subtitle">We offer a range of cleaning solutions tailored to your needs.</p>
          <ul className="services-grid">
            {featuredServices.map((service, index) => (
              <li key={index} className="service-card">
                <img src={service.img} alt={service.name} className="service-card-img" />
                <h3 className="service-card-title">{service.name}</h3>
              </li>
            ))}
          </ul>
          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <Link className="button button-alt" to="/services">View all services</Link>
          </div>
        </div>
      </section>

      <section id="about" className="section about">
        <div className="container about-inner">
          <div className="about-content">
            <h2 className="section-title">Why Choose Us</h2>
            <p>About / value proposition copy — replace with content from Figma.</p>
          </div>
          <div className="about-media" aria-hidden="true"></div>
        </div>
      </section>

      <section id="testimonials" className="section testimonials">
        <div className="container">
          <h2 className="section-title">What Our Customers Say</h2>
          <ul className="testimonials-list">
            <li className="testimonial-card">Testimonial 1 — placeholder</li>
            <li className="testimonial-card">Testimonial 2 — placeholder</li>
            <li className="testimonial-card">Testimonial 3 — placeholder</li>
          </ul>
        </div>
      </section>

      <section id="contact" className="section action-section">
        <div className="container action-section-content">
          <h2 className="section-title">Get Your Free Quote</h2>
          <p className="action-text">Tell us what you need and we'll get back to you shortly.</p>
          <form className="contact-form" onSubmit={handleQuoteSubmit}>
            <input type="text" name="customerName" placeholder="Name" value={quoteForm.customerName} onChange={handleQuoteChange} required />
            <input type="email" name="email" placeholder="Email" value={quoteForm.email} onChange={handleQuoteChange} required />
            <input type="tel" name="phone" placeholder="Phone" value={quoteForm.phone} onChange={handleQuoteChange} required />
            <textarea name="message" placeholder="How can we help?" rows="4" value={quoteForm.message} onChange={handleQuoteChange} required></textarea>

            {quoteStatus.error && <p style={{ color: '#dc3545', margin: 0 }}>{quoteStatus.error}</p>}
            {quoteStatus.success && <p style={{ color: '#155724', margin: 0 }}>{quoteStatus.success}</p>}

            <button type="submit" className="button button-main" disabled={quoteStatus.loading}>
              {quoteStatus.loading ? 'Submitting...' : 'Get My Free Quote'}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
