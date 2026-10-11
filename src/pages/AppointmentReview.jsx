import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './AppointmentReview.css'

// SCRUM-211: The email link authorizes only this review. It does not sign in
// the visitor or grant access to the rest of the customer portal.
export default function AppointmentReview() {
  const { token } = useParams()
  const [customerName, setCustomerName] = useState('')
  const [review, setReview] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [linkStatus, setLinkStatus] = useState('checking')

  useEffect(() => {
    let active = true
    async function checkLink() {
      try {
        const { data, error } = await supabase.functions.invoke('submit-appointment-review', {
          body: { token, action: 'validate' },
        })
        if (!active) return
        setLinkStatus(error || !data?.valid ? 'invalid' : 'valid')
        if (error || !data?.valid) setMessage(data?.error || 'This review link is unavailable. Please try again later.')
      } catch {
        if (active) {
          setLinkStatus('invalid')
          setMessage('This review link is unavailable. Please try again later.')
        }
      }
    }
    checkLink()
    return () => { active = false }
  }, [token])

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    if (!customerName.trim() || !review.trim() || !rating) {
      setMessage('Please enter your name, select a star rating, and write a review.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('submit-appointment-review', {
        body: { token, customerName: customerName.trim(), review: review.trim(), rating },
      })
      if (error || !data?.submitted) {
        setMessage(data?.error || 'Unable to submit your review. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setMessage('Unable to submit your review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="appointment-review-page">
      <div className="appointment-review-card">
        <p className="appointment-review-eyebrow">Contact Us</p>
        <h1>Write a Review</h1>
        {linkStatus === 'checking' ? (
          <p role="status">Checking your review link...</p>
        ) : linkStatus === 'invalid' ? (
          <p role="alert">{message}</p>
        ) : submitted ? (
          <p role="status">Thank you for sharing your experience with us.</p>
        ) : (
          <form className="appointment-review-form" onSubmit={submit}>
            <fieldset className="appointment-review-rating">
              <legend className="appointment-review-visually-hidden">Star rating</legend>
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="appointment-review-star">
                  <input
                    id={`review-star-${star}`}
                    type="radio"
                    name="rating"
                    value={star}
                    checked={rating === star}
                    onChange={() => setRating(star)}
                    required
                  />
                  <label
                    htmlFor={`review-star-${star}`}
                    aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                    className={star <= rating ? 'selected' : ''}
                  >★</label>
                </span>
              ))}
            </fieldset>
            <label className="appointment-review-visually-hidden" htmlFor="review-name">Name</label>
            <input
              id="review-name"
              type="text"
              placeholder="Name"
              value={customerName}
              maxLength={120}
              onChange={(event) => setCustomerName(event.target.value)}
              required
            />
            <label className="appointment-review-visually-hidden" htmlFor="review-text">Message</label>
            <textarea
              id="review-text"
              placeholder="Message"
              value={review}
              maxLength={2000}
              rows={5}
              onChange={(event) => setReview(event.target.value)}
              required
            />
            {message && <p role="alert">{message}</p>}
            <button type="submit" className="appointment-review-send" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send'}
            </button>
            <Link className="appointment-review-cancel" to="/">Cancel</Link>
          </form>
        )}
      </div>
    </section>
  )
}