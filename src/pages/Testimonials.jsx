/***
 * Testimonials.jsx
 * This page displays customer testimonials for the cleaning service.
 * Reviews currently loaded from local JSON file
 * When database is setup, fetchReviews() will be updated to pull directly from there.
 * SCRUM-202: Updated Testimonials.jsx
 * Added error state, date display, and accessible rating text, and keep five newest approved reviews.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const REVIEW_LIMIT = 5

const formatReviewDate = (createdAt) => {
  if (!createdAt) {
    return 'Date unavailable'
  }

  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-US', { 
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

export default function Testimonials() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setError] = useState('') // SCRUM-202: Added error state

  //SCRUM 90: Fetch reviews from Supabase database
  useEffect(() => {
    let isMounted = true

    const fetchReviews = async () => {
      setLoading(true)
      setError('') // SCRUM-202: Reset error state before fetching reviews

      const { data, error } = await supabase
        .from('customer_reviews')
        .select('id, customer_name, review, rating, created_at')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(REVIEW_LIMIT) // SCRUM-202: Limit to the five newest approved reviews

        if (!isMounted) return // SCRUM-202: Prevent state updates if component is unmounted

      if (error) {
        console.error('Error fetching reviews:', error)
        setReviews([])
        setError('We could not load customer reviews right now. Please try again later.') // SCRUM-202: Set error message when fetching reviews fails
      } else {
        setReviews(data || [])
      }

      setLoading(false)
    }

    fetchReviews()

    return () => {
      isMounted = false
    } // SCRUM-202: Cleanup function to prevent state updates if component is unmounted
  }, [])

return (
  <section className="section">
    <div className="container">
      <h1 className="page-title testimonials-page-title">Customer Testimonials</h1>
      <p className="section-subtitle">Real feedback from customers we've helped</p>

      {loading ? (
        <p className="review-status" role="status">Loading reviews...</p>
      ) : errorMessage ? (
        <p className="review-status review-status--error" role="alert">
          {errorMessage}
        </p>
      ) : reviews.length === 0 ? (
        <p className="review-status">
          No customer reviews area available at this time. Please check back soon.
        </p>
      ) : (
        <ul className="testimonials-list testimonials-list--spaced">
          {reviews.map((review) => (
            <li key={review.id} className="testimonial-card">
              <h2>{review.customer_name || 'Verified Customer'}</h2>
              <p>{review.review}</p>
              
              {review.rating ? (
                <p className="review-rating" aria-label={`${review.rating} out of 5 stars`}>
                  <span aria-hidden="true">{'★'.repeat(review.rating)}</span>
                  <span className="sr-only">{`${review.rating} out of 5 stars`}</span>
                </p>
              ) : null}

              <time className="review-date" dateTime={review.created_at}>
                Submitted {formatReviewDate(review.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <div className="testimonials-cta">
        <Link className="button button-main" to="/contact">Book a cleaning</Link>
      </div>
    </div>
  </section>
  )
}