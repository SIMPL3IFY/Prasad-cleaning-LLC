import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function CustomerPortal() {
    const navigate = useNavigate()
    
    // SCRUM 33: State Variables
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [customerName, setCustomerName] = useState('')
    const [reviewText, setReviewText] = useState('')
    const [rating, setRating] = useState(0)
    const [errors, setErrors] = useState({})

    // SCRUM 75: State Variables
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [scheduleErrors, setScheduleErrors] = useState({})

    // SCRUM 76: State for contact modal and variables
    const [isContactModalOpen, setIsContactModalOpen] = useState(false)
    const ownerName = 'Nigel Prasad'
    const phoneNumber = '(XXX) XXX-XXXX' // To be changed
    const email = 'PrasadsCleaning@gmail.com'

    // SCRUM 33 Review methods
    // Opens and closes the modal
    const toggleModal = () => {
        setIsModalOpen(prev => !prev)
        setErrors({})
        setCustomerName('')
        setReviewText('')
        setRating(0)
    }

    // Handles star rating selection
    const handleStars = (starValue) => {
        setRating(starValue)
    }

    //Captures text input from user
    const handleReviewChange = (e) => {
        const { name, value } = e.target
        if (name === 'customerName') {
            setCustomerName(value)
        }
        if (name === 'reviewText') {
            setReviewText(value)
        }
    }

    // Validates all fields are filled
    const validateReview = () => {
        const newErrors = {}
        if (customerName.trim() === ''){
            newErrors.customerName = 'Please enter your name.'
        }
        if (reviewText.trim() === ''){
            newErrors.reviewText = 'Please enter a review'
        }
        if (rating === 0){
            newErrors.rating = 'Please select a star rating'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }


    // Submits review after validation
    const submitReview = () => {
        if (!validateReview()){
            return
        }
        console.log({ customerName, reviewText, rating})
        toggleModal()
    }

    // SCRUM-75: function to open and close the modal
    const toggleScheduleModal = () => {
        setIsScheduleModalOpen(prev => !prev)
        setScheduleErrors({})
        setStartDate('')
        setEndDate('')
    }
    
    // Handler for date input changes
    const handleDateChange = (e) => {
        const { name, value} = e.target
        if (name === 'startDate') {
            setStartDate(value)
        }
        if (name === 'endDate') {
            setEndDate(value)
        }
    }

    // Validation logic
    const validateSchedule = () => {
        const newErrors = {}

        if (startDate.trim() === '') {
            newErrors.startDate = 'Please select a start date.'
        }

        if (endDate.trim() === '') {
            newErrors.endDate = 'Please select an end date.'
        }

        if (startDate && endDate && endDate < startDate) {
            newErrors.dateRange = 'End date cannot be ealier than start date.'
        }

        setScheduleErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // Submit function for scheduling
    const submitSchedule = () => {
        if (!validateSchedule()) {
            return
        }
        console.log({ startDate, endDate })
        toggleScheduleModal()
    }

    // SCRUM-76: Functions to open and close contact modal
    const toggleContactModal = () => {
        setIsContactModalOpen(prev => !prev)
    }

    // Logout function to navigate back to landing page
    const handleLogout = () => {
        navigate('/')
    }

    return(
        <div>
        {/*scrum 39 to navigate to landing page from logo
        the logo is at the top center of the page
        the header contains the company logo and when clicked, will redirect to Home.jsx
        the logo png is in assests and is named logo.png */}
        <header style={{ backgroundColor: 'transparent'}}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 0', width: '100%'}}>
                 <Link to="/" className="logo" aria-label="Prasad's Cleaning Services LLC">
                    <img className="logo-img" src="/assets/logo.png" alt="Prasad's Cleaning Services LLC" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
                </Link>
            </div>
        </header>

        {/* scrum 33: leave a review button*/}
        <div style={{ textAlign: 'center', marginTop: '2rem'}}>
            <button
                onClick={toggleModal}
                style={{
                     backgroundColor: '#8db87a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '1rem 2rem',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                }}
            >
                Leave a Review
            </button>
        </div>
        {/* SCRUM-75: schedule appointment button*/}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button
                onClick={toggleScheduleModal}
                style={{
                    backgroundColor: '#7ec8e3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '1rem 2rem',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                }}
            >
                Schedule Appointment
            </button>
        </div>
        {/* SCRUM-76: contact information button */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
             <button
                onClick={toggleContactModal}
                style={{
                    backgroundColor: '#8db87a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '1rem 2rem',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                }}
            >
                Contact Information
            </button>
        </div>
        {/* SCRUM-32: Logout button */}
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
        {/*CREATE REMAINING BUTTONS UNDER HERE*/}





        {/*scrum 33: review modal*/}
        {isModalOpen  &&(
            <div style={{
                 position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '2rem',
                    width: '90%',
                    maxWidth: '460px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    textAlign: 'center'
                }}>
                    {/* Modal Header*/}
                    <p style={{
                        fontSize: '0.8rem', 
                        color: '#888', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.1em',
                        marginBottom: '0.25rem'
                    }}>
                        Contact Us 
                    </p>
                    <h2 style={{
                        fontSize: '2rem', 
                        fontWeight: 'bold', 
                        marginBottom: '1rem' 
                    }}>
                        Write a Review
                    </h2>

                    {/*Star rating*/}
                    <div style={{ marginBottom: '1.25rem' }}>
                         {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                key={star}
                                onClick={() => handleStars(star)}
                                style={{
                                fontSize: '1.75rem',
                                cursor: 'pointer',
                                color: star <= rating ? '#f5a623' : '#ccc'
                                }}
                                >
                                    ★
                                </span>
                            ))}
                            {errors.rating && (
                                <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                {errors.rating}
                                </p>
                            )}
                    </div>
                    {/*Name input */}
                    <div style={{ marginBottom: '1rem'}}>
                        <input
                         type="text"
                            name="customerName"
                            placeholder="Name"
                            value={customerName}
                            onChange={handleReviewChange}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '25px',
                                border: errors.customerName ? '2px solid red' : '1px solid #ccc',
                                boxSizing: 'border-box',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                            />
                            {errors.customerName && (
                                <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                {errors.customerName}
                                </p>
                            )}
                        </div>
                         {/* Review textarea */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <textarea
                            name="reviewText"
                            placeholder="Message"
                            value={reviewText}
                            onChange={handleReviewChange}
                            rows={5}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                border: errors.reviewText ? '2px solid red' : '1px solid #ccc',
                                boxSizing: 'border-box',
                                fontSize: '0.95rem',
                                resize: 'none',
                                outline: 'none'
                            }}
                            />
                            {errors.reviewText && (
                                <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                {errors.reviewText}
                                </p>
                            )}
                        </div>

                         {/* Send button */}
                        <button
                            onClick={submitReview}
                            style={{
                                backgroundColor: '#7ec8e3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '25px',
                                padding: '0.75rem 3rem',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                marginBottom: '0.75rem'
                            }}
                        >
                            Send
                        </button>
                             {/* Cancel link */}
                        <div>
                            <span
                                onClick={toggleModal}
                                style={{
                                    fontSize: '0.85rem',
                                    color: '#888',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Cancel
                            </span>
                        </div>

                    </div>
                </div>
        )}
        {/*SCRUM-75: appointment modal*/}
        {isScheduleModalOpen && (
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}>
            <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            width: '90%',
            maxWidth: '460px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            textAlign: 'center'
            }}>
            <p style={{
                fontSize: '0.8rem',
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.25rem'
            }}>
                Schedule Service
            </p>

            <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                marginBottom: '1rem'
            }}>
                Schedule Appointment
            </h2>

            <div style={{ marginBottom: '1rem' }}>
                <input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={handleDateChange}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: scheduleErrors.startDate ? '2px solid red' : '1px solid #ccc',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                        outline: 'none'
                    }}
                />
                {scheduleErrors.startDate && (
                    <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {scheduleErrors.startDate}
                    </p>
                )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <input
                    type="date"
                    name="endDate"
                    value={endDate}
                    onChange={handleDateChange}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: scheduleErrors.endDate || scheduleErrors.dateRange ? '2px solid red' : '1px solid #ccc',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                        outline: 'none'
                    }}
                />
                {scheduleErrors.endDate && (
                    <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {scheduleErrors.endDate}
                    </p>
                )}
                {scheduleErrors.dateRange && (
                    <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {scheduleErrors.dateRange}
                    </p>
                )}
            </div>

            <button
                onClick={submitSchedule}
                style={{
                    backgroundColor: '#8db87a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '25px',
                    padding: '0.75rem 3rem',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    marginBottom: '0.75rem'
                }}
            >
                Submit
            </button>

            <div>
                <span
                    onClick={toggleScheduleModal}
                    style={{
                        fontSize: '0.85rem',
                        color: '#888',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }}
                >
                    Cancel
                </span>
            </div>
            </div>
        </div>
        )}
        {/* SCRUM-76: contact information modal */}
        {isContactModalOpen && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '2rem',
                width: '90%',
                maxWidth: '460px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                textAlign: 'center'
            }}>
            <p style={{
                fontSize: '0.8rem',
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.25rem'
            }}>
                Contact Us
            </p>

            <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                marginBottom: '1rem'
            }}>
                Contact Information
            </h2>

            <div style={{ marginBottom: '1rem', fontSize: '1rem', lineHeight: '1.8' }}>
                <p><strong>Owner's Name:</strong> {ownerName}</p>
                <p><strong>Phone Number:</strong> {phoneNumber}</p>
                <p><strong>Email:</strong> {email}</p>
            </div>

            <div>
                <span
                    onClick={toggleContactModal}
                    style={{
                        fontSize: '0.85rem',
                        color: '#888',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }}
                >
                    Close
                </span>
            </div>
            </div>
            </div>
        )}
    </div>
    )
}
