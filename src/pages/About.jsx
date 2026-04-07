import { Link } from 'react-router-dom'

export default function About() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>About Us</h1>
        <p className="section-subtitle">Place holder: A little about our team, our values, and how we work.</p>

        <div className="about-inner" style={{ paddingTop: 'var(--space-2xl)' }}>
          <div className="about-content">
            <h2 className="section-title" style={{ textAlign: 'left' }}>Who We Are</h2>
            <p>Placeholder: Text about the company's history, team, and what sets us apart.</p>
          </div>
          <div className="about-media" aria-hidden="true"></div>
        </div>

        <div className="about-inner" style={{ paddingTop: 'var(--space-2xl)' }}>
          <div className="about-content">
            <h2 className="section-title" style={{ textAlign: 'left' }}>Our Promise</h2>
            <p>Placeholder: Text about company values, mission, and commitment to quality.</p>
          </div>
          <div className="about-media" aria-hidden="true"></div>
        </div>

        {/* Scrum 83: Adding a call-to-action section button to explore services page */}
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
          <h2 className="section-title">Our Services</h2>
          <p>Placeholder: Explore the full range of cleaning services we offer .</p>
          <Link to="/services" className="button button-main">
            View Our Services
          </Link>
        </div>
      </div>
    </section>
  )
}