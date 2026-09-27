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
        setAppointmentMessage('') // Clear any success message when navigating pages
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
        <div key={review.id} className="admin-review-card">
            <div className="admin-row">
                <strong className="admin-value admin-value--base">{review.customer_name}</strong>
                <div className="admin-inline-group">
                    <span className="admin-stars">{'⭐'.repeat(review.rating)}</span>
                    <span className={`admin-badge admin-badge--pill ${isApproved ? 'admin-badge--success' : 'admin-badge--warning'}`}>
                        {isApproved ? 'Approved' : 'Pending'}
                    </span>
                </div>
            </div>
            <p className="admin-review-text">
                {review.review}
            </p>
            <div className="admin-btn-row">
                <button
                    onClick={() => handleReviewDecision(review.id, true)}
                    className={`admin-btn admin-btn--success${review.approved ? ' is-dimmed' : ''}`}
                >
                    {review.approved ? 'Approved' : 'Approve'}
                </button>
                <button
                    onClick={() => handleReviewDecision(review.id, false)}
                    className={`admin-btn admin-btn--danger${!review.approved ? ' is-dimmed' : ''}`}
                >
                    {review.approved ? 'Reject' : 'Rejected'}
                </button>
            </div>
        </div>
    )

    // Scrum 84 method: Renders and displays each appointment card on screen
    // Scrum 150 method: Added Decline button to cancel accepted appointments
    const renderAppointmentCard = (quote) => (
        <div key={quote.id}>
            <div className="admin-row">
                <div>
                    <p className="admin-label">Customer Name</p>
                    <p className="admin-value admin-value--lead">{quote.customerName}</p>
                </div>
                <div className="admin-inline-group">
                    <button
                        onClick={() => handleEditAppointment(quote.id)}
                        className="admin-btn admin-btn--link"
                    >
                        {editingAppointmentId === quote.id ? 'Cancel' : 'Edit'}{/* Scrum 87: Toggle label based on edit mode */}
                    </button>
                </div>
            </div>

            <div className="admin-field">
                <p className="admin-label">Contact</p>
                <p className="admin-value">{quote.email}</p>
                <p className="admin-value admin-value--muted">{quote.phone}</p>
            </div>
            <div className="admin-field-grid">
                <div>
                    <p className="admin-label">Service</p>
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable service field
                        <input
                            value={editedAppointment.service || ''}
                            onChange={e => setEditedAppointment(prev => ({ ...prev, service: e.target.value }))}
                            className="admin-input admin-input--edit"
                        />
                    ) : (
                        <p className="admin-value">{quote.service}</p>
                    )}
                </div>
                <div>
                    <p className="admin-label">Property</p>
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable property field
                        <input
                            value={editedAppointment.property || ''}
                            onChange={e => setEditedAppointment(prev => ({ ...prev, property: e.target.value }))}
                            className="admin-input admin-input--edit"
                        />
                    ) : (
                        <p className="admin-value">{quote.property}</p>
                    )}
                </div>
                <div>
                    <p className="admin-label">Appointment</p>
                    {editingAppointmentId === quote.id ? ( // Scrum 87: Editable date and time fields
                        <>
                            <input
                                value={editedAppointment.appointmentDate || ''}
                                onChange={e => setEditedAppointment(prev => ({ ...prev, appointmentDate: e.target.value }))}
                                className="admin-input admin-input--edit"
                            />
                            <input
                                value={editedAppointment.appointmentTime || ''}
                                onChange={e => setEditedAppointment(prev => ({ ...prev, appointmentTime: e.target.value }))}
                                className="admin-input admin-input--edit"
                            />
                        </>
                    ) : (
                        <>
                            <p className="admin-value">{quote.appointmentDate}</p>
                            <p className="admin-value">{quote.appointmentTime}</p>
                        </>
                    )}
                </div>
            </div>
            <div className="admin-field">
                <p className="admin-label">Address</p>
                {editingAppointmentId === quote.id ? ( // Scrum 87: Editable address field
                    <input
                        value={editedAppointment.address || ''}
                        onChange={e => setEditedAppointment(prev => ({ ...prev, address: e.target.value }))}
                        className="admin-input admin-input--edit"
                    />
                ) : (
                    <p className="admin-value">{quote.address}</p>
                )}
            </div>
            <div className="admin-field">
                <p className="admin-label">Message</p>
                {editingAppointmentId === quote.id ? ( // Scrum 87: Editable message field
                    <textarea
                        value={editedAppointment.message || ''}
                        onChange={e => setEditedAppointment(prev => ({ ...prev, message: e.target.value }))}
                        className="admin-textarea admin-input--edit"
                    />
                ) : (
                    <p className="admin-value">{quote.message}</p>
                )}
            </div>

            {/* Scrum 150: Centered Cancel Appointment button below Message */}
            <div className="admin-btn-row">
                <button
                    onClick={() => handleDecline(quote.id)}
                    className="admin-btn admin-btn--danger"
                >
                    Cancel Appointment
                </button>
            </div>

            {/* Scrum 150: Decline reason input prompt for cancelling an accepted appointment */}
            {decliningQuoteId === quote.id && (
                <div className="admin-callout admin-callout--below">
                    <p className="admin-label">
                        Reason for cancelling appointment:
                    </p>
                    <textarea
                        value={declineReason}
                        onChange={e => {
                            setDeclineReason(e.target.value)
                            if (declineReasonError) setDeclineReasonError(false)
                        }}
                        rows={2}
                        className={`admin-textarea${declineReasonError ? ' is-invalid' : ''}`}
                    />
                    {declineReasonError && (
                        <p className="admin-error-text">
                            A reason is required before you can cancel this appointment.
                        </p>
                    )}
                    <div className="admin-btn-row">
                        <button
                            onClick={() => confirmDecline(quote.id)}
                            className="admin-btn admin-btn--danger"
                        >
                            Confirm Cancellation
                        </button>
                        <button
                            onClick={() => handleDecline(quote.id)}
                            className="admin-btn admin-btn--ghost"
                        >
                            Keep Appointment
                        </button>
                    </div>
                </div>
            )}

            {editingAppointmentId === quote.id && (
                <p className="admin-note admin-note--info">
                    Editing appointment details for {quote.customerName}.
                </p>
            )}
            {appointmentMessage && (
                <p className="admin-note admin-note--success">
                    {appointmentMessage}
                </p>
            )}
            {/* SCRUM-142 subtask 189: Visible error for invalid or failed edits */}
            {appointmentError && (
                <p role="alert" className="admin-note admin-note--danger">
                    {appointmentError}
                </p>
            )}
        </div>
    )
    // Scrum 128 / 149: the read-only detail rows shared by the pending-quote
    // and declined-quote cards. Kept in one place so the two stay in step.
    const renderQuoteDetails = (quote) => (
        <>
            <div className="admin-field">
                <p className="admin-label">Customer Name</p>
                <p className="admin-value admin-value--lead">{quote.customerName}</p>
            </div>

            <div className="admin-field">
                <p className="admin-label">Contact</p>
                <p className="admin-value">{quote.email}</p>
                <p className="admin-value admin-value--muted">{quote.phone}</p>
            </div>

            <div className="admin-field-grid">
                <div>
                    <p className="admin-label">Service</p>
                    <p className="admin-value">{quote.service}</p>
                </div>
                <div>
                    <p className="admin-label">Property</p>
                    <p className="admin-value">{quote.property}</p>
                </div>
                <div>
                    <p className="admin-label">Appointment</p>
                    <p className="admin-value">{quote.appointmentDate}</p>
                    <p className="admin-value">{quote.appointmentTime}</p>
                </div>
            </div>

            <div className="admin-field">
                <p className="admin-label">Address</p>
                <p className="admin-value">{quote.address}</p>
            </div>

            <div className="admin-field">
                <p className="admin-label">Message</p>
                <p className="admin-value">{quote.message}</p>
            </div>
        </>
    )

    // Scrum 128 method: Renders and displays each quote card on screen
    // Scrum 150 method: Updated Accept button to trigger confirmation modal instead of directly accepting
    const renderQuoteCard = (quote) => (
        <div key={quote.id}>
            {/* Accept / Decline buttons */}
            <div className="admin-btn-row">
                {quote.status === 'pending' ? (
                    <>
                        {/* Scrum 150: Accept button now triggers handleAcceptClick confirmation modal */}
                        <button
                            onClick={() => handleAcceptClick(quote.id)}
                            className="admin-btn admin-btn--success"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => handleDecline(quote.id)}
                            className="admin-btn admin-btn--danger"
                        >
                            Decline
                        </button>
                    </>
                ) : (
                    <span className={`admin-badge ${quote.status === 'accepted' ? 'admin-badge--success' : 'admin-badge--danger'}`}>
                        {quote.status === 'accepted' ? 'Accepted' : 'Declined'}
                    </span>
                )}
            </div>
            {decliningQuoteId === quote.id && (
                <div className="admin-callout">
                    <p className="admin-label">
                        Reason for declining:
                    </p>
                    <textarea
                        value={declineReason}
                        onChange={e => {
                            setDeclineReason(e.target.value)
                            if (declineReasonError) setDeclineReasonError(false)
                        }}
                        rows={2}
                        className={`admin-textarea${declineReasonError ? ' is-invalid' : ''}`}
                    />
                    {declineReasonError && (
                        <p className="admin-error-text">
                            A reason is required before you can decline this quote.
                        </p>
                    )}
                    <div className="admin-btn-row">
                        <button
                            onClick={() => confirmDecline(quote.id)}
                            className="admin-btn admin-btn--danger"
                        >
                            Confirm Decline
                        </button>
                        <button
                            onClick={() => handleDecline(quote.id)}
                            className="admin-btn admin-btn--ghost"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {renderQuoteDetails(quote)}
        </div>
    )

    // Scrum 149 method: Renders and displays each declined quote card on screen
    //Scrum 183: Move declined quotes (Manage Quotes) to pending with button
    const renderDeclinedQuoteCard = (quote) => (
        <div key={quote.id}>
            <div className="admin-btn-row">
                <span className="admin-badge admin-badge--danger">
                    Declined
                </span>
            </div>
            {renderQuoteDetails(quote)}
            <div className="admin-field">
                <p className="admin-label">Decline Reason</p>
                <p className="admin-value">{quote.declineReason}</p>
            </div>
            {/* Scrum 183: Button triggers the "Are you sure?" modal to verify admin want to move declined quote */}
            <div className="admin-btn-row">
                <button
                    onClick={() => handleReopenClick(quote)}
                    className="admin-btn admin-btn--primary"
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
            <div className="admin-pagination">
                <button onClick={() => onPageChange('prev')} disabled={currentPage === 1}>
                    ‹
                </button>
                <span className="admin-pagination-label">
                    Page {currentPage}/{totalPages}
                </span>
                <button onClick={() => onPageChange('next')} disabled={currentPage === totalPages}>
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
        return <div className="admin-loading">Checking admin access...</div>
    }
    const visibleDeclinedQuotes = paginateDeclinedQuotes()
    // Main return
    return (
        <div className="admin-page">
            {/* SCRUM 172 / 187: admin masthead. Scrum 39 keeps the marketing
                header off /admin, so the dashboard carries its own minimal nav.
                Uses the shared .button/.button-alt classes so the controls match
                the header actions on every other page. */}
            <header className="admin-header">
                <nav className="admin-nav" aria-label="Admin">
                    <Link to="/" className="button button-alt">Home</Link>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="button button-alt"
                    >
                        Sign Out
                    </button>
                </nav>
            </header>

            <section className="section admin-section">
                <div className="container admin-intro">
                    <p className="admin-eyebrow">
                        Admin Portal
                    </p>
                    <h1 className="section-title">Welcome</h1>
                    <p className="section-subtitle">
                        Admin Dashboard
                    </p>
                </div>
            </section>

            {/* Dashboard Cards */}
            <div className="admin-grid">
                {/* Manage Appointments Section */}
                {/* Manage Appointments Card */}
                {/* Scrum 87: is-editing swaps the panel to the blue editing border */}
                <div className={`admin-panel admin-panel--appointments${editingAppointmentId ? ' is-editing' : ''}`}>
                    <h2 className="admin-panel-title">
                        Manage Appointments
                    </h2>

                    {acceptedQuotes.length === 0 ? (
                        <p className="admin-empty">No appointments available.</p>
                    ) : (
                        <>
                            {visibleAppointments.map(quote => renderAppointmentCard(quote))}
                            {renderPagination(currentAppointmentPage, acceptedQuotes.length, APPOINTMENTS_PER_PAGE, handleAppointmentPage)}
                        </>
                    )}

                    {/* Update Appointment Button */}
                    <button
                        onClick={() => editingAppointmentId && handleUpdateAppointment(editingAppointmentId)} // Scrum 87: Update whichever appointment is being edited
                        disabled={!editingAppointmentId} // Scrum 87: Only enabled when an appointment is in edit mode
                        className="admin-btn admin-btn--pill"
                    >
                        Update Appointment
                    </button>
                </div>

                {/* Manage Quotes Card */}
                <div className="admin-panel admin-panel--quotes">
                    <h2 className="admin-panel-title">
                        Manage Quotes
                    </h2>

                    {quotes.length === 0 ? (
                        <p className="admin-empty">No quotes available.</p>
                    ) : (
                        <>
                            {visibleQuotes.map(quote => renderQuoteCard(quote))}
                            {renderPagination(currentQuotePage, quotes.length, QUOTES_PER_PAGE, handleNextPage)}
                        </>
                    )}
                </div>

                {/* Declined Quotes Card */}
                <div className="admin-panel admin-panel--declined">
                    <h2 className="admin-panel-title">
                        Declined Quotes
                    </h2>

                    {declinedQuotes.length === 0 ? (
                        <p className="admin-empty">No declined quotes.</p>
                    ) : (
                        <>
                            {visibleDeclinedQuotes.map(quote => renderDeclinedQuoteCard(quote))}
                            {renderPagination(currentDeclinedPage, declinedQuotes.length, DECLINED_QUOTES_PER_PAGE, handleDeclinedPage)}
                        </>
                    )}
                </div>

                {/* Customer Reviews Trigger */}
                <div className="admin-panel admin-panel--reviews admin-panel--compact">
                    <h2 className="admin-panel-title">
                        Customer Reviews
                    </h2>

                    {reviewMessage && (
                        <p className="admin-note admin-note--success">
                            {reviewMessage}
                        </p>
                    )}

                    <button
                        onClick={() => setShowReviewsModal(true)}
                        className="admin-btn admin-btn--primary"
                    >
                        View Review Table
                    </button>
                </div>
            </div>

            {/* Scrum 150: Confirmation Modal before accepting quote */}
            {acceptingQuoteId && (
                <div className="admin-modal">
                    <div className="admin-modal-box">
                        <h3 className="admin-modal-title">Accept Quote?</h3>
                        <p className="admin-modal-text">
                            Are you sure you want to accept the quote for{' '}
                            <strong>{quotes.find(q => q.id === acceptingQuoteId)?.customerName}</strong>?
                        </p>
                        <div className="admin-btn-row">
                            <button
                                onClick={() => acceptQuote(acceptingQuoteId)}
                                className="admin-btn admin-btn--success admin-btn--lg"
                            >
                                Yes, Accept
                            </button>
                            <button
                                onClick={() => setAcceptingQuoteId(null)}
                                className="admin-btn admin-btn--ghost admin-btn--lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrum 183: Confirmation Modal Popup for moving a declined quote back to pending */}
            {reopenModalQuote && (
                <div className="admin-modal">
                    <div className="admin-modal-box">
                        <h3 className="admin-modal-title">
                            Move Quote to Pending?
                        </h3>
                        <p className="admin-modal-text">
                            Are you sure you want to move the quote for <strong>{reopenModalQuote.customerName || reopenModalQuote.customer_name}</strong> back to Pending Quotes?
                        </p>
                        <div className="admin-btn-row">
                            <button
                                onClick={handleConfirmReopen}
                                className="admin-btn admin-btn--primary admin-btn--lg"
                            >
                                Yes, Move to Manage Quotes
                            </button>
                            <button
                                onClick={() => setReopenModalQuote(null)}
                                className="admin-btn admin-btn--ghost admin-btn--lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReviewsModal && (
                <div className="admin-modal">
                    <div className="admin-modal-box admin-modal-box--wide admin-modal-box--scroll">
                        <div className="admin-row">
                            <h3 className="admin-modal-title">Customer Reviews</h3>
                            <button
                                onClick={() => setShowReviewsModal(false)}
                                className="admin-btn admin-btn--close"
                            >
                                ×
                            </button>
                        </div>

                        {loadingReviews ? (
                            <p className="admin-empty">Loading reviews...</p>
                        ) : allReviews.length === 0 ? (
                            <p className="admin-empty">No reviews available.</p>
                        ) : (
                            <div className="admin-review-groups">
                                <div>
                                    <h4 className="admin-review-group-title admin-review-group-title--pending">Pending Reviews</h4>
                                    {pendingReviews.length === 0 ? (
                                        <p className="admin-empty">No pending reviews.</p>
                                    ) : (
                                        <div className="admin-review-list">
                                            {pendingReviews.map(review => renderReviewCard(review, false))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h4 className="admin-review-group-title admin-review-group-title--approved">Approved Reviews</h4>
                                    {approvedReviews.length === 0 ? (
                                        <p className="admin-empty">No approved reviews.</p>
                                    ) : (
                                        <div className="admin-review-list">
                                            {approvedReviews.map(review => renderReviewCard(review, true))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    )
}
