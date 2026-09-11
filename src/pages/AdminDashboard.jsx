import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import sampleQuotes from '../data/sampleQuotes'
import { supabase } from '../supabaseClient'

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
    const [editedAppointment, setEditedAppointment] = useState({}) // Scrum 87: Tracks in-progress field edits
    const [reviews, setReviews] = useState([])
    const [loadingReviews, setLoadingReviews] = useState(true)
    const [reviewMessage, setReviewMessage] = useState('')
    const [showReviewsModal, setShowReviewsModal] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

// SCRUM-85: Manage Quotes box and supporting methods
    const fetchQuotes = () =>{
        setQuotes(sampleQuotes)
    }

    const fetchReviews = async () => {
        setLoadingReviews(true)
        const { data, error } = await supabase
            .from('customer_reviews')
            .select('id, customer_name, review, rating, approved, created_at')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching customer reviews:', error)
            setReviews([])
            setReviewMessage('Unable to load customer reviews.')
        } else {
            setReviews(data || [])
            setReviewMessage('')
        }

        setLoadingReviews(false)
    }

    useEffect(() => {
        const checkAdminAccess = async () => {
            const demoAccess = typeof window !== 'undefined' && localStorage.getItem('prasad-admin-demo-access') === 'true'

            if (demoAccess) {
                setIsAdmin(true)
                return
            }

            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError || !user) {
                navigate('/signin')
                return
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .maybeSingle()

            if (profileError || !profile?.is_admin) {
                navigate('/signin')
                return
            }

            setIsAdmin(true)
        }

        checkAdminAccess()
        fetchQuotes()
        fetchReviews()
    }, [navigate])
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
        setEditingAppointmentId(null) // Scrum 87: Cancel edit mode when navigating pages
        setEditedAppointment({}) // Scrum 87: Clear in-progress edits when navigating pages
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
        if (editingAppointmentId === quoteID) {
            setEditingAppointmentId(null)
            setEditedAppointment({}) // Scrum 87: Clear edits on cancel
        } else {
            const quote = quotes.find(q => q.id === quoteID)
            setEditingAppointmentId(quoteID)
            setEditedAppointment({ ...quote }) // Scrum 87: Seed fields with current appointment values
        }
        setAppointmentMessage('')
    }
    // Scrum 84 method: Update appointment
    const handleUpdateAppointment = (quoteID) => {
        const quote = quotes.find(q => q.id === quoteID)
        if (!quote) return
        setQuotes(prev => prev.map(q => q.id === quoteID ? { ...q, ...editedAppointment } : q)) // Scrum 87: Apply edited fields to quotes state
        setAppointmentMessage(`Appointment updated for ${quote.customerName}.`)
        setEditingAppointmentId(null)
        setEditedAppointment({}) // Scrum 87: Clear edits after saving
    }
    //Scrum 135 method: Approve or reject a customer review
    const handleReviewDecision = async (reviewId, approved) => {
        const { error } = await supabase
            .from('customer_reviews')
            .update({ approved })
            .eq('id', reviewId)

        if (error) {
            console.error('Error updating review approval:', error)
            setReviewMessage(error.message)
            return
        }

        setReviews(prev => prev.map(review =>
            review.id === reviewId ? { ...review, approved } : review
        ))

        setReviewMessage(approved ? 'Review approved and now visible publicly.' : 'Review rejected and hidden from the public page.')
    }

    const renderReviewCard = (review, isApproved) => (
        <div key={review.id} style={{ border: '1px solid #d9d9d9', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem' }}>{review.customer_name}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#555' }}>{'⭐'.repeat(review.rating)}</span>
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: isApproved ? '#d4edda' : '#fff3cd',
                        color: isApproved ? '#155724' : '#856404'
                    }}>
                        {isApproved ? 'Approved' : 'Pending'}
                    </span>
                </div>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                {review.review}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                    onClick={() => handleReviewDecision(review.id, true)}
                    style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        opacity: review.approved ? 0.6 : 1
                    }}
                >
                    {review.approved ? 'Approved' : 'Approve'}
                </button>
                <button
                    onClick={() => handleReviewDecision(review.id, false)}
                    style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        opacity: !review.approved ? 0.6 : 1
                    }}
                >
                    {review.approved ? 'Reject' : 'Rejected'}
                </button>
            </div>
        </div>
    )
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
                    {editingAppointmentId === quote.id ? 'Cancel' : 'Edit'}{/* Scrum 87: Toggle label based on edit mode */}
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
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable service field
                        <input
                            value={editedAppointment.service || ''}
                            onChange={e => setEditedAppointment(prev => ({ ...prev, service: e.target.value }))}
                            style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0' }}
                        />
                    ) : (
                        <p style={{ fontSize: '0.85rem' }}>{quote.service}</p>
                    )}
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Property:</p>
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable property field
                        <input
                            value={editedAppointment.property || ''}
                            onChange={e => setEditedAppointment(prev => ({ ...prev, property: e.target.value }))}
                            style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0' }}
                        />
                    ) : (
                        <p style={{ fontSize: '0.85rem' }}>{quote.property}</p>
                    )}
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Appointment:</p>
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable date and time fields
                        <>
                            <input
                                value={editedAppointment.appointmentDate || ''}
                                onChange={e => setEditedAppointment(prev => ({ ...prev, appointmentDate: e.target.value }))}
                                style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0', marginBottom: '0.2rem' }}
                            />
                            <input
                                value={editedAppointment.appointmentTime || ''}
                                onChange={e => setEditedAppointment(prev => ({ ...prev, appointmentTime: e.target.value }))}
                                style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0' }}
                            />
                        </>
                    ) : (
                        <>
                            <p style={{ fontSize: '0.85rem' }}>{quote.appointmentDate}</p>
                            <p style={{ fontSize: '0.85rem' }}>{quote.appointmentTime}</p>
                        </>
                    )}
                </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Address:</p>
                {editingAppointmentId === quote.id ? ( // Scrum 87: Editable address field
                    <input
                        value={editedAppointment.address || ''}
                        onChange={e => setEditedAppointment(prev => ({ ...prev, address: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0', marginTop: '0.3rem' }}
                    />
                ) : (
                    <span style={{ fontSize: '0.85rem' }}>{quote.address}</span>
                )}
            </div>
            <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Message</p>
                {editingAppointmentId === quote.id ? ( // Scrum 87: Editable message field
                    <textarea
                        value={editedAppointment.message || ''}
                        onChange={e => setEditedAppointment(prev => ({ ...prev, message: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid #5ba3d0', marginTop: '0.3rem', resize: 'vertical' }}
                    />
                ) : (
                    <span style={{ fontSize: '0.85rem' }}>{quote.message}</span>
                )}
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
    const allReviews = [...reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const pendingReviews = allReviews.filter(review => !review.approved)
    const approvedReviews = allReviews.filter(review => review.approved)

    if (!isAdmin) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>Checking admin access...</div>
    }

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
                        border: editingAppointmentId ? '2px solid #1a73e8' : '2px solid #5ba3d0' // Scrum 87: Blue border when editing
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
                        onClick={() => editingAppointmentId && handleUpdateAppointment(editingAppointmentId)} // Scrum 87: Update whichever appointment is being edited
                        disabled={!editingAppointmentId} // Scrum 87: Only enabled when an appointment is in edit mode
                        style={{
                            backgroundColor: !editingAppointmentId ? '#ccc' : 'white',
                            color: !editingAppointmentId ? '#888' : '#333',
                            border: '2px solid #5ba3d0',
                            borderRadius: '50px',
                            padding: '0.9rem 1.5rem',
                            fontWeight: 'bold',
                            cursor: !editingAppointmentId ? 'not-allowed' : 'pointer',
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

                {/* Customer Reviews Trigger */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    minWidth: '300px',
                    maxWidth: '420px',
                    flex: '1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '2px solid #5ba3d0',
                    textAlign: 'center'
                }}>
                    <h2 style={{
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        textAlign: 'center',
                        marginBottom: '1rem'
                    }}>
                        Customer Reviews
                    </h2>

                    {reviewMessage && (
                        <p style={{ marginBottom: '1rem', color: '#155724', fontSize: '0.9rem' }}>
                            {reviewMessage}
                        </p>
                    )}

                    <button
                        onClick={() => setShowReviewsModal(true)}
                        style={{
                            backgroundColor: '#1a73e8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.75rem 1.25rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        View Review Table
                    </button>
                </div>
            </div>

            {showReviewsModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '700px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Customer Reviews</h3>
                            <button
                                onClick={() => setShowReviewsModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.25rem',
                                    cursor: 'pointer',
                                    color: '#333'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {loadingReviews ? (
                            <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>Loading reviews...</p>
                        ) : allReviews.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>No reviews available.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 0.75rem', color: '#1a73e8' }}>Pending Reviews</h4>
                                    {pendingReviews.length === 0 ? (
                                        <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>No pending reviews.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {pendingReviews.map(review => renderReviewCard(review, false))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h4 style={{ margin: '0 0 0.75rem', color: '#155724' }}>Approved Reviews</h4>
                                    {approvedReviews.length === 0 ? (
                                        <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>No approved reviews.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {approvedReviews.map(review => renderReviewCard(review, true))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
