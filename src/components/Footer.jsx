import { Link } from 'react-router-dom'

// SCRUM-225: Footer grouped into labeled columns.
const PHONE = '(916) 665-8474'
const PHONE_DIGITS = PHONE.replace(/\D/g, '') // SCRUM-223: tel: links need bare digits
const EMAIL = 'prasadscleaning@gmail.com'
// SCRUM-223: pre-filled subject; the user can still edit it in their email app
const EMAIL_SUBJECT = "Inquiry from Prasad's Cleaning website"

const footerColumns = [
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/testimonials', label: 'Testimonials' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Services',
    links: [
      { to: '/services', label: 'Our Services' },
      { to: '/service-area', label: 'Service Areas' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/signin', label: 'Sign In' },
      { to: '/signup', label: 'Create Account' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-col footer-brand">
          <Link to="/" className="footer-brand-name">Prasad's Cleaning LLC</Link>
          <p className="footer-tagline">
            Reliable residential and commercial cleaning you can count on.
          </p>
        </div>

        {footerColumns.map(({ title, links }) => (
          <nav key={title} className="footer-col" aria-label={title}>
            <h3 className="footer-heading">{title}</h3>
            <ul className="footer-list">
              {links.map(({ to, label }) => (
                <li key={to}><Link to={to}>{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="footer-col">
          <h3 className="footer-heading">Get in Touch</h3>
          <ul className="footer-list">
            {/* SCRUM-223: tel: opens the dialer on mobile, mailto: opens the email app */}
            <li><a href={`tel:+1${PHONE_DIGITS}`}>{PHONE}</a></li>
            <li><a href={`mailto:${EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`}>{EMAIL}</a></li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        © {year} Prasad's Cleaning LLC. All rights reserved.
      </div>
    </footer>
  )
}
