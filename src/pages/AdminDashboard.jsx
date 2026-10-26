import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import ServicePhotosManager from '../components/ServicePhotosManager'

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
    // SCRUM-215: Private completion metadata keeps accepted rows and review links intact.
    const [completedAppointments, setCompletedAppointments] = useState([])
    const [currentCompletedPage, setCurrentCompletedPage] = useState(1)
    const [completionNotes, setCompletionNotes] = useState({})
    const [completingAppointmentId, setCompletingAppointmentId] = useState(null)
    const [completionBusy, setCompletionBusy] = useState(false)
    const [completionError, setCompletionError] = useState('')
    const [completionMessage, setCompletionMessage] = useState('')
    const [appointmentsLoadError, setAppointmentsLoadError] = useState('')
    const appointmentRequest = useRef(0)
    const completionInFlight = useRef(false)
    const [currentQuotePage, setCurrentQuotePage] = useState(1)
    const [currentAppointmentPage, setCurrentAppointmentPage] = useState(1) // Scrum 84: Appointment page state
    const [editingAppointmentId, setEditingAppointmentId] = useState(null) // Scrum 84: Editing appointment state
    const [appointmentError, setAppointmentError] = useState('') // SCRUM-142 Subtask 189: Visible error for invalid or failed appointment edits
    const [appointmentMessage, setAppointmentMessage] = useState('') // Scrum 84: Appointment message state
    const [editedAppointment, setEditedAppointment] = useState({}) // Scrum 87: Tracks in-progress field edits
    const [pendingSync, setPendingSync] = useState(null) // SCRUM-184: { quoteId, previous, customerName } when an email sync failed and can be retried
    const [declinedQuotes, setDeclinedQuotes] = useState([])       // Scrum 149: Holds declined quotes fetched from the archive table
    const [currentDeclinedPage, setCurrentDeclinedPage] = useState(1)   // Scrum 149: Current page for Declined Quotes pagination
    const [decliningQuoteId, setDecliningQuoteId] = useState(null) // Scrum 149: Which quote's reason prompt is open
    const [declineReason, setDeclineReason] = useState('')  // Scrum 149: In-progress text for the decline reason field
    const [declineReasonError, setDeclineReasonError] = useState(false) // Scrum 149: Drives the required-field highlight
    const [reviews, setReviews] = useState([])
    const [showServicePhotosModal, setShowServicePhotosModal] = useState(false) // SCRUM-204
    const [loadingReviews, setLoadingReviews] = useState(true)
    const [reviewMessage, setReviewMessage] = useState('')
    const [showReviewsModal, setShowReviewsModal] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    // Scrum 150: State to track which quote is awaiting confirmation to accept
    const [acceptingQuoteId, setAcceptingQuoteId] = useState(null)
    // Scrum 183: State to track which declined quote is awaiting confirmation to move to pending
    const [reopenModalQuote, setReopenModalQuote] = useState(null)

    // Scrum 179: State variables for Admin Settings modal and password reset
    const [showAdminSettingsModal, setShowAdminSettingsModal] = useState(false)
    const [adminPassword, setAdminPassword] = useState('')
    const [adminConfirmPassword, setAdminConfirmPassword] = useState('')
    const [adminPasswordError, setAdminPasswordError] = useState('')
    const [adminPasswordSuccess, setAdminPasswordSuccess] = useState('')
    const [showAdminPassword, setShowAdminPassword] = useState(false) // SCRUM-212
    const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false) // SCRUM-212
    const [isSubmittingAdminPassword, setIsSubmittingAdminPassword] = useState(false)

    // Scrum 218: State variables for search query, search visibility toggle, category, and dropdown state
    const [showSearchBar, setShowSearchBar] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchCategory, setSearchCategory] = useState('name') // 'name', 'city', 'service', 'property', 'date', 'time'
    const [showCategoryMenu, setShowCategoryMenu] = useState(false)

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
        fetchDeclinedQuotes()
    }, [navigate])

    // SCRUM-215: Refresh after authorization, every 30 seconds, and on return to the tab.
    // Cron also completes jobs independently while this page is closed.
    useEffect(() => {
        if (!isAdmin) return
        const refresh = () => {
            if (!completionInFlight.current) fetchAcceptedQuotes()
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh()
        }
        refresh()
        const timer = window.setInterval(refresh, 30000)
        window.addEventListener('focus', refresh)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.clearInterval(timer)
            window.removeEventListener('focus', refresh)
            document.removeEventListener('visibilitychange', onVisible)
            appointmentRequest.current += 1
        }
    }, [isAdmin])

    // Scrum 88 / 215: Read the original appointments with their admin-only completion data.
    const fetchAcceptedQuotes = async () => {
        const request = ++appointmentRequest.current
        try {
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
                    status,
                    completion:appointment_completions (
                        completedAt:completed_at,
                        completionNote:completion_note,
                        autoCompletionPaused:auto_completion_paused
                    )
                `)
                .eq('status', 'accepted')
                .order('accepted_at', { ascending: true })

            if (request !== appointmentRequest.current) return false
            if (error) {
                console.error('Error fetching accepted quotes:', error.message)
                setAppointmentsLoadError('Unable to load appointments. Please refresh and try again.')
                return false
            }
            setAppointmentsLoadError('')
            const appointments = (data || []).map(({ completion, ...quote }) => ({
                ...quote,
                completedAt: completion?.completedAt ?? null,
                completionNote: completion?.completionNote ?? '',
                autoCompletionPaused: completion?.autoCompletionPaused ?? false
            }))
            setAcceptedQuotes(appointments.filter(q => !q.completedAt))
            setCompletedAppointments(appointments.filter(q => q.completedAt)
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)))
            return true
        } catch (error) {
            if (request === appointmentRequest.current) {
                setAppointmentsLoadError('Unable to load appointments. Please check your connection and try again.')
            }
            return false
        }
    }

    // SCRUM-215: The server validates admin access and locks the row before changes.
    const updateCompletion = async (quote, action) => {
        if (completionInFlight.current) return
        completionInFlight.current = true
        appointmentRequest.current += 1
        setCompletionBusy(true)
        setCompletionError('')
        setCompletionMessage('')
        try {
            const { error } = await supabase.rpc('scrum215_update_completion', {
                p_action: action,
                p_appointment_id: quote.id,
                p_note: action === 'restore' ? null : (completionNotes[quote.id] ?? quote.completionNote ?? '').trim()
            })
            if (error) throw error
            setCompletionNotes(prev => {
                const next = { ...prev }
                delete next[quote.id]
                return next
            })
            setCompletingAppointmentId(null)
            const refreshed = await fetchAcceptedQuotes()
            setCompletionMessage(action === 'restore'
                ? 'Appointment returned to Manage Appointments.'
                : action === 'note' ? 'Completion note saved.' : 'Appointment moved to Completed Appointments.')
            if (!refreshed) setCompletionError('The change was saved, but the lists could not reload. Please refresh before making another change.')
        } catch (error) {
            setCompletionError(error.message || 'Unable to save the appointment. Please try again.')
        } finally {
            completionInFlight.current = false
            setCompletionBusy(false)
        }
    }

    // Scrum 218: Helper function for dynamic filtering based on selected category
    // Scrum 219: Adds the time, in Supabase the time is as a 24 hour clock but this converts it to 12 hours with AM/PM
    const matchesSearch = (item) => {
        if (!showSearchBar) return true
        const query = searchQuery.trim().toLowerCase()
        if (!query) return true
        switch (searchCategory) {
            case 'city':
                return (item.address || '').toLowerCase().includes(query)
            case 'service':
                return (item.service || '').toLowerCase().includes(query)
            case 'property':
                return (item.property || '').toLowerCase().includes(query)
            case 'date':
                return (item.appointmentDate || '').toLowerCase().includes(query)
            case 'time': { 
                // Scrum 219: Flexible time search matching by hour (supports AM/PM and 24-hour format)
                if (!item.appointmentTime) return false
                const dbTimeStr = item.appointmentTime.trim().toLowerCase()
                
                // Extract database hours (e.g., '23:52:00' -> hour 23)
                const dbParts = dbTimeStr.split(':')
                const dbHour = parseInt(dbParts[0], 10)

                let queryStr = query
                let targetHour = null
                let hasAmPm = queryStr.includes('pm') || queryStr.includes('am')

                if (hasAmPm) {
                    const isPm = queryStr.includes('pm')
                    const timeOnly = queryStr.replace(/(am|pm)/g, '').trim()
                    const parts = timeOnly.split(':')
                    targetHour = parseInt(parts[0], 10)

                    if (!isNaN(targetHour)) {
                        if (isPm && targetHour < 12) targetHour += 12
                        if (!isPm && targetHour === 12) targetHour = 0
                    }
                } else {
                    // 24-hour format or partial input (e.g., '23:00' or '23')
                    const parts = queryStr.split(':')
                    targetHour = parseInt(parts[0], 10)
                }

                if (isNaN(targetHour)) {
                    return dbTimeStr.includes(queryStr)
                }

                // Scrum 219: Matches appointments within the same hour (e.g., '11:00 PM' / hour 23 matches '23:52:00')
                return dbHour === targetHour
            }
            case 'name':
            default:
                return (item.customerName || '').toLowerCase().includes(query)
        }
    }

    // Scrum 218: Filtered collections across all 3 tables
    const filteredQuotes = quotes.filter(matchesSearch)
    const filteredAcceptedQuotes = acceptedQuotes.filter(matchesSearch)
    const filteredDeclinedQuotes = declinedQuotes.filter(matchesSearch)
    const filteredCompletedAppointments = completedAppointments.filter(matchesSearch)

    // Scrum 218: Reset pagination pages when search term, visibility, or category changes
    useEffect(() => {
        setCurrentQuotePage(1)
        setCurrentAppointmentPage(1)
        setCurrentDeclinedPage(1)
        setCurrentCompletedPage(1)
    }, [searchQuery, searchCategory, showSearchBar])

    // SCRUM-215: A move or automatic refresh can remove the last item on a page.
    useEffect(() => {
        setCurrentAppointmentPage(page => Math.max(1, Math.min(page, Math.ceil(filteredAcceptedQuotes.length / APPOINTMENTS_PER_PAGE))))
        setCurrentCompletedPage(page => Math.max(1, Math.min(page, Math.ceil(filteredCompletedAppointments.length / APPOINTMENTS_PER_PAGE))))
    }, [filteredAcceptedQuotes.length, filteredCompletedAppointments.length])

    useEffect(() => {
        if (editingAppointmentId && !acceptedQuotes.some(q => q.id === editingAppointmentId)) {
            setEditingAppointmentId(null)
            setEditedAppointment({})
        }
        if (completingAppointmentId && !acceptedQuotes.some(q => q.id === completingAppointmentId)) {
            setCompletingAppointmentId(null)
        }
    }, [acceptedQuotes, editingAppointmentId, completingAppointmentId])

    // Scrum 128 method: Returns the quotes for current page
    const paginateQuotes = () => {
        const start = (currentQuotePage - 1) * QUOTES_PER_PAGE
        return filteredQuotes.slice(start, start + QUOTES_PER_PAGE)
    }
    // Scrum 84 method: Returns the appointments for current page
    const paginateAppointments = () => {
        const start = (currentAppointmentPage - 1) * APPOINTMENTS_PER_PAGE
        return filteredAcceptedQuotes.slice(start, start + APPOINTMENTS_PER_PAGE)
    }
    // Scrum 149 method: Returns declined quotes for the current page
    const paginateDeclinedQuotes = () => {
        const start = (currentDeclinedPage - 1) * DECLINED_QUOTES_PER_PAGE
        return filteredDeclinedQuotes.slice(start, start + DECLINED_QUOTES_PER_PAGE)
    }
    // Scrum 128 method: Navigates between quote pages
    const handleNextPage = (direction) => {
        const totalPages = Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE)
        setCurrentQuotePage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
    }
    // Scrum 84 method: Navigates between appointment pages
    const handleAppointmentPage = (direction) => {
        const totalPages = Math.ceil(filteredAcceptedQuotes.length / APPOINTMENTS_PER_PAGE)
        setCurrentAppointmentPage(prev => {
            if(direction === 'next') return Math.min(prev + 1, totalPages)
            if(direction === 'prev') return Math.max(prev - 1, 1)
        })
        setEditingAppointmentId(null) // Scrum 87: Cancel edit mode when navigating pages
        setEditedAppointment({}) // Scrum 87: Clear in-progress edits when navigating pages
        setAppointmentMessage('') // Clear any success message when navigating pages
        setAppointmentError('') // SCRUM-142 sub task 189: Clear any edit error when navigating pages
        setPendingSync(null) // SCRUM-184: Retry belongs to the card that failed
    }
    // Scrum 149 method: Navigates between declined quote pages
    const handleDeclinedPage = (direction) => {
        const totalPages = Math.ceil(filteredDeclinedQuotes.length / DECLINED_QUOTES_PER_PAGE)
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

        // SCRUM-184: Email both sides while the row still exists (the edge function reads it).
        // A failure doesn't block the cancellation; the admin is told to contact the client by hand.
        let syncProblems = []
        if (!isDemoAdmin()) {
            try {
                syncProblems = await invokeAppointmentSync({ quoteId: quoteID, mode: 'cancel', reason })
            } catch (err) {
                console.error('SCRUM-184: sync-appointment cancel call failed:', err)
                syncProblems = ['the emails could not be sent']
            }
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
        setPendingSync(null)

        // SCRUM-184: The card is gone, so a failure needs an alert rather than an inline note
        if (syncProblems.length > 0) {
            alert(`Appointment for ${appointment.customerName} was cancelled, but ${syncProblems.join('; ')}. Let the client know by hand.`)
        }

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
        setPendingSync(null)
    }

    // SCRUM-184: The localStorage demo login has no Supabase session, so the edge function can't be called
    const isDemoAdmin = () => typeof window !== 'undefined' && localStorage.getItem('prasad-admin-demo-access') === 'true'

    // SCRUM-184: Calls the sync-appointment edge function and returns a list of what went wrong (empty = all good)
    const invokeAppointmentSync = async (body) => {
        const { data, error } = await supabase.functions.invoke('sync-appointment', { body })
        if (error) {
            let detail = error.message
            try {
                const errorBody = await error.context?.json()
                if (errorBody?.error) detail = errorBody.error
            } catch { /* response had no JSON body */ }
            return [`email sending failed (${detail})`]
        }
        const problems = []
        // SCRUM-199: On a reschedule the client email is skipped on purpose (notify-appointment-updated sends it)
        if (!data?.clientEmail?.sent && !data?.clientEmail?.skipped) problems.push('the client email was not sent')
        if (!data?.adminEmail?.sent) problems.push("Nigel's email was not sent")
        return problems
    }

    // SCRUM-184: Emails the client and Nigel about the saved time
    const syncAppointmentTime = async (quoteID, previous, customerName) => {
        if (isDemoAdmin()) {
            setAppointmentMessage(`Appointment updated for ${customerName}. Emails unavailable in demo mode.`)
            return
        }
        setAppointmentMessage(`Appointment updated for ${customerName}. Sending emails…`)
        try {
            const problems = await invokeAppointmentSync({ quoteId: quoteID, mode: 'schedule', previous })
            if (problems.length === 0) {
                setAppointmentMessage(`Appointment updated for ${customerName}. Emails sent.`)
                setPendingSync(null)
                return
            }
            setAppointmentMessage('')
            setAppointmentError(`Saved, but ${problems.join('; ')}.`)
        } catch (err) {
            console.error('SCRUM-184: sync-appointment call failed:', err)
            setAppointmentMessage('')
            setAppointmentError('Saved, but the emails could not be sent. Check your connection and retry.')
        }
        setPendingSync({ quoteId: quoteID, previous, customerName })
    }

    // SCRUM-184: Re-saving an unchanged time stops at "No changes", so retry calls the sync directly
    const handleRetrySync = () => {
        if (!pendingSync) return
        setAppointmentError('')
        syncAppointmentTime(pendingSync.quoteId, pendingSync.previous, pendingSync.customerName)
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

        // SCRUM-184: A changed date or time is emailed to the client, so it can't be in the past
        const timeChanged = 'appointment_date' in changes || 'appointment_time' in changes
        if (timeChanged) {
            const date = normalize(editedAppointment.appointmentDate)
            const time = normalize(editedAppointment.appointmentTime)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
                setAppointmentError('Pick both an appointment date and time.')
                return
            }
            if (new Date(`${date}T${time.slice(0, 5)}`) <= new Date()) {
                setAppointmentError('Appointment time must be in the future.')
                return
            }
        }
        setPendingSync(null)

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
                message: saved.message,
                completedAt: timeChanged ? null : q.completedAt,
                autoCompletionPaused: timeChanged ? false : q.autoCompletionPaused
            } : q))
            setAppointmentMessage(`Appointment updated for ${quote.customerName}.`)
            setEditingAppointmentId(null)
            setEditedAppointment({}) // Scrum 87: Clear edits after saving

            // SCRUM-184: Email the new time to the client and Nigel
            if (timeChanged) {
                await syncAppointmentTime(quoteID, { date: quote.appointmentDate, time: quote.appointmentTime }, quote.customerName)
            }
        } catch (err) {
            console.error('Unexpected failure while updating appointment:', err)
            setAppointmentError('Something went wrong while saving. Check your connection and try again.') // SCRUM-189
        }
    }

    // Scrum 179: Toggle Admin Settings Modal
    const toggleAdminSettingsModal = () => {
        setShowAdminSettingsModal(prev => !prev)
        setAdminPassword('')
        setAdminConfirmPassword('')
        setAdminPasswordError('')
        setAdminPasswordSuccess('')
    }

    // Scrum 179: Submits password update to Supabase Auth for logged-in admin
    const handleAdminPasswordChange = async (e) => {
        e.preventDefault()
        setAdminPasswordError('')
        setAdminPasswordSuccess('')

        if (adminPassword.length < 8) {
            setAdminPasswordError('Password must be at least 8 characters long.')
            return
        }

        if (adminPassword !== adminConfirmPassword) {
            setAdminPasswordError('Passwords do not match.')
            return
        }

        setIsSubmittingAdminPassword(true)

        const { error } = await supabase.auth.updateUser({ password: adminPassword })

        setIsSubmittingAdminPassword(false)

        if (error) {
            setAdminPasswordError(error.message)
            return
        }

        setAdminPasswordSuccess('Admin password updated successfully!')
        setTimeout(() => {
            toggleAdminSettingsModal()
        }, 1500)
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
    // Scrum 200: Added admin-card-body wrapper class to separate card content from pagination
    const renderAppointmentCard = (quote) => (
        <div key={quote.id} className="admin-card-body">{/* Scrum 200 */}
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
                            {/* SCRUM-184: Real pickers so the value is always YYYY-MM-DD / HH:MM */}
                            <input
                                type="date"
                                value={editedAppointment.appointmentDate || ''}
                                onChange={e => setEditedAppointment(prev => ({ ...prev, appointmentDate: e.target.value }))}
                                className="admin-input admin-input--edit"
                            />
                            <input
                                type="time"
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

            {/* SCRUM-215: Manual completion also supports correcting a restored job. */}
            {editingAppointmentId !== quote.id && (
                <div className="admin-btn-row">
                    <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        disabled={completionBusy}
                        onClick={() => setCompletingAppointmentId(completingAppointmentId === quote.id ? null : quote.id)}
                    >
                        {completingAppointmentId === quote.id ? 'Cancel Completion' : 'Mark Completed'}
                    </button>
                </div>
            )}
            {completingAppointmentId === quote.id && editingAppointmentId !== quote.id && (
                <div className="admin-callout admin-callout--below">
                    <label className="admin-label" htmlFor={`complete-note-${quote.id}`}>Completion note (optional)</label>
                    <textarea
                        id={`complete-note-${quote.id}`}
                        className="admin-textarea"
                        rows={3}
                        maxLength={4000}
                        disabled={completionBusy}
                        value={completionNotes[quote.id] ?? quote.completionNote ?? ''}
                        onChange={e => setCompletionNotes(prev => ({ ...prev, [quote.id]: e.target.value }))}
                    />
                    <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        disabled={completionBusy}
                        onClick={() => updateCompletion(quote, 'complete')}
                    >
                        Confirm Completion
                    </button>
                </div>
            )}

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
            {/* SCRUM-184: Retry a failed email sync without re-saving */}
            {pendingSync?.quoteId === quote.id && (
                <div className="admin-btn-row">
                    <button onClick={handleRetrySync} className="admin-btn admin-btn--ghost">
                        Retry sync
                    </button>
                </div>
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
    // Scrum 200: Added admin-card-body wrapper class to separate card content from pagination
    const renderQuoteCard = (quote) => (
        <div key={quote.id} className="admin-card-body">{/* Scrum 200 */}
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
    // Scrum 200: Added admin-card-body wrapper class to separate card content from pagination
    const renderDeclinedQuoteCard = (quote) => (
        <div key={quote.id} className="admin-card-body">{/* Scrum 200 */}
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

    // SCRUM-215: Separate saved job notes from the customer's original message.
    const renderCompletedAppointmentCard = (quote) => (
        <div key={quote.id} className="admin-card-body">
            <span className="admin-badge admin-badge--success">Completed</span>
            {renderQuoteDetails(quote)}
            <div className="admin-field">
                <p className="admin-label">Marked completed (Pacific time)</p>
                <p className="admin-value">{new Date(quote.completedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</p>
            </div>
            <div className="admin-field">
                <label className="admin-label" htmlFor={`completed-note-${quote.id}`}>Completion note</label>
                <textarea
                    id={`completed-note-${quote.id}`}
                    className="admin-textarea"
                    rows={3}
                    maxLength={4000}
                    disabled={completionBusy}
                    value={completionNotes[quote.id] ?? quote.completionNote ?? ''}
                    onChange={e => setCompletionNotes(prev => ({ ...prev, [quote.id]: e.target.value }))}
                />
            </div>
            <div className="admin-btn-row">
                <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={completionBusy || (completionNotes[quote.id] ?? quote.completionNote ?? '').trim() === (quote.completionNote ?? '')}
                    onClick={() => updateCompletion(quote, 'note')}
                >
                    Save Note
                </button>
                <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={completionBusy}
                    onClick={() => updateCompletion(quote, 'restore')}
                >
                    Remove from Completed
                </button>
            </div>
        </div>
    )

    // Scrum 128 method: Shows the arrows to navigate
    const renderPagination = (currentPage, totalItems, itemsPerPage, onPageChange) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage)
        if (totalPages <= 1) return null // Hide pagination if 1 or 0 pages
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
    const visibleDeclinedQuotes = paginateDeclinedQuotes()

    const allReviews = [...reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const pendingReviews = allReviews.filter(review => !review.approved)
    const approvedReviews = allReviews.filter(review => review.approved)

    // Scrum 218: Labels mapping for display in the category selector button
    // Scrum 219: Added appointment time label for time filtering search
    const categoryLabels = {
        name: 'Customer Name',
        city: 'City / Address',
        service: 'Service',
        property: 'Property Type',
        date: 'Appointment Date',
        time: 'Appointment Time' 
    }

    if (!isAdmin) {
        return <div className="admin-loading">Checking admin access...</div>
    }

    // Main return
    return (
        <div className="admin-page">
            {/* Scrum 200: Inject styles to fix pagination arrow positions across categories */}
            <style>{`
                /* Scrum 200: Enforce unified panel height and flex column alignment */
                .admin-panel {
                    display: flex !important;
                    flex-direction: column !important;
                    height: 100% !important;
                }
                /* Scrum 200: Ensure quote content expands flexibly & allows scrolling for extra long messages */
                .admin-card-body {
                    flex: 1 1 auto !important;
                    overflow-y: auto !important; /* Scrum 200: Adds vertical scrollbar if content exceeds max height */
                    max-height: 600px !important;  /* Scrum 200: Set to 600px for extra space while maintaining uniform card height */
                }
                /* Scrum 200: Pin pagination controls to bottom of panel at a fixed position */
                .admin-pagination {
                    margin-top: auto !important;
                    padding-top: 1rem !important;
                }
            `}</style>

            {/* SCRUM 172 / 187: admin masthead. Scrum 39 keeps the marketing
                header off /admin, so the dashboard carries its own minimal nav.
                Uses the shared .button/.button-alt classes so the controls match
                the header actions on every other page. */}
            <header className="admin-header">
                <nav className="admin-nav" aria-label="Admin">
                    <Link to="/" className="button button-alt">Home</Link>
                    {/* Scrum 179: Admin Settings button */}
                    <button
                        type="button"
                        onClick={toggleAdminSettingsModal}
                        className="button button-alt"
                    >
                        Admin Settings
                    </button>
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
                {/* SCRUM-215: Feedback stays visible even after its card changes boxes. */}
                {(completionError || completionMessage || appointmentsLoadError) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                        {completionError && <p role="alert" className="admin-note admin-note--danger">{completionError}</p>}
                        {appointmentsLoadError && <p role="alert" className="admin-note admin-note--danger">{appointmentsLoadError}</p>}
                        {completionMessage && <p role="status" className="admin-note admin-note--success">{completionMessage}</p>}
                    </div>
                )}
                {/* Scrum 218: Toggleable Search Bar - Box only renders when search is toggled ON */}
                {!showSearchBar ? (
                <div style={{ gridColumn: '1 / -1', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setShowSearchBar(true)}
                        className="admin-btn admin-btn--primary"
                    >
                        Search Quotes By
                    </button>
                </div>
                ) : (
                    <div className="admin-panel" style={{ gridColumn: '1 / -1', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {/* Category Dropdown Toggle */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryMenu(prev => !prev)}
                                    className="admin-btn admin-btn--ghost"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                                >
                                    Search By: <strong>{categoryLabels[searchCategory]}</strong> ▾
                                </button>

                                {/* Category Dropdown Menu */}
                                {showCategoryMenu && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '0.25rem',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.375rem',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                        zIndex: 50,
                                        minWidth: '170px'
                                    }}>
                                        {Object.entries(categoryLabels).map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => {
                                                    setSearchCategory(key)
                                                    setShowCategoryMenu(false)
                                                }}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '0.5rem 0.75rem',
                                                    background: searchCategory === key ? '#f1f5f9' : 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Scrum 218 / Scrum 219: Dynamic Search Field (Date Picker, Time Picker, or Text Input) */}
                            <div style={{ position: 'relative', flex: 1 }}>
                                {searchCategory === 'date' ? (
                                    <input
                                        type="date"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="admin-input"
                                        style={{ width: '100%', marginBottom: 0 }}
                                    />
                                ) : searchCategory === 'time' ? ( /* Scrum 219: Time picker input for time filtering */
                                    <input
                                        type="time"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="admin-input"
                                        style={{ width: '100%', marginBottom: 0 }}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={`Search by ${categoryLabels[searchCategory].toLowerCase()}...`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="admin-input"
                                        style={{ width: '100%', marginBottom: 0, paddingRight: searchQuery ? '2.25rem' : '0.75rem' }}
                                    />
                                )}

                                {/* Clear ("X") input button */}
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            color: '#64748b',
                                            padding: '0.25rem 0.5rem'
                                        }}
                                        title="Clear text"
                                        aria-label="Clear text"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Hide Search Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSearchBar(false)
                                    setSearchQuery('')
                                }}
                                className="admin-btn admin-btn--ghost"
                            >
                                Hide Search
                            </button>
                        </div>
                    </div>
                )}

                {/* SCRUM-215: Completed jobs precede active appointments and share the same card pagination. */}
                <div className="admin-panel admin-panel--appointments">
                    <h2 className="admin-panel-title">Completed Appointments</h2>
                    {filteredCompletedAppointments.length === 0 ? (
                        <p className="admin-empty">
                            {showSearchBar && searchQuery ? `No completed appointments found matching '${searchQuery}'.` : 'No completed appointments.'}
                        </p>
                    ) : (
                        <>
                            {filteredCompletedAppointments.slice((currentCompletedPage - 1) * APPOINTMENTS_PER_PAGE, currentCompletedPage * APPOINTMENTS_PER_PAGE).map(renderCompletedAppointmentCard)}
                            {renderPagination(currentCompletedPage, filteredCompletedAppointments.length, APPOINTMENTS_PER_PAGE, direction => {
                                const totalPages = Math.max(1, Math.ceil(filteredCompletedAppointments.length / APPOINTMENTS_PER_PAGE))
                                setCurrentCompletedPage(page => direction === 'next' ? Math.min(page + 1, totalPages) : Math.max(page - 1, 1))
                            })}
                        </>
                    )}
                </div>

                {/* Manage Appointments Section */}
                {/* Manage Appointments Card */}
                {/* Scrum 87: is-editing swaps the panel to the blue editing border */}
                <div className={`admin-panel admin-panel--appointments${editingAppointmentId ? ' is-editing' : ''}`}>
                    <h2 className="admin-panel-title">
                        Manage Appointments
                    </h2>

                    {filteredAcceptedQuotes.length === 0 ? (
                        <p className="admin-empty">
                            {showSearchBar && searchQuery ? `No appointments found matching '${searchQuery}'.` : 'No appointments available.'}
                        </p>
                    ) : (
                        <>
                            {visibleAppointments.map(quote => renderAppointmentCard(quote))}
                            {renderPagination(currentAppointmentPage, filteredAcceptedQuotes.length, APPOINTMENTS_PER_PAGE, handleAppointmentPage)}
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

                    {filteredQuotes.length === 0 ? (
                        <p className="admin-empty">
                            {showSearchBar && searchQuery ? `No appointments found matching '${searchQuery}'.` : 'No quotes available.'}
                        </p>
                    ) : (
                        <>
                            {visibleQuotes.map(quote => renderQuoteCard(quote))}
                            {renderPagination(currentQuotePage, filteredQuotes.length, QUOTES_PER_PAGE, handleNextPage)}
                        </>
                    )}
                </div>

                {/* Declined Quotes Card */}
                <div className="admin-panel admin-panel--declined">
                    <h2 className="admin-panel-title">
                        Declined Quotes
                    </h2>

                    {filteredDeclinedQuotes.length === 0 ? (
                        <p className="admin-empty">
                            {showSearchBar && searchQuery ? `No appointments found matching '${searchQuery}'.` : 'No declined quotes.'}
                        </p>
                    ) : (
                        <>
                            {visibleDeclinedQuotes.map(quote => renderDeclinedQuoteCard(quote))}
                            {renderPagination(currentDeclinedPage, filteredDeclinedQuotes.length, DECLINED_QUOTES_PER_PAGE, handleDeclinedPage)}
                        </>
                    )}
                </div>

                {/* SCRUM-220: Customer Reviews + Service Photos share one grid column */}
                <div className="admin-panel-stack">
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

                    {/* SCRUM-204: Service photos trigger */}
                    <div className="admin-panel admin-panel--photos admin-panel--compact">
                        <h2 className="admin-panel-title">
                            Service Photos
                        </h2>

                        <button
                            onClick={() => setShowServicePhotosModal(true)}
                            className="admin-btn admin-btn--primary"
                        >
                            Manage Service Photos
                        </button>
                    </div>
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

            {/* SCRUM-204: Service photos popup */}
            {showServicePhotosModal && (
                <ServicePhotosManager onClose={() => setShowServicePhotosModal(false)} />
            )}

            {/* Scrum 179: Admin Settings Modal to Change Admin Password */}
            {showAdminSettingsModal && (
                <div className="admin-modal">
                    <div className="admin-modal-box">
                        <h3 className="admin-modal-title">Admin Settings</h3>
                        <p className="admin-modal-text">Change Admin Password</p>
                        
                        <form onSubmit={handleAdminPasswordChange} style={{ textAlign: 'left', width: '100%' }}>
                            <div className="admin-field" style={{ marginBottom: '1rem' }}>
                                <label className="admin-label" htmlFor="admin-new-password">New Password</label>
                                <div className="password-wrapper">
                                    <input
                                        id="admin-new-password"
                                        type={showAdminPassword ? 'text' : 'password'}
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        className="admin-input"
                                        minLength={8}
                                        placeholder="At least 8 characters"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowAdminPassword(prev => !prev)}
                                        aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showAdminPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="admin-field" style={{ marginBottom: '1.25rem' }}>
                                <label className="admin-label" htmlFor="admin-confirm-password">Confirm New Password</label>
                                <div className="password-wrapper">
                                    <input
                                        id="admin-confirm-password"
                                        type={showAdminConfirmPassword ? 'text' : 'password'}
                                        value={adminConfirmPassword}
                                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                                        className="admin-input"
                                        minLength={8}
                                        placeholder="Re-enter password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowAdminConfirmPassword(prev => !prev)}
                                        aria-label={showAdminConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showAdminConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {adminPasswordError && (
                                <p role="alert" className="admin-note admin-note--danger" style={{ marginBottom: '1rem' }}>
                                    {adminPasswordError}
                                </p>
                            )}

                            {adminPasswordSuccess && (
                                <p role="status" className="admin-note admin-note--success" style={{ marginBottom: '1rem' }}>
                                    {adminPasswordSuccess}
                                </p>
                            )}

                            <div className="admin-btn-row">
                                <button
                                    type="submit"
                                    className="admin-btn admin-btn--primary admin-btn--lg"
                                    disabled={isSubmittingAdminPassword}
                                >
                                    {isSubmittingAdminPassword ? 'Updating...' : 'Update Password'}
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleAdminSettingsModal}
                                    className="admin-btn admin-btn--ghost admin-btn--lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
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
