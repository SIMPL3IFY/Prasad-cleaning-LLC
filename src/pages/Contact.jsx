import { Link } from 'react-router-dom'

import QuoteForm from '../components/QuoteForm'

// SCRUM-198: What happens after a customer submits the form
const STEPS = [
  { title: 'Tell us about your space', text: 'Share your property type, the service you need, and anything we should know.' },
  { title: 'We review your request', text: 'Our team looks over the details and follows up with your quote.' },
  { title: 'Get scheduled', text: "Once your appointment is confirmed, you'll get an email you can add straight to your calendar." },
]

// SCRUM-198: Services listed in the "What we offer" card
const SERVICES = ['Standard Cleaning', 'Deep Cleaning', 'Move-in / Move-Out', 'Custom Requests']

export default function Contact() {
  return (
    <div className="contact-page">
      {/* SCRUM-198: Gradient banner header */}
      <section className="banner banner-glow">
        <div className="container banner-content">
          <span className="banner-eyebrow">Free, no-obligation quotes</span>
          <h1 className="page-title">Let's get your space sparkling</h1>
          <p className="page-subtitle">Send us a message and we'll get back to you shortly.</p>
        </div>
      </section>

      <section className="contact-main">
        <div className="container contact-grid">
          {/* SCRUM-198: "How it works" and "What we offer" info cards */}
          <aside className="contact-info">
            <div className="contact-info-card">
              <h2 className="contact-info-title">How it works</h2>
              <ol className="contact-steps">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="contact-step">
                    <span className="contact-step-num" aria-hidden="true">{i + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="contact-info-card contact-info-card--accent">
              <h2 className="contact-info-title">What we offer</h2>
              <p className="contact-info-text">Residential and commercial cleaning, including:</p>
              <ul className="contact-chips">
                {SERVICES.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
              <Link to="/service-area" className="contact-link">
                See the cities we serve &rarr;
              </Link>
            </div>
          </aside>

          {/* SCRUM-198: Quote form sits in a white card next to the info column */}
          <div className="contact-form-card">
            <h2 className="contact-form-title">Request your free quote</h2>
            <p className="contact-form-subtitle">All fields are required.</p>
            {/* SCRUM-175: Contact page now uses the shared quote form */}
            <QuoteForm />
          </div>
        </div>
      </section>
    </div>
  )
}
