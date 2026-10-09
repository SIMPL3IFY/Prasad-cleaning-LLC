import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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
    <section className="section signin-section">
      <div className="container">
        <div className="signin-card">
          <h1 className="section-title">Leave a Review</h1>
          {linkStatus === 'checking' ? (
            <p role="status">Checking your review link...</p>
          ) : linkStatus === 'invalid' ? (
            <p role="alert">{message}</p>
          ) : submitted ? (
            <p role="status">Thank you for sharing your experience with us.</p>
          ) : (
            <form className="signin-form" onSubmit={submit}>
              <p>Tell us about your cleaning appointment.</p>

              <label htmlFor="review-name">Your name</label>
              <input
                id="review-name"
                value={customerName}
                maxLength={120}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />

              <fieldset>
                <legend>Star rating</legend>
                {[1, 2, 3, 4, 5].map((star) => (
                  <label key={star} style={{ marginRight: '1rem' }}>
                    <input
                      type="radio"
                      name="rating"
                      value={star}
                      checked={rating === star}
                      onChange={() => setRating(star)}
                      required
                    />{' '}
                    {star}
                  </label>
                ))}
              </fieldset>

              <label htmlFor="review-text">Your review</label>
              <textarea
                id="review-text"
                value={review}
                maxLength={2000}
                onChange={(event) => setReview(event.target.value)}
                required
              />

              {message && <p role="alert">{message}</p>}
              <button
                type="submit"
                className="button button-main button-big signin-btn"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}