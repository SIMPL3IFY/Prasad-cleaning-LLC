import QuoteForm from '../components/QuoteForm'

export default function Contact() {
  return (
    <section className="section action-section">
      <div className="container action-section-content">
        <h1 className="section-title">Contact</h1>
        <p className="action-text">Send us a message and we'll get back to you shortly.</p>

        {/* SCRUM-175: Contact page now uses the shared quote form */}
        <QuoteForm />
      </div>
    </section>
  )
}
