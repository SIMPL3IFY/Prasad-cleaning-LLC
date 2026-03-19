export default function Contact() {
  return (
    <section className="section cta">
      <div className="container cta-inner">
        <h1 className="section-title">Contact</h1>
        <p className="cta-text">Send us a message and we'll get back to you shortly.</p>

        <form className="contact-form" action="#" method="post">
          <input type="text" name="name" placeholder="Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="tel" name="phone" placeholder="Phone" />
          <textarea name="message" placeholder="Description of your inquiry" rows="4"></textarea>
          <button type="submit" className="btn btn-primary">Send Message</button>
        </form>
      </div>
    </section>
  )
}
