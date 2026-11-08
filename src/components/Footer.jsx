import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'

// SCRUM-225: Footer grouped into labeled columns.
const PHONE = '(916) 665-8474'
const EMAIL = 'prasadscleaning@gmail.com'
// SCRUM-223: pre-filled subject; the user can still edit it in their email app
const EMAIL_SUBJECT = "Inquiry from Prasad's Cleaning website"

export default function Footer() {
  const year = new Date().getFullYear()
  const { user, loading } = useAuth()
  const [dashboardPath, setDashboardPath] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // SCRUM-234: Check user role to link to /admin or /portal dynamically when logged in
  useEffect(() => {
    let isMounted = true
    if (user) {
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (isMounted) {
            const adminStatus = data?.is_admin === true
            setIsAdmin(adminStatus)
            // Ensure admin defaults specifically to /admin, not /portal
            setDashboardPath(adminStatus ? '/admin' : '/portal')
          }
        })
        .catch(() => {
          if (isMounted) {
            setIsAdmin(false)
            setDashboardPath('/portal')
          }
        })
    } else {
      setIsAdmin(false)
      setDashboardPath(null)
    }
    return () => { isMounted = false }
  }, [user])

  let accountLinks = []
  if (!loading) {
    if (user) {
      if (dashboardPath) {
        accountLinks.push({ to: dashboardPath, label: 'Dashboard' })
      }
      if (!isAdmin) {
        accountLinks.push({ to: '/settings', label: 'Settings' })
      }
    } else {
      accountLinks = [
        { to: '/signin', label: 'Sign In' },
        { to: '/signup', label: 'Create Account' },
      ]
    }
  }

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
      links: accountLinks,
    },
  ]

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
            {/* SCRUM-222: tel: opens the dialer on mobile */}
            <li><a href="tel:+19166658474">{PHONE}</a></li>
            {/* SCRUM-223: mailto: opens the email app with a pre-filled subject */}
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
