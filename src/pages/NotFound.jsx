import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p style={{ margin: '1rem 0' }}>The page you are looking for does not exist.</p>
      <Link to="/" className="button button-main">Back to Home</Link>
    </div>
  )
}
