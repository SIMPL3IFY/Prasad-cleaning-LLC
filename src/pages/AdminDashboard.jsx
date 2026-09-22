import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const QUOTES_PER_PAGE = 1
const APPOINTMENTS_PER_PAGE = 1 // Scrum 84: Appointments pagination
const DECLINED_QUOTES_PER_PAGE = 1 // Scrum 149: Declined quotes pagination
// SCRUM-142: Maps the appointment card's camelCase fields to their accepted_quotes column names
const APPOINTMENT_FIELD_MAP = {
    service: 'service',
    property: 'property',
    appointmentDate: 'appointment_date',
    appointmentTime: 'appointment_time',
    address: 'address',
    message: 'message',
    phone: 'phone'
}
// SCRUM-142: Fields that can't be saved blank.
const REQUIRED_APPOINTMENT_FIELDS = {
    service: 'Service',
    property: 'Property',
    appointmentDate: 'Appointment date',
    appointmentTime: 'Appointment time',
    address: 'Address',
    phone: 'Phone number'
}
// SCRUM-119: Admin landing page shown after admin login
export default function AdminDashboard() {
    const navigate = useNavigate()
     // SCRUM-85: Constants
    const [quotes, setQuotes] = useState([]) //Scrum 88
    const [acceptedQuotes, setAcceptedQuotes] = useState([]) //Scrum 88
    const [currentQuotePage, setCurrentQuotePage] = useState(1)
    const [currentAppointmentPage, setCurrentAppointmentPage] = useState(1) // Scrum 84: Appointment page state
    const [editingAppointmentId, setEditingAppointmentId] = useState(null) // Scrum 84: Editing appointment state
    const [appointmentError, setAppointmentError] = useState('') // SCRUM-142 Subtask 189: Visible error for invalid or failed appointment edits
    const [appointmentMessage, setAppointmentMessage] = useState('') // Scrum 84: Appointment message state
    const [editedAppointment, setEditedAppointment] = useState({}) // Scrum 87: Tracks in-progress field edits
    const [declinedQuotes, setDeclinedQuotes] = useState([])       // Scrum 149: Holds declined quotes fetched from the archive table
    const [currentDeclinedPage, setCurrentDeclinedPage] = useState(1)   // Scrum 149: Current page for Declined Quotes pagination
    const [decliningQuoteId, setDecliningQuoteId] = useState(null) // Scrum 149: Which quote's reason prompt is open
    const [declineReason, setDeclineReason] = useState('')  // Scrum 149: In-progress text for the decline reason field
    const [declineReasonError, setDeclineReasonError] = useState(false) // Scrum 149: Drives the required-field highlight
    const [reviews, setReviews] = useState([])
    const [loadingReviews, setLoadingReviews] = useState(true)
    const [reviewMessage, setReviewMessage] = useState('')
    const [showReviewsModal, setShowReviewsModal] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    // Scrum 150: State to track which quote is awaiting confirmation to accept
    const [acceptingQuoteId, setAcceptingQuoteId] = useState(null)
    // Scrum 183: State to track which declined quote is awaiting confirmation to move to pending
    const [reopenModalQuote, setReopenModalQuote] = useState(null)

    // SCRUM-85: Manage Quotes box and supporting methods
    // EDITED from CSC 190-191:
    // Scrum 88: fetches quotes from the quotes table on Supabase
    // Scrum 149: connects quotes box to Supabase database.
    const fetchQuotes = async () => {
        const { data, error } = await supabase
            .from('quotes')
            .select(`
                id,
                customerName:customer_name,
                email,
                phone,
                service,
                property,
                appointmentDate:appointment_date,
                appointmentTime:appointment_time,
                address,
                message,
                status
            `)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching quotes:', error.message)
            return
        }
        setQuotes(data)
    }

    // Scrum 149 method: fetches every declined quote from the archive table.
    const fetchDeclinedQuotes = async () => {
        const { data, error } = await supabase
            .from('declined_quotes')
            .select(`
                id,
                customerName:customer_name,
                email,
                phone,
                service,
                property,
                appointmentDate:appointment_date,
                appointmentTime:appointment_time,
                address,
                message,
                declineReason:decline_reason,
                declinedAt:declined_at
            `)
            .order('declined_at', { ascending: false })

        if (error) {
            console.error('Error fetching declined quotes:', error.message)
            return
        }
        setDeclinedQuotes(data)
    }


    // Scrum 135: Loads all customer reviews from Supabase so the admin can approve or reject them
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

    // Scrum 88: Fetch pending, accepted, declined, and review data for the dashboard
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
        fetchAcceptedQuotes()
        fetchDeclinedQuotes()
    }, [navigate])

    // Scrum 88: Method to fetch accepted quotes from accepted_quotes table on Supabase
    const fetchAcceptedQuotes = async () => {
        const { data, error } = await supabase
            .from('accepted_quotes')
            .select(`
                id,
                originalQuoteId:original_quote_id,
                customerName:customer_name,
                email,
                phone,
                service,
                property,
                appointmentDate:appointment_date,
                appointmentTime:appointment_time,
                address,
                message,
                status
            `)
            .order('accepted_at', { ascending: true })

        if (error) {
            console.error('Error fetching accepted quotes:', error.message)
            return
        }
        setAcceptedQuotes(data)
    }

    // Scrum 128 method: Returns the quotes for current page
    const paginateQuotes = () => {
        const start = (currentQuotePage - 1) * QUOTES_PER_PAGE
        return quotes.slice(start, start + QUOTES_PER_PAGE)
    }
    // Scrum 84 method: Returns the appointments for current page
    const paginateAppointments = () => {
        const start = (currentAppointmentPage - 1) * APPOINTMENTS_PER_PAGE
        return acceptedQuotes.slice(start, start + APPOINTMENTS_PER_PAGE)
    }
    // Scrum 149 method: Returns declined quotes for the current page
    const paginateDeclinedQuotes = () => {
        const start = (currentDeclinedPage - 1) * DECLINED_QUOTES_PER_PAGE
        return declinedQuotes.slice(start, start + DECLINED_QUOTES_PER_PAGE)
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
        const totalPages = Math.ceil(acceptedQuotes.length / APPOINTMENTS_PER_PAGE)
        setCurrentAppointmentPage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
        setEditingAppointmentId(null) // Scrum 87: Cancel edit mode when navigating pages
        setEditedAppointment({}) // Scrum 87: Clear in-progress edits when navigating pages
        setAppointmentError('') // SCRUM-142 sub task 189: Clear any edit error when navigating pages
    }
    // Scrum 149 method: Navigates between declined quote pages
    const handleDeclinedPage = (direction) => {
        const totalPages = Math.ceil(declinedQuotes.length / DECLINED_QUOTES_PER_PAGE)
        setCurrentDeclinedPage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
    }
    
    // Scrum 150 method: Opens acceptance confirmation modal for quote
    const handleAcceptClick = (quoteID) => {
        setAcceptingQuoteId(quoteID)
    }

    // Scrum 126 method: Accepts a quote into database
    // EDITED from CSC 190-191:
    // Scrum 88 method: Accepts a quote from quotes table and moves it to accepted_quotes table on Supabase
    // Scrum 150 method: Executes quote acceptance after modal confirmation
    const acceptQuote = async (quoteID) => { 
        const quoteToAccept = quotes.find(q => q.id === quoteID)
        if (!quoteToAccept) return
    
        //Insert into accepted_quotes table in Supabase
        const { error: insertError } = await supabase
            .from('accepted_quotes')
            .insert([{
                original_quote_id: quoteToAccept.id,
                customer_name: quoteToAccept.customerName,
                email: quoteToAccept.email,
                phone: quoteToAccept.phone,
                service: quoteToAccept.service,
                property: quoteToAccept.property,
                appointment_date: quoteToAccept.appointmentDate,
                appointment_time: quoteToAccept.appointmentTime,
                address: quoteToAccept.address,
                message: quoteToAccept.message,
                status: 'accepted'
            }])
        if (insertError) {
            console.error('Error creating accepted quote record:', insertError.message)
            return
        }
        //Delete the quote from the 'quotes' table in Supabase
        const { error: deleteError } = await supabase
            .from('quotes')
            .delete()
            .eq('id', quoteID)
        if (deleteError) {
            console.error('Error deleting quote from quotes table:', deleteError.message)
            return
        }
        //Update local UI state
        setQuotes(prev => prev.filter(q => q.id !== quoteID)) 
        setAcceptingQuoteId(null) // Scrum 150: Close accept confirmation modal
        // Reset pagination to page 1 if deleting the last quote on the current page
        if (quotes.length - 1 <= (currentQuotePage - 1) * QUOTES_PER_PAGE && currentQuotePage > 1) {
            setCurrentQuotePage(prev => prev - 1)
        }
        // Refresh accepted appointments list
        fetchAcceptedQuotes() 
    }
    // SCRUM-155: Opens the decline reason prompt for a quote, or cancels it if already open
    const handleDecline = (quoteID) => {
        if (decliningQuoteId === quoteID) {
            setDecliningQuoteId(null)
        } else {
            setDecliningQuoteId(quoteID)
        }
        setDeclineReason('')
        setDeclineReasonError(false)
    }

    // SCRUM-155 method: Validates that a decline reason was entered; highlights the field and blocks submission if empty, otherwise hands off to archiveQuote() or archiveAcceptedAppointment()
    // Scrum 150 method: Checks if quote is in pending quotes or accepted appointments before declining
    const confirmDecline = (quoteID) => {
        if (!declineReason.trim()) {
            setDeclineReasonError(true)
            return
        }

        const isAcceptedAppointment = acceptedQuotes.some(q => q.id === quoteID)
        if (isAcceptedAppointment) {
            archiveAcceptedAppointment(quoteID, declineReason.trim()) // Scrum 150: Cancel/decline accepted appointment
        } else {
            archiveQuote(quoteID, declineReason.trim())
        }
    }

    // SCRUM-155 method: Moves a declined quote from `quotes` into `declined_quotes`
    const archiveQuote = async (quoteID, reason) => {
        const quote = quotes.find(q => q.id === quoteID)
        if (!quote) return

        const { error: insertError } = await supabase
            .from('declined_quotes')
            .insert({
                original_quote_id: quote.id,
                customer_name: quote.customerName,
                email: quote.email,
                phone: quote.phone,
                service: quote.service,
                property: quote.property,
                appointment_date: quote.appointmentDate,
                appointment_time: quote.appointmentTime,
                address: quote.address,
                message: quote.message,
                decline_reason: reason
            })

        if (insertError) {
            console.error('Error archiving declined quote:', insertError.message)
            return
        }

        const { error: deleteError } = await supabase
            .from('quotes')
            .delete()
            .eq('id', quoteID)

        if (deleteError) {
            console.error('Error removing declined quote from quotes table:', deleteError.message)
            return
        }

        setQuotes(prev => prev.filter(q => q.id !== quoteID))
        setDecliningQuoteId(null)
        setDeclineReason('')
        setDeclineReasonError(false)
        fetchDeclinedQuotes()
    }

    // Scrum 150 method: Moves an accepted appointment directly from accepted_quotes into declined_quotes
    const archiveAcceptedAppointment = async (quoteID, reason) => {
        const appointment = acceptedQuotes.find(q => q.id === quoteID)
        if (!appointment) return

        const { error: insertError } = await supabase
            .from('declined_quotes')
            .insert({
                original_quote_id: appointment.originalQuoteId || appointment.id,
                customer_name: appointment.customerName,
                email: appointment.email,
                phone: appointment.phone,
                service: appointment.service,
                property: appointment.property,
                appointment_date: appointment.appointmentDate,
                appointment_time: appointment.appointmentTime,
                address: appointment.address,
                message: appointment.message,
                decline_reason: reason
            })

        if (insertError) {
            console.error('Error archiving accepted appointment to declined_quotes:', insertError.message)
            return
        }

        const { error: deleteError } = await supabase
            .from('accepted_quotes')
            .delete()
            .eq('id', quoteID)

        if (deleteError) {
            console.error('Error removing appointment from accepted_quotes table:', deleteError.message)
            return
        }

        setAcceptedQuotes(prev => prev.filter(q => q.id !== quoteID))
        setDecliningQuoteId(null)
        setDeclineReason('')
        setDeclineReasonError(false)

        if (acceptedQuotes.length - 1 <= (currentAppointmentPage - 1) * APPOINTMENTS_PER_PAGE && currentAppointmentPage > 1) {
            setCurrentAppointmentPage(prev => prev - 1)
        }

        fetchDeclinedQuotes()
    }

    // Scrum 183: Triggers the confirmation modal popup when button is clicked
    const handleReopenClick = (quote) => {
        setReopenModalQuote(quote)
    }

    // Scrum 183: Executes the database operations after admin confirms in modal
    const handleConfirmReopen = async () => {
        if (!reopenModalQuote) return

        const quote = reopenModalQuote

        try {
            // Map payload fields to match Supabase database column names
            const pendingQuotePayload = {
                customer_name: quote.customerName || quote.customer_name,
                email: quote.email,
                phone: quote.phone,
                service: quote.service,
                property: quote.property,
                appointment_date: quote.appointmentDate || quote.appointment_date,
                appointment_time: quote.appointmentTime || quote.appointment_time,
                address: quote.address,
                message: quote.message,
                status: 'pending'
            }

            // 1. Insert into 'quotes' table
            const { error: insertError } = await supabase
                .from('quotes')
                .insert([pendingQuotePayload])

            if (insertError) {
                console.error('Supabase Insert Error (quotes):', insertError)
                alert(`Failed to restore quote: ${insertError.message}`)
                return
            }

            // 2. Delete from 'declined_quotes' table
            const { error: deleteError } = await supabase
                .from('declined_quotes')
                .delete()
                .eq('id', quote.id)

            if (deleteError) {
                console.error('Supabase Delete Error (declined_quotes):', deleteError)
                alert(`Inserted into quotes, but failed to remove from declined_quotes: ${deleteError.message}`)
                return
            }

            // 3. Update local state and pagination
            setDeclinedQuotes(prev => prev.filter(q => q.id !== quote.id))

            if (declinedQuotes.length - 1 <= (currentDeclinedPage - 1) * DECLINED_QUOTES_PER_PAGE && currentDeclinedPage > 1) {
                setCurrentDeclinedPage(prev => prev - 1)
            }

            await fetchQuotes()

            // Close modal and clear state
            setReopenModalQuote(null)

        } catch (err) {
            console.error('Unexpected failure during move to pending:', err)
            alert('An unexpected error occurred while processing your request.')
        }
    }

    // Scrum 84 method: Edit appointment
    const handleEditAppointment = (quoteID) => {
        if (editingAppointmentId === quoteID) {
            setEditingAppointmentId(null)
            setEditedAppointment({}) // Scrum 87: Clear edits on cancel
        } else {
            const quote = acceptedQuotes.find(q => q.id === quoteID)
            setEditingAppointmentId(quoteID)
            setEditedAppointment({ ...quote }) // Scrum 87: Seed fields with current appointment values
        }
        setAppointmentMessage('')
        setAppointmentError('') // SCRUM-189: Clear any edit error when toggling edit mode
    }

    // Scrum 84 method: Update appointment
    //EDITED from CSC 190-191:
    // Scrum 88 fix: Updates Supabase accepted_quotes table and acceptedQuotes state
    // SCRUM-142: Only sends the fields the admin changed, validates required fields first,
    // and confirms a row was really updated before touching the UI
    // SCRUM-142 subtask 189: Shows an error message (not just console.error) when validation or the update fails
    const handleUpdateAppointment = async (quoteID) => {
        const quote = acceptedQuotes.find(q => q.id === quoteID)
        if (!quote) return

        setAppointmentMessage('')
        setAppointmentError('') // SCRUM-189: Clear the previous error at the start of each attempt

        // SCRUM-142: Compare each field against the saved value and keep only the ones that changed
        const normalize = (value) => (value ?? '').toString().trim() // null -> '' and trims whitespace
        const changes = {}         // { db_column: newValue } -> the only thing sent to Supabase
        const changedFields = []   // [camelCase keys] -> what we validate
        Object.entries(APPOINTMENT_FIELD_MAP).forEach(([field, column]) => {
            if (normalize(editedAppointment[field]) !== normalize(quote[field])) {
                changes[column] = normalize(editedAppointment[field])
                changedFields.push(field)
            }
        })

        // SCRUM-142: Nothing changed, so skip the database call
        if (changedFields.length === 0) {
            setAppointmentError('No changes to save. Edit a field first.') // SCRUM-189: shown via the error state
            return
        }

        // SCRUM-142: Block the update if it would blank out a required column (e.g. phone)
        const blankRequired = changedFields.filter(field => REQUIRED_APPOINTMENT_FIELDS[field] && changes[APPOINTMENT_FIELD_MAP[field]] === '')
        if (blankRequired.length > 0) {
            setAppointmentError(`${blankRequired.map(field => REQUIRED_APPOINTMENT_FIELDS[field]).join(', ')} cannot be empty.`) 
            return
        }

        try { // SCRUM-142: Catches anything unexpected that throws
            // SCRUM-142: .update(changes) sends only changed columns.
            // .select() returns the updated row(s); without it, an RLS-blocked update looks like a success.
            const { data, error } = await supabase
                .from('accepted_quotes')
                .update(changes)
                .eq('id', quoteID)
                .select('service, property, appointment_date, appointment_time, address, message')

            // SCRUM-142: Network or database error
            if (error) {
                console.error('Error updating appointment:', error.message)
                setAppointmentError(`Unable to save changes: ${error.message}`)
                return // Stay in edit mode so the admin doesn't lose what they typed
            }

            // SCRUM-142: RLS rejections (or a deleted row) return no error but also zero updated rows
            if (!data || data.length === 0) {
                console.error('Appointment update matched no rows (RLS policy or missing row):', quoteID)
                setAppointmentError('Changes were not saved. You may not have permission, or this appointment no longer exists.')
                return
            }

            // SCRUM-142: Update the card from what Supabase actually stored, not from what was typed
            const saved = data[0]
            setAcceptedQuotes(prev => prev.map(q => q.id === quoteID ? {
                ...q,
                service: saved.service,
                property: saved.property,
                appointmentDate: saved.appointment_date,
                appointmentTime: saved.appointment_time,
                address: saved.address,
                message: saved.message
            } : q))
            setAppointmentMessage(`Appointment updated for ${quote.customerName}.`)
            setEditingAppointmentId(null)
            setEditedAppointment({}) // Scrum 87: Clear edits after saving
        } catch (err) {
            console.error('Unexpected failure while updating appointment:', err)
            setAppointmentError('Something went wrong while saving. Check your connection and try again.') // SCRUM-189
        }
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
    // Scrum 150 method: Added Decline button to cancel accepted appointments
    const renderAppointmentCard = (quote) => (
        <div key={quote.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Customer Name:</p>
                    <p style={{ fontSize: '0.9rem' }}>{quote.customerName}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            <div style={{ marginBottom: '1rem' }}>
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

            {/* Scrum 150: Centered Cancel Appointment button below Message */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                    onClick={() => handleDecline(quote.id)}
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
                    Cancel Appointment
                </button>
            </div>

            {/* Scrum 150: Decline reason input prompt for cancelling an accepted appointment */}
            {decliningQuoteId === quote.id && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff5f5', borderRadius: '6px', border: '1px solid #dc3545' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        Reason for cancelling appointment:
                    </p>
                    <textarea
                        value={declineReason}
                        onChange={e => {
                            setDeclineReason(e.target.value)
                            if (declineReasonError) setDeclineReasonError(false)
                        }}
                        rows={2}
                        style={{
                            width: '100%', fontSize: '0.85rem', padding: '0.4rem', borderRadius: '4px',
                            border: declineReasonError ? '2px solid #dc3545' : '1px solid #ccc',
                            resize: 'vertical', marginBottom: '0.5rem'
                        }}
                    />
                    {declineReasonError && (
                        <p style={{ color: '#dc3545', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            A reason is required before you can cancel this appointment.
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => confirmDecline(quote.id)}
                            style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 1rem', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            Confirm Cancellation
                        </button>
                        <button
                            onClick={() => handleDecline(quote.id)}
                            style={{ background: 'none', color: '#333', border: '1px solid #ccc', borderRadius: '6px', padding: '0.35rem 1rem', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            Keep Appointment
                        </button>
                    </div>
                </div>
            )}

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
            {/* SCRUM-142 subtask 189: Visible error for invalid or failed edits */}
            {appointmentError && (
                <p role="alert" style={{ marginTop: '0.8rem', color: '#dc3545', fontSize: '0.9rem' }}>
                    {appointmentError}
                </p>
            )}
        </div>
    )
    // Scrum 128 method: Renders and displays each quote card on screen
    // Scrum 150 method: Updated Accept button to trigger confirmation modal instead of directly accepting
    const renderQuoteCard = (quote) => (
        <div key={quote.id} style={{ width: '100%' }}>
            {/* Accept / Decline buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {quote.status === 'pending' ? (
                    <>
                        {/* Scrum 150: Accept button now triggers handleAcceptClick confirmation modal */}
                        <button
                            onClick={() => handleAcceptClick(quote.id)}
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
                            onClick={() => handleDecline(quote.id)}
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
            {decliningQuoteId === quote.id && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fff5f5', borderRadius: '6px', border: '1px solid #dc3545' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        Reason for declining:
                    </p>
                    <textarea
                        value={declineReason}
                        onChange={e => {
                            setDeclineReason(e.target.value)
                            if (declineReasonError) setDeclineReasonError(false)
                        }}
                        rows={2}
                        style={{
                            width: '100%', fontSize: '0.85rem', padding: '0.4rem', borderRadius: '4px',
                            border: declineReasonError ? '2px solid #dc3545' : '1px solid #ccc',
                            resize: 'vertical', marginBottom: '0.5rem'
                        }}
                    />
                    {declineReasonError && (
                        <p style={{ color: '#dc3545', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            A reason is required before you can decline this quote.
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => confirmDecline(quote.id)}
                            style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 1rem', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            Confirm Decline
                        </button>
                        <button
                            onClick={() => handleDecline(quote.id)}
                            style={{ background: 'none', color: '#333', border: '1px solid #ccc', borderRadius: '6px', padding: '0.35rem 1rem', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

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

    // Scrum 149 method: Renders and displays each declined quote card on screen
    //Scrum 183: Move declined quotes (Manage Quotes) to pending with button
    const renderDeclinedQuoteCard = (quote) => (
        <div key={quote.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <span style={{
                    padding: '0.35rem 1rem', borderRadius: '6px', fontWeight: 'bold',
                    fontSize: '0.85rem', backgroundColor: '#f8d7da', color: '#721c24'
                }}>
                    Declined
                </span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Customer Name:</p>
                <p style={{ fontSize: '0.9rem' }}>{quote.customerName}</p>
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
            <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Message</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.message}</span>
            </div>
            <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline', marginRight: '0.5rem' }}>Decline Reason:</p>
                <span style={{ fontSize: '0.85rem' }}>{quote.declineReason}</span>
            </div>
            {/* Scrum 183: Button triggers the "Are you sure?" modal to verify admin want to move declined quote */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                    onClick={() => handleReopenClick(quote)}
                    style={{
                        backgroundColor: '#1a73e8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.8rem',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                    }}
                >
                    Move to Manage Quotes
                </button>
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

    // SCRUM 172: End the admin's Supabase session before returning to the landing page.
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()

        if (!error) {
            navigate('/', { replace: true })
        }
    }

    const visibleQuotes = paginateQuotes()
    const visibleAppointments = paginateAppointments()
    const allReviews = [...reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const pendingReviews = allReviews.filter(review => !review.approved)
    const approvedReviews = allReviews.filter(review => review.approved)

    if (!isAdmin) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>Checking admin access...</div>
    }
    const visibleDeclinedQuotes = paginateDeclinedQuotes()
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
                padding: '0 1.5rem 2rem',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '1400px',
                margin: '0 auto'
            }}>
                {/* Manage Appointments Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', height: '100%' }}>
                    {/* Manage Appointments Card */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        width: '300px',
                        minWidth: '300px',
                        maxWidth: '300px',
                        flex: '0 0 300px',
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

                        {acceptedQuotes.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>No appointments available.</p>
                        ) : (
                            <>
                                {visibleAppointments.map(quote => renderAppointmentCard(quote))}
                                {renderPagination(currentAppointmentPage, acceptedQuotes.length, APPOINTMENTS_PER_PAGE, handleAppointmentPage)}
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
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px',
                    flex: '0 0 300px',
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
                {/* Declined Quotes Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px',
                    flex: '0 0 300px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '2px solid #5ba3d0'
                }}>
                    <h2 style={{ 
                        fontWeight: 'bold', 
                        fontSize: '1.1rem', 
                        textAlign: 'center', 
                        marginBottom: '1.25rem' 
                    }}>
                        Declined Quotes
                    </h2>

                    {declinedQuotes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>No declined quotes.</p>
                    ) : (
                        <>
                            {visibleDeclinedQuotes.map(quote => renderDeclinedQuoteCard(quote))}
                            {renderPagination(currentDeclinedPage, declinedQuotes.length, DECLINED_QUOTES_PER_PAGE, handleDeclinedPage)}
                        </>
                    )}
                </div>

                {/* Customer Reviews Trigger */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '0.9rem 1.25rem 0.75rem',
                    width: '250px',
                    minWidth: '250px',
                    maxWidth: '250px',
                    flex: '0 0 250px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '2px solid #5ba3d0',
                    textAlign: 'center',
                    alignSelf: 'stretch',
                    height: 'fit-content'
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

            {/* Scrum 150: Confirmation Modal before accepting quote */}
            {acceptingQuoteId && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
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
                        maxWidth: '400px',
                        padding: '1.5rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Accept Quote?</h3>
                        <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1.25rem' }}>
                            Are you sure you want to accept the quote for{' '}
                            <strong>{quotes.find(q => q.id === acceptingQuoteId)?.customerName}</strong>?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                            <button
                                onClick={() => acceptQuote(acceptingQuoteId)}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1.25rem',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Yes, Accept
                            </button>
                            <button
                                onClick={() => setAcceptingQuoteId(null)}
                                style={{
                                    backgroundColor: '#fff',
                                    color: '#333',
                                    border: '1px solid #ccc',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1.25rem',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrum 183: Confirmation Modal Popup for moving a declined quote back to pending */}
            {reopenModalQuote && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyIn: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '400px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#333' }}>
                            Move Quote to Pending?
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                            Are you sure you want to move the quote for <strong>{reopenModalQuote.customerName || reopenModalQuote.customer_name}</strong> back to Pending Quotes?
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={handleConfirmReopen}
                                style={{
                                    backgroundColor: '#1a73e8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1.25rem',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Yes, Move to Manage Quotes
                            </button>
                            <button
                                onClick={() => setReopenModalQuote(null)}
                                style={{
                                    backgroundColor: 'white',
                                    color: '#333',
                                    border: '1px solid #ccc',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1.25rem',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                Sign Out
            </button>
        </div>
    )
}
