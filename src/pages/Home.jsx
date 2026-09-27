import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

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

  const serviceDescriptions = {
    'Residential Cleaning': 'Routine cleaning for living spaces, bedrooms, kitchens, and bathrooms with dependable attention to detail.',
    'Commercial Cleaning': 'Professional upkeep for offices and shared spaces to maintain a clean, welcoming atmosphere.',
    'Special Offers': 'Flexible cleaning bundles and seasonal promos designed to fit your schedule and budget.'
  }

  // Scrum 15: Quote form field values
  const [quoteForm, setQuoteForm] = useState(INITIAL_QUOTE_FORM)
  // Scrum 15: Tracks submit status/messages shown near the button
  const [quoteStatus, setQuoteStatus] = useState({ loading: false, error: '', success: '' })
  const [featuredReviews, setFeaturedReviews] = useState([])
  const [flippedServices, setFlippedServices] = useState({})

  const toggleServiceCard = (serviceName) => {
    setFlippedServices((prev) => ({
      ...prev,
      [serviceName]: !prev[serviceName]
    }))
  }

  useEffect(() => {
    const fetchFeaturedReviews = async () => {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('id, customer_name, review, rating')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) {
        console.error('Error fetching featured reviews:', error)
        setFeaturedReviews([])
        return
      }

      setFeaturedReviews(data || [])
    }

    fetchFeaturedReviews()
  }, [])

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

      {/* SCRUM 141: Service cards flip to reveal a brief description on click */}
      <section id="services" className="section services">
        <div className="container">
          <h2 className="section-title">Our Services</h2>
          <p className="section-subtitle">We offer a range of cleaning solutions tailored to your needs.</p>
          <ul className="services-grid">
            {featuredServices.map((service, index) => (
              <li key={index} className="service-card-wrapper">
                <button
                  type="button"
                  className={`service-card ${flippedServices[service.name] ? 'is-flipped' : ''}`}
                  onClick={() => toggleServiceCard(service.name)}
                  aria-label={`Toggle details for ${service.name}`}
                  aria-pressed={!!flippedServices[service.name]}
                >
                  <div className="service-card-inner">
                    <div className="service-card-face service-card-front">
                      <img src={service.img} alt={service.name} className="service-card-img" />
                      <h3 className="service-card-title">{service.name}</h3>
                    </div>
                    <div className="service-card-face service-card-back">
                      <h3>{service.name}</h3>
                      <p>{serviceDescriptions[service.name] || 'Customized cleaning solutions designed around your needs.'}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <Link className="button button-alt" to="/services">View all services</Link>
          </div>
        </div>
      </section>

      {/* SCRUM 141: Why Choose Us section is wrapped in a subtle card with a link to the About page */}
      <section id="about" className="section about">
        <div className="container about-inner">
          <div className="about-content about-card-box">
            <h2 className="section-title">Why Choose Us</h2>
            <p>At Prasad’s Cleaning Service, we take pride in delivering reliable, high-quality cleaning solutions tailored to meet the needs of homes and businesses alike. With a strong commitment to excellence and attention to detail, our team works diligently to create clean, healthy, and welcoming environments for every client we serve.</p>
            <div className="about-link-row">
              <Link to="/about" className="about-link">Learn more about us</Link>
            </div>
          </div>
          <div className="about-media" aria-hidden="true"></div>
        </div>
      </section>

      {/* SCRUM 140: Landing page includes customer testimonials for social proof */}
      <section id="testimonials" className="section testimonials">
        <div className="container">
          <h2 className="section-title">What Our Customers Say</h2>
          <ul className="testimonials-list">
            {featuredReviews.length > 0 ? (
              featuredReviews.map((review) => (
                <li key={review.id} className="testimonial-card">
                  <h3>{review.customer_name || 'Verified Customer'}</h3>
                  <p>{review.review}</p>
                  <span>{'⭐'.repeat(review.rating || 0)}</span>
                </li>
              ))
            ) : (
              <li className="testimonial-card">No testimonials available at this time.</li>
            )}
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
