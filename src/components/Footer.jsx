import { Link } from 'react-router-dom'

// SCRUM-225: Footer grouped into labeled columns.
const PHONE = '(916) 665-8474'
const EMAIL = 'prasadscleaning@gmail.com'

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
            <li>{PHONE}</li>
            <li>{EMAIL}</li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        © {year} Prasad's Cleaning LLC. All rights reserved.
      </div>
    </footer>
  )
}
