import logo from '/assets/logo.png'

export default function About() {
  return (
    <main className="about-page">
      <section className="about-logo-section">
        <div className="container">
          <div className="about-logo-frame">
            <img
              src={logo}
              alt="Prasad's Cleaning Services LLC logo"
              className="about-page-logo"
            />
          </div>
        </div>
      </section>

      <section className="about-main-section">
        <div className="container about-single-column">
          <div className="about-card">
            <h1 className="about-title">About Us</h1>

            <p className="about-text">
              Prasad&apos;s Cleaning Services LLC is a locally owned cleaning company dedicated
              to delivering reliable, high-quality service for homes and businesses. Owned and
              operated by Nigel Prasad, the company serves clients across Northern California,
              including the Bay Area, Modesto, Sacramento, and El Dorado Hills.
            </p>

            <p className="about-text">
              We take pride in professionalism, attention to detail, and creating clean,
              welcoming spaces for every client. Our goal is to provide dependable cleaning
              solutions with care, consistency, and respect for every property.
            </p>
          </div>

          <div className="about-card about-offer-card">
            <h2 className="about-section-heading">What We Offer</h2>

            <p className="about-text">
              We provide a wide range of cleaning services tailored to the needs of each
              customer. Services include commercial cleaning, residential window cleaning,
              carpet cleaning, janitorial services, floor cleaning, and stripping and wax
              services.
            </p>

            <ul className="about-service-list-clean">
              <li>Commercial Cleaning</li>
              <li>Residential Window Cleaning</li>
              <li>Carpet Cleaning</li>
              <li>Janitorial Services</li>
              <li>Floor Cleaning</li>
              <li>Stripping and Wax Services</li>
            </ul>
          </div>

          <div className="about-values-section">
            <h2 className="about-section-heading centered">Why Clients Choose Us</h2>

            <div className="about-values-grid">
              <article className="about-value-card">
                <h3>Reliable</h3>
                <p>We provide consistent, high-quality service that customers can count on.</p>
              </article>

              <article className="about-value-card">
                <h3>Detail-Oriented</h3>
                <p>
                  We focus on both visible cleanliness and the finishing touches that improve
                  the whole space.
                </p>
              </article>

              <article className="about-value-card">
                <h3>Professional</h3>
                <p>
                  We approach every job with respect, clear communication, and care for the
                  customer&apos;s property.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}