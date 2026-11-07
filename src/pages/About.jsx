import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="about-page">
      <section className="banner banner-glow">
        <div className="container banner-content">
          <span className="banner-eyebrow">Locally owned &amp; operated</span>
          <h1 className="page-title">About Us</h1>
          <p className="page-subtitle">Reliable, high-quality cleaning for homes and businesses across Northern California.</p>
        </div>
      </section>

      <section className="page-main">
        <div className="container about-single-column">
          <div className="about-card">
            <h2 className="contact-info-title">Who We Are</h2>

            <p className="about-text">
              Prasad&apos;s Cleaning Services LLC is a locally owned cleaning company dedicated
              to delivering reliable, high-quality service for homes and businesses. Owned and
              operated by Nigel Prasad, the company serves clients across Northern California,
              including the Bay Area, Modesto, Sacramento, and El Dorado Hills.
            </p>

            <p className="about-text">
              We take pride in professionalism, attention to detail, and creating clean,
              welcoming spaces for every client. Our goal is to provide dependable cleaning
              solutions with care, consistency, and respect for every property.
            </p>
          </div>

          <div className="about-card about-offer-card">
            <h2 className="contact-info-title">What We Offer</h2>

            <p className="about-text">
              We provide a wide range of cleaning services tailored to the needs of each
              customer. Services include commercial cleaning, residential window cleaning,
              carpet cleaning, janitorial services, floor cleaning, and stripping and wax
              services.
            </p>

            <ul className="about-service-list-clean">
              <li>Commercial Cleaning</li>
              <li>Residential Window Cleaning</li>
              <li>Carpet Cleaning</li>
              <li>Janitorial Services</li>
              <li>Floor Cleaning</li>
              <li>Stripping and Wax Services</li>
            </ul>
          </div>

          <div className="about-values-section">
            <h2 className="section-title">Why Clients Choose Us</h2>

            <div className="about-values-grid">
              <article className="about-value-card">
                <h3>Reliable</h3>
                <p>We provide consistent, high-quality service that customers can count on.</p>
              </article>

              <article className="about-value-card">
                <h3>Detail-Oriented</h3>
                <p>
                  We focus on both visible cleanliness and the finishing touches that improve
                  the whole space.
                </p>
              </article>

              <article className="about-value-card">
                <h3>Professional</h3>
                <p>
                  We approach every job with respect, clear communication, and care for the
                  customer&apos;s property.
                </p>
              </article>
            </div>
          </div>

          <div className="page-cta">
            <div>
              <h2 className="page-cta-title">Ready to get started?</h2>
              <p className="page-cta-text">Tell us about your space and we'll get back to you shortly.</p>
            </div>
            <Link className="button button-main button-big" to="/contact">Request a quote</Link>
          </div>
        </div>
      </section>
    </div>
  )
}