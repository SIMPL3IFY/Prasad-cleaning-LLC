import { Link } from 'react-router-dom'
import { useState } from 'react'

import { SERVICES_LIST } from '../data/ServicesData';

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

        {/* SCRUM-201: Service cards flip to reveal a brief description on click (mirrors the landing page, SCRUM 141) */}
        <ul className="services-grid">
          {SERVICES_LIST.map((service, index) => (
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
                    <span className="service-card-cue" aria-hidden="true">Learn more &rarr;</span>
                  </div>
                  <div className="service-card-face service-card-back">
                    <h3>{service.name}</h3>
                    <p>{service.description || 'Customized cleaning solutions designed around your needs.'}</p>
                  </div>
                </div>
              </button>
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
