import { Link } from 'react-router-dom'

import { SERVICES_LIST } from '../data/ServicesData';

export default function About() {

  //const for scrum 80 to show a sample of services provided
  //the section with id "services" is where the sample of services are added
  //the section with id "services" also has a button to redirect from this page to Services.jsx
  const featuredServices = SERVICES_LIST.filter(service => 
    service.name === "Residential Cleaning" || 
    service.name === "Commercial Cleaning" || 
    service.name === "Special Offers"
  );
  return (
    <>
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>About Us</h1>
        <p className="section-subtitle">Place holder: A little about our team, our values, and how we work.</p>
      </div>

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
          <Link className="button button-main" to="/services">View all services</Link>
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
  </>
  )
}