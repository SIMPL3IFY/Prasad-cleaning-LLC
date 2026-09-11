/***
 * Testimonials.jsx
 * This page displays customer testimonials for the cleaning service.
 * Reviews currently loaded from local JSON file
 * When database is setup, fetchReviews() will be updated to pull directly from there.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Testimonials() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  //SCRUM 90: Fetch reviews from Supabase database
  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('id, customer_name, review, rating')
        .eq('approved', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching reviews:', error)
        setReviews([])
      } else {
        setReviews(data || [])
      }

      setLoading(false)
    }

    fetchReviews()
  }, [])

  const limitReviews = (reviewsArray) => {
    return reviewsArray.slice(0,5)
  }

  const renderReviewCard = (review) => {
    return (
      <li key={review.id} className='testimonial-card'>
        <h3>{review.customer_name}</h3>
        <p>{review.review}</p>
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
        <h1 className="page-title" style={{ textAlign: 'center' }}>Customer Testimonials</h1>
        <p className="section-subtitle">Real feedback from customers we've helped</p>

        {loading ? (
          <p style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>Loading reviews...</p>
        ) : (
          <ul className="testimonials-list" style={{ paddingTop: 'var(--space-2xl)' }}>
            {displayedReviews.length > 0
              ? displayedReviews.map(renderReviewCard)
              : renderFallback()
            }
          </ul>
        )}

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
          <Link className="button button-main" to="/contact">Book a cleaning</Link>
        </div>
      </div>
    </section>
  )
}
