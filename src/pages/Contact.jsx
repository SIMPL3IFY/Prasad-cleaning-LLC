import { useState } from 'react'

export default function Contact() {
  const [showPopup, setShowPopup] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  return (
    <section className="section action-section">
      <div className="container action-section-content">
        <h1 className="section-title">Contact</h1>
        <p className="action-text">Send us a message and we'll get back to you shortly.</p>

        <form className="contact-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="tel" name="phone" placeholder="Phone" />
          <textarea name="message" placeholder="Description of your inquiry" rows="4"></textarea>
          <button type="submit" className="button button-main">Send Message</button>
        </form>

        {showPopup && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 1000,
            textAlign: 'center',
            minWidth: '300px'
          }}>
            <p style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#000000',
              margin: 0
            }}>
              Quote Submitted!
            </p>
          </div>
        )}

        {showPopup && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 999
          }} />
        )}
      </div>
    </section>
  )
}
