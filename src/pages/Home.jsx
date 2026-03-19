import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1 className="hero-title">Professional Cleaning Services</h1>
          <p className="hero-subtitle">Trusted, reliable cleaning for your home or business. Get a free quote today.</p>
          <div className="hero-cta">
            <Link to="/contact" className="btn btn-primary btn-lg">Book Now</Link>
            <Link to="/services" className="btn btn-secondary btn-lg">Our Services</Link>
          </div>
        </div>
      </section>

      <section id="services" className="section services">
        <div className="container">
          <h2 className="section-title">Our Services</h2>
          <p className="section-subtitle">We offer a range of cleaning solutions tailored to your needs.</p>
          <ul className="services-grid">
            <li className="service-card">Residential cleaning — placeholder</li>
            <li className="service-card">Commercial cleaning — placeholder</li>
            <li className="service-card">Deep cleaning — placeholder</li>
          </ul>
          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <Link className="btn btn-secondary" to="/services">View all services</Link>
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

      <section id="contact" className="section cta">
        <div className="container cta-inner">
          <h2 className="section-title">Get Your Free Quote</h2>
          <p className="cta-text">Tell us what you need and we'll get back to you shortly.</p>
          <form className="contact-form" action="#" method="post">
            <input type="text" name="name" placeholder="Name" required />
            <input type="email" name="email" placeholder="Email" required />
            <input type="tel" name="phone" placeholder="Phone" />
            <textarea name="message" placeholder="How can we help?" rows="4"></textarea>
            <button type="submit" className="btn btn-primary">Send Message</button>
          </form>
        </div>
      </section>
    </>
  )
}
