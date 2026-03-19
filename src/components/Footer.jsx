import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">Prasad's Cleaning LLC</div>
        <div className="footer-links">
          <Link to="/services">Services</Link> ·{' '}
          <Link to="/about">About</Link> ·{' '}
          <Link to="/testimonials">Reviews</Link> ·{' '}
          <Link to="/contact">Contact</Link>
        </div>
        <div className="footer-contact">Phone · Email</div>
      </div>
      <div className="footer-bottom">@ Prasad's Cleaning LLC. All rights reserved.</div>
    </footer>
  )
}
