import { Link } from 'react-router-dom'

import { SERVICES_LIST } from '../data/ServicesData';



import { useEffect, useState } from 'react'
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient'


export default function Home() {

  const [sbTest, setSbTest] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('services').select('*').limit(1)
        if (!mounted) return
        setSbTest({ loading: false, data, error })
        console.log('Supabase test:', { data, error })
      } catch (err) {
        if (!mounted) return
        setSbTest({ loading: false, data: null, error: err })
        console.error('Supabase test error:', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  const featuredServices = SERVICES_LIST.filter(service => 
    service.name === "Residential Cleaning" || 
    service.name === "Commercial Cleaning" || 
    service.name === "Special Offers"
  );

  return (
    <>
      <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 9999, maxWidth: 320 }}>
        <div style={{ padding: '8px 12px', borderRadius: 6, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}><strong>Supabase:</strong>{' '}{sbTest.loading ? 'checking...' : sbTest.error ? 'error' : 'connected'}</div>
          {!sbTest.loading && sbTest.error && (
            <div style={{ color: '#b00020', fontSize: 12 }}>
              {sbTest.error.message || JSON.stringify(sbTest.error)}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: '#444' }}>
            <div>URL: {supabaseUrl ? 'set' : 'missing'}</div>
            <div>Key: {supabaseKey ? 'set' : 'missing'}</div>
          </div>
        </div>
      </div>
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
          <form className="contact-form" action="#" method="post">
            <input type="text" name="name" placeholder="Name" required />
            <input type="email" name="email" placeholder="Email" required />
            <input type="tel" name="phone" placeholder="Phone" />
            <textarea name="message" placeholder="How can we help?" rows="4"></textarea>
            <button type="submit" className="buttonbutton-main">Send Message</button>
          </form>
        </div>
      </section>
    </>
  )
}
