import { Link, useNavigate } from 'react-router-dom'

// SCRUM-119: Admin landing page shown after admin login
export default function AdminDashboard() {
    const navigate = useNavigate()

    const handleLogout = () => {
        navigate('/')
    }

    return (
        <div>
            <header style={{ backgroundColor: 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 0', width: '100%' }}>
                    <Link to="/" className="logo" aria-label="Prasad's Cleaning Services LLC">
                        <img
                            className="logo-img"
                            src="/assets/logo.png"
                            alt="Prasad's Cleaning Services LLC"
                            style={{ height: '80px', width: 'auto', objectFit: 'contain' }}
                        />
                    </Link>
                </div>
            </header>

            <section className="section">
                <div className="container" style={{ textAlign: 'center' }}>
                    <p style={{
                        fontSize: '0.8rem',
                        color: '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: '0.5rem'
                    }}>
                        Admin Portal
                    </p>
                    <h1 className="section-title">Welcome</h1>
                    <p className="section-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
                     Admin Dashboard
                    </p>
                </div>
            </section>

            <button
                onClick={handleLogout}
                style={{
                    position: 'fixed',
                    top: '1.5rem',
                    right: '1.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.75rem 1.5rem',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    zIndex: 999
                }}
            >
                Logout
            </button>
        </div>
    )
}
