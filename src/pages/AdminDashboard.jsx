import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import sampleQuotes from '../data/sampleQuotes'

const QUOTES_PER_PAGE = 1
const APPOINTMENTS_PER_PAGE = 1 // Scrum 84: Appointments pagination
// SCRUM-119: Admin landing page shown after admin login
export default function AdminDashboard() {
    const navigate = useNavigate()
     // SCRUM-85: Constants
    const [quotes, setQuotes] = useState([])
    const [currentQuotePage, setCurrentQuotePage] = useState(1)
    const [currentAppointmentPage, setCurrentAppointmentPage] = useState(1) // Scrum 84: Appointment page state
    const [editingAppointmentId, setEditingAppointmentId] = useState(null) // Scrum 84: Editing appointment state
    const [appointmentMessage, setAppointmentMessage] = useState('') // Scrum 84: Appointment message state

// SCRUM-85: Manage Quotes box and supporting methods
    const fetchQuotes = () =>{
        setQuotes(sampleQuotes)
    }

    useEffect(() => {
        fetchQuotes()
    }, [])
    // Scrum 128 method: Returns the quotes for current page
    const paginateQuotes = () => {
        const start = (currentQuotePage - 1) * QUOTES_PER_PAGE
        return quotes.slice(start, start + QUOTES_PER_PAGE)
    }
    // Scrum 84 method: Returns the appointments for current page
    const paginateAppointments = () => {
        const start = (currentAppointmentPage - 1) * APPOINTMENTS_PER_PAGE
        return quotes.slice(start, start + APPOINTMENTS_PER_PAGE)
    }
    // Scrum 128 method: Navigates between quote pages
    const handleNextPage = (direction) => {
        const totalPages = Math.ceil(quotes.length / QUOTES_PER_PAGE)
        setCurrentQuotePage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
    }
    // Scrum 84 method: Navigates between appointment pages
    const handleAppointmentPage = (direction) => {
        const totalPages = Math.ceil(quotes.length / APPOINTMENTS_PER_PAGE)
        setCurrentAppointmentPage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
    }
    // Scrum 126 method: Accepts a quote into database
    const acceptQuote = (quoteID) => {
        setQuotes(prev =>
            prev.map(q => q.id === quoteID ? { ...q, status: 'accepted' } : q)
        )
    }
    // Scrum 127 method: Declines a quote 
    const declineQuote = (quoteID) => {
        setQuotes(prev =>
            prev.map(q => q.id === quoteID ? { ...q, status: 'declined' } : q)
        )
    }
    // Scrum 84 method: Edit appointment 
    const handleEditAppointment = (quoteID) => {
        setEditingAppointmentId(prev => prev === quoteID ? null : quoteID)
        setAppointmentMessage('')
    }
    // Scrum 84 method: Update appointment 
    const handleUpdateAppointment = (quoteID) => {
        const quote = quotes.find(q => q.id === quoteID)
        if (!quote) return
        setAppointmentMessage(`Appointment updated for ${quote.customerName}.`)
        setEditingAppointmentId(null)
    }
    // Scrum 84 method: Renders and displays each appointment card on screen
    const renderAppointmentCard = (quote) => (
        <div key={quote.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Customer Name:</p>
                    <p style={{ fontSize: '0.9rem' }}>{quote.customerName}</p>
                </div>
                <button
                    onClick={() => handleEditAppointment(quote.id)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#1a73e8',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Edit
                </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Contact Info:</p>
                <p style={{ fontSize: '0.85rem' }}>Email: {quote.email}</p>
                <p style={{ fontSize: '0.85rem' }}>Phone #: {quote.phone}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Service:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.service}</p>
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Property:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.property}</p>
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Appointment:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.appointmentDate}</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.appointmentTime}</p>
                </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Address:</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.address}</span>
            </div>
            <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Message</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.message}</span>
            </div>
            {editingAppointmentId === quote.id && (
                <p style={{ marginTop: '0.8rem', color: '#1a73e8', fontSize: '0.9rem' }}>
                    Editing appointment details for {quote.customerName}.
                </p>
            )}
            {appointmentMessage && (
                <p style={{ marginTop: '0.8rem', color: '#155724', fontSize: '0.9rem' }}>
                    {appointmentMessage}
                </p>
            )}
        </div>
    )
    // Scrum 128 method: Renders and displays each quote card on screen
    const renderQuoteCard = (quote) => (
        <div key={quote.id} style={{ width: '100%' }}>
            {/* Accept / Decline buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {quote.status === 'pending' ? (
                    <>
                        <button
                            onClick={() => acceptQuote(quote.id)}
                            style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.35rem 1rem',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => declineQuote(quote.id)}
                            style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.35rem 1rem',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Decline
                        </button>
                    </>
                ) : (
                    <span style={{
                        padding: '0.35rem 1rem',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        backgroundColor: quote.status === 'accepted' ? '#d4edda' : '#f8d7da',
                        color: quote.status === 'accepted' ? '#155724' : '#721c24'
                    }}>
                        {quote.status === 'accepted' ? 'Accepted' : 'Declined'}
                    </span>
                )}
            </div>
 
            {/* Customer Name */}
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Customer Name:</p>
                <p style={{ fontSize: '0.9rem' }}>{quote.customerName}</p>
            </div>
 
            {/* Contact Info */}
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Contact Info:</p>
                <p style={{ fontSize: '0.85rem' }}>Email: {quote.email}</p>
                <p style={{ fontSize: '0.85rem' }}>Phone #: {quote.phone}</p>
            </div>
 
            {/* Service / Property / Appointment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Service:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.service}</p>
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Property:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.property}</p>
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Appointment:</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.appointmentDate}</p>
                    <p style={{ fontSize: '0.85rem' }}>{quote.appointmentTime}</p>
                </div>
            </div>
 
            {/* Address */}
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Address:</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.address}</span>
            </div>
 
            {/* Message */}
            <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Message</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.message}</span>
            </div>
        </div>
    )

    // Scrum 128 method: Shows the arrows to navigate
    const renderPagination = (currentPage, totalItems, itemsPerPage, onPageChange) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage)
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                    onClick={() => onPageChange('prev')}
                    disabled={currentPage === 1}
                    style={{
                        background: 'none',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '0.25rem 0.6rem',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.4 : 1,
                        fontSize: '1rem'
                    }}
                >
                    ‹
                </button>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>
                    Page {currentPage}/{totalPages}
                </span>
                <button
                    onClick={() => onPageChange('next')}
                    disabled={currentPage === totalPages}
                    style={{
                        background: 'none',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '0.25rem 0.6rem',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.4 : 1,
                        fontSize: '1rem'
                    }}
                >
                    ›
                </button>
            </div>
        )
    }

    const handleLogout = () => {
        navigate('/')
    }
   
    const visibleQuotes = paginateQuotes()
    const visibleAppointments = paginateAppointments()

    // Main return
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
             {/* Dashboard Cards */}
            <div style={{
                display: 'flex',
                gap: '1.5rem',
                padding: '0 2rem 2rem',
                alignItems: 'flex-start',
                justifyContent: 'center',
                flexWrap: 'wrap'
            }}>
                {/* Manage Appointments Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Manage Appointments Card */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        minWidth: '300px',
                        maxWidth: '360px',
                        flex: '1',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        border: '2px solid #5ba3d0'
                    }}>
                        <h2 style={{
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            textAlign: 'center',
                            marginBottom: '1.25rem'
                        }}>
                            Manage Appointments
                        </h2>
     
                        {quotes.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>No appointments available.</p>
                        ) : (
                            <>
                                {visibleAppointments.map(quote => renderAppointmentCard(quote))}
                                {renderPagination(currentAppointmentPage, quotes.length, APPOINTMENTS_PER_PAGE, handleAppointmentPage)}
                            </>
                        )}
                    </div>
                    {/* Update Appointment Button */}
                    <button
                        onClick={() => visibleAppointments[0] && handleUpdateAppointment(visibleAppointments[0].id)}
                        disabled={quotes.length === 0}
                        style={{
                            backgroundColor: quotes.length === 0 ? '#ccc' : 'white',
                            color: quotes.length === 0 ? '#888' : '#333',
                            border: '2px solid #5ba3d0',
                            borderRadius: '50px',
                            padding: '0.9rem 1.5rem',
                            fontWeight: 'bold',
                            cursor: quotes.length === 0 ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase',
                            textAlign: 'center'
                        }}
                    >
                        Update Appointment
                    </button>
                </div>
                {/* Manage Quotes Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    minWidth: '300px',
                    maxWidth: '360px',
                    flex: '1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '2px solid #5ba3d0'
                }}>
                    <h2 style={{
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        textAlign: 'center',
                        marginBottom: '1.25rem'
                    }}>
                        Manage Quotes
                    </h2>
 
                    {quotes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>No quotes available.</p>
                    ) : (
                        <>
                            {visibleQuotes.map(quote => renderQuoteCard(quote))}
                            {renderPagination(currentQuotePage, quotes.length, QUOTES_PER_PAGE, handleNextPage)}
                        </>
                    )}
                </div>
            </div>

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
