import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function CustomerPortal() {
    // SCRUM 33: State Variables
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [customerName, setCustomerName] = useState('')
    const [reviewText, setReviewText] = useState('')
    const [rating, setRating] = useState(0)
    const [errors, setErrors] = useState({})

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

    return(
        <div>
        {/*scrum 39 to navigate to landing page from logo
        //create the header for the page
        //the header contains the company logo and when clicked, will redirect to Home.jsx
        //here the logo png is added and the to Home.jsx link is in App.jsx
        //the logo png is in assests and is named logo.png */}
        <header className="header">
            <div className="container header-inner">
                 <Link to="/" className="logo" aria-label="Prasad's Cleaning Services LLC">
                    <img className="logo-img" src="/assets/logo.png" alt="Prasad's Cleaning Services LLC" />
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
    </div>
    )
}
