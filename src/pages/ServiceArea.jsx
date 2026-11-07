import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import citiesData from '../data/cities.json'

// SCRUM-203: Default overview of Northern California shown before a city is picked
const OVERVIEW_MAP_SRC =
  'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1264000!2d-121.4944!3d38.5816!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus'

// SCRUM-203: Entries in cities.json that aren't a single city need their own search/zoom
const MAP_OVERRIDES = {
  'Bay Area': { query: 'San Francisco Bay Area, CA', zoom: 9 },
}

// SCRUM-203: Builds a map URL centred on the city; Google outlines the city boundary
const getCityMapSrc = (city) => {
  const { query, zoom } = MAP_OVERRIDES[city] ?? { query: `${city}, CA`, zoom: 12 }
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`
}

export default function ServiceArea() {
  const cities = citiesData.cities
  // SCRUM-203: City currently shown on the map (null = overview)
  const [selectedCity, setSelectedCity] = useState(null)
  const mapRef = useRef(null)

  // SCRUM-203: Clicking a city focuses the map on it; clicking it again goes back to the overview
  const handleCityClick = (city) => {
    setSelectedCity((prev) => (prev === city ? null : city))
    // Only scrolls if the map is out of view, which happens once the layout stacks on phones
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // Scrum 29 methods
  // Renders each city as a card
  const renderCityCard = (city) => (
    <li key={city} className="city-card">
      {/* SCRUM-203: Each city is a button that focuses the map on it */}
      <button
        type="button"
        className={`city-button${selectedCity === city ? ' is-selected' : ''}`}
        aria-pressed={selectedCity === city}
        onClick={() => handleCityClick(city)}
      >
        <svg className="city-pin" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
        </svg>
        <span>{city}</span>
      </button>
    </li>
  )
  // Renders a full grid of citites with a fallback
  const renderCitiesGrid =() => {
    if(!cities || cities.length === 0){
      return (
        <p className="city-empty">
          Service areas not available.
        </p>
      )
    }

    return (
      <aside className="city-panel">
        <h2 className="contact-info-title">Cities We Serve</h2>
        {/* SCRUM-203: Hint that the cities are clickable */}
        <p className="city-panel-hint">Click a city to see it on the map.</p>
        <ul className="city-grid">
          {cities.map((city) => renderCityCard(city))}
        </ul>
      </aside>
    )
  }
  // Renders embedded Google Map
  const renderMap = () => (
    <div ref={mapRef} className="area-map">
      {/* SCRUM-203: Shows the selected city with a link back to the overview */}
      <div className="map-selection-bar" aria-live="polite">
        {selectedCity ? (
          <>
            <span>Showing <strong>{selectedCity}</strong></span>
            <button type="button" className="map-reset" onClick={() => setSelectedCity(null)}>
              Show full service area
            </button>
          </>
        ) : (
          <span>Showing the <strong>full service area</strong></span>
        )}
      </div>
      <iframe
        title="Prasad's Cleaning Service Area Map"
        className="area-map-frame"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={selectedCity ? getCityMapSrc(selectedCity) : OVERVIEW_MAP_SRC}
      />
    </div>
  )
  
  return (
    <div className="service-area-page">
      <section className="banner banner-glow">
        <div className="container banner-content">
          <span className="banner-eyebrow">Northern California</span>
          <h1 className="page-title">Service Area</h1>
          <p className="page-subtitle">
          We provide cleaning services to most of Northern California — including the Bay Area and Central Valley.
          </p>
        </div>
      </section>

      <section className="page-main">
      <div className="container">

        <div className="area-explorer">
          {renderMap()}
          {renderCitiesGrid()}
        </div>

        {/* Callout note */}
        {/* SCRUM-22: Sign In button for existing customers */}
        <div className="page-cta">
          <div>
            <h2 className="page-cta-title">Don't see your city?</h2>
            <p className="page-cta-text">Reach out — we may still be able to help!</p>
          </div>
          <div className="page-cta-actions">
            <Link className="button button-main button-big" to="/contact">Get a Free Quote</Link>
            <Link className="button button-alt button-big" to="/signin">Sign In</Link>
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}