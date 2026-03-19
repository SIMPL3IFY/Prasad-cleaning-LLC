import { Link } from 'react-router-dom'

import { SERVICES_LIST } from '../data/ServicesData';

export default function Home() {

  const featuredServices = SERVICES_LIST.filter(service => 
    service.name === "Residential Cleaning" || 
    service.name === "Commercial Cleaning" || 
    service.name === "Special Offers"
  );

  return (
    <>
      <section className="banner">
        <div className="container banner-content">
          <h1 className="page-title">Professional Cleaning Services</h1>
          <p className="page-subtitle">Trusted, reliable cleaning for your home or business. Get a free quote today.</p>
          <div className="banner-buttons">
            <Link to="/contact" className="buttonbutton-main button-big">Book Now</Link>
            <Link to="/services" className="buttonbutton-alt button-big">Our Services</Link>
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
            <Link className="buttonbutton-alt" to="/services">View all services</Link>
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
