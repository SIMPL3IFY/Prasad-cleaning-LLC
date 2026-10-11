import { Link } from 'react-router-dom'
import { useState } from 'react'

import { useServices } from '../hooks/useServices';

export default function Services() {
  // SCRUM-201: Tracks which service cards are flipped
  const [flippedServices, setFlippedServices] = useState({})

  const toggleServiceCard = (serviceName) => {
    setFlippedServices((prev) => ({
      ...prev,
      [serviceName]: !prev[serviceName]
    }))
  }

  return (
    <div className="services-page">
      {/* SCRUM-201: Gradient banner header */}
      <section className="banner banner-glow">
        <div className="container banner-content">
          <span className="banner-eyebrow">Residential &amp; commercial</span>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Choose the cleaning service that fits your home or business.</p>
        </div>
      </section>

      <section className="services-main">
      <div className="container">
        <p className="services-hint">Tap any card to learn more.</p>

        <ul className="services-grid">
        {SERVICES_LIST.map((service, index) => (
            <li key={index} className="service-card">
              <img src={service.img} alt={service.name} className="service-card-img" />
              <h3 className="service-card-title">{service.name}</h3>
            </li>
          ))}
        </ul>

        {/* SCRUM-201: Quote call-to-action card */}
        <div className="services-cta">
          <div>
            <h2 className="services-cta-title">Not sure which service you need?</h2>
            <p className="services-cta-text">Tell us about your space and we'll recommend the right fit.</p>
          </div>
          <Link className="button button-main button-big" to="/contact">Request a quote</Link>
        </div>
      </div>
      </section>
    </div>
  )
}
