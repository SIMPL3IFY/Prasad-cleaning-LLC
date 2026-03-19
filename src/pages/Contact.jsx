export default function Contact() {
  return (
    <section className="section action-section">
      <div className="container action-section-content">
        <h1 className="section-title">Contact</h1>
        <p className="action-text">Send us a message and we'll get back to you shortly.</p>

        <form className="contact-form" action="#" method="post">
          <input type="text" name="name" placeholder="Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="tel" name="phone" placeholder="Phone" />
          <textarea name="message" placeholder="Description of your inquiry" rows="4"></textarea>
          <button type="submit" className="button button-main">Send Message</button>
        </form>
      </div>
    </section>
  )
}
