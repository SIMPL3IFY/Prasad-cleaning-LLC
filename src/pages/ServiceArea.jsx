import { Link } from 'react-router-dom'

export default function ServiceArea() {
  const cities = [
    'Sacramento', 'El Dorado Hills', 'Folsom', 'Roseville',
    'Elk Grove', 'Davis', 'Modesto', 'Stockton',
    'Bay Area', 'San Francisco', 'Vacaville', 'Lincoln',
  ]

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>Service Area</h1>
        <p className="section-subtitle">
          We provide cleaning services to most of Northern California — including the Bay Area,
          Modesto, Sacramento, and El Dorado Hills.
        </p>

        {/* Map embed centred on Sacramento / Northern CA */}
        <div
          style={{
            width: '100%',
            maxWidth: '860px',
            margin: 'var(--space-2xl) auto 0',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid var(--color-border, #e5e7eb)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <iframe
            title="Prasad's Cleaning Service Area Map"
            width="100%"
            height="450"
            style={{ display: 'block', border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            //src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d150139.44611924601!2d-121.54431062624332!3d38.56186408081839!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x809ac672b28397f9%3A0x921f6aaa74197fdb!2sSacramento%2C%20CA!5e1!3m2!1sen!2sus!4v1773801652207!5m2!1sen!2sus"
            //src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1264000!2d-121.4944!3d38.5816!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
          />
        </div>

        {/* Cities grid */}
        <div style={{ marginTop: 'var(--space-2xl)' }}>
          <h2 className="section-title" style={{ textAlign: 'center' }}>Cities We Serve</h2>
          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 'var(--space-md, 1rem)',
              listStyle: 'none',
              padding: 0,
              marginTop: 'var(--space-xl)',
            }}
          >
            {cities.map((city) => (
              <li
                key={city}
                className="service-card"
                style={{
                  textAlign: 'center',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                }}
              >
                {city}
              </li>
            ))}
          </ul>
        </div>

        {/* Callout note */}
        <p
          className="section-subtitle"
          style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}
        >
          Don't see your city? Reach out — we may still be able to help!
        </p>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          <a className="button button-main" href="/contact">
            Get a Free Quote
          </a>
        </div>

        {/* SCRUM-22: Sign In button for existing customers */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <Link className="button button-main" to="/signin">
            Sign In
          </Link>
        </div>
      </div>
    </section>
  )
}