import { Link } from 'react-router-dom'

import { SERVICES_LIST } from '../data/ServicesData';

export default function Services() {

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>Services</h1>
        <p className="section-subtitle">Choose the cleaning service that fits your home or business.</p>

        <ul className="services-grid">
        {SERVICES_LIST.map((service, index) => (
            <li key={index} className="service-card">
              <img src={service.img} alt={service.name} className="service-card-img" />
              <h3 className="service-card-title">{service.name}</h3>
            </li>
          ))}
        </ul>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
          <Link className="button button-main" to="/contact">Request a quote</Link>
        </div>
      </div>
    </section>
  )
}
