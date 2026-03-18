import { Link, useLocation } from 'react-router-dom'

const navLinks = [
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/testimonials', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const { pathname } = useLocation()

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="Prasad's Cleaning Services LLC">
          <img className="logo-img" src="/assets/logo.png" alt="Prasad's Cleaning Services LLC" />
        </Link>

        <nav className="nav" aria-label="Main">
          <ul className="nav-list">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} aria-current={pathname === to ? 'page' : undefined}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <Link to="/contact" className="btn btn-primary">Get a Quote</Link>
          <Link to="/signin" className="btn btn-secondary">Sign In</Link>
        </div>
      </div>
    </header>
  )
}
