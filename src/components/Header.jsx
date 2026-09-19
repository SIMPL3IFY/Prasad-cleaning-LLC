import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/service-area', label: 'Service Areas' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const { error } = await supabase.auth.signOut()
    setIsSigningOut(false)

    if (!error) navigate('/', { replace: true })
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="Go to homepage">
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
          {!loading && (user ? (
            <>
              <Link to="/portal" className="button button-alt">Dashboard</Link>
              <button type="button" className="button button-alt" onClick={handleSignOut} disabled={isSigningOut}>
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </>
          ) : (
            <Link to="/signin" className="button button-alt">Sign In</Link>
          ))}
        </div>
      </div>
    </header>
  )
}
