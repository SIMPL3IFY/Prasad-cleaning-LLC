import { Link } from 'react-router-dom'

import { useServices } from '../hooks/useServices';

export default function Services() {
  const { services, loading } = useServices()

  return (

    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>Services</h1>
        <p className="section-subtitle">Choose the cleaning service that fits your home or business.</p>

        {loading && <p role="status" style={{ textAlign: 'center' }}>Loading services...</p>}

    <ul className="services-grid">
    {services.map((service) => (
        <li key={service.id} className="service-card">

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
