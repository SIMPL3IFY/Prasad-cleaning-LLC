/***
 * Testimonials.jsx
 * This page displays customer testimonials for the cleaning service.
 * Reviews currently loaded from local JSON file
 * When database is setup, fetchReviews() will be updated to pull directly from there.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import reviewsData from '../data/TestimonialData.json'

export default function Testimonials() {
  const [reviews] = useState(reviewsData)

  const fetchReviews = () => {
    // Enter database info when ready
    return reviewsData
  }

  const limitReviews = (reviewsArray) => {
    return reviewsArray.slice(0,3)
  }

  const renderReviewCard = (review) => {
    return (
      <li key = {review.id} className='testimonial-card'>
        <h3>{review.customerName}</h3>
        <p>{review.comment}</p>
        <span>{'⭐'.repeat(review.rating)}</span>
      </li>
    )
  }

  const renderFallback = () => {
    return <p style={{textAlign: 'center' }}>No reviews available at this time</p>
  }

  const displayedReviews = limitReviews(reviews)
  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{textAlign: 'center' }}>Customer Testimonials</h1>
        <p className="section-subtitle">Real feedback from customers we've helped</p>

        <ul className="testimonials-list" style={{paddingTop: 'var(--space-2xl)'}}>
          {displayedReviews.length > 0
            ? displayedReviews.map(renderReviewCard)
            : renderFallback()
          }
        </ul>
         <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
          <Link className="button button-main" to="/contact">Book a cleaning</Link>
        </div>
      </div>
    </section>
  )
}
