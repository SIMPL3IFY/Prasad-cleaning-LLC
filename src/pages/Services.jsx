import { Link } from 'react-router-dom'

export default function Services() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="hero-title" style={{ textAlign: 'center' }}>Services</h1>
        <p className="section-subtitle">Choose the cleaning service that fits your home or business.</p>

        <ul className="services-grid">
          <li className="service-card">Residential cleaning — placeholder</li>
          <li className="service-card">Commercial cleaning — placeholder</li>
          <li className="service-card">Move-in / move-out — placeholder</li>
          <li className="service-card">Deep cleaning — placeholder</li>
          <li className="service-card">Recurring maintenance — placeholder</li>
          <li className="service-card">Custom requests — placeholder</li>
        </ul>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
          <Link className="btn btn-primary" to="/contact">Request a quote</Link>
        </div>
      </div>
    </section>
  )
}
