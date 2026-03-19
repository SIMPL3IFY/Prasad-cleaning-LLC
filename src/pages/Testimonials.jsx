import { Link } from 'react-router-dom'

export default function Testimonials() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="hero-title" style={{ textAlign: 'center' }}>Customer Reviews</h1>
        <p className="section-subtitle">Real feedback from customers we've helped.</p>

        <ul className="testimonials-list" style={{ paddingTop: 'var(--space-2xl)' }}>
          <li className="testimonial-card">Testimonial 1 — placeholder</li>
          <li className="testimonial-card">Testimonial 2 — placeholder</li>
          <li className="testimonial-card">Testimonial 3 — placeholder</li>
          <li className="testimonial-card">Testimonial 4 — placeholder</li>
          <li className="testimonial-card">Testimonial 5 — placeholder</li>
          <li className="testimonial-card">Testimonial 6 — placeholder</li>
        </ul>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
          <Link className="btn btn-primary" to="/contact">Book a cleaning</Link>
        </div>
      </div>
    </section>
  )
}
