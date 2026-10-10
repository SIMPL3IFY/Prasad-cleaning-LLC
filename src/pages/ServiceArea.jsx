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
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Scrum 29 methods
  // Renders each city as a card
  const renderCityCard = (city) => (
    <li
      key={city}
      className="service-card"
      style={{
        textAlign: 'center',
        fontWeight: 500,
        fontSize: '0.95rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80px',
      }}
    >
      {/* SCRUM-203: Each city is a button that focuses the map on it */}
      <button
        type="button"
        className={`city-button${selectedCity === city ? ' is-selected' : ''}`}
        aria-pressed={selectedCity === city}
        onClick={() => handleCityClick(city)}
      >
        {city}
      </button>
    </li>
  )
  // Renders a full grid of citites with a fallback
  const renderCitiesGrid =() => {
    if(!cities || cities.length === 0){
      return (
        <p style={{ textAlign: 'center', color: '#888', marginTop: 'var(--space-x1)'}}>
          Service areas not avaliable.
        </p>
      )
    }

    return (
      <div style={{ marginTop: 'var(--space-2xl)' }}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>Cities We Serve</h2>
        {/* SCRUM-203: Hint that the cities are clickable */}
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          Click a city to see it on the map.
        </p>
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--space-md, 1rem)',
            listStyle: 'none',
            padding: 0,
            marginTop: 'var(--space-xl)',
          }}
        >
          {cities.map((city) => renderCityCard(city))}
        </ul>
      </div>
    )
  }
  // Renders embedded Google Map
  const renderMap = () => (
    <div
        ref={mapRef}
        style={{
          width: '100%',
          maxWidth: '860px',
          margin: 'var(--space-2xl) auto 0',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid var(--color-border, #e5e7eb)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      <iframe
        title="Prasad's Cleaning Service Area Map"
        width="100%"
        height="450"
        style={{ display: 'block', border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={selectedCity ? getCityMapSrc(selectedCity) : OVERVIEW_MAP_SRC}
          />
        {/* SCRUM-203: Shows the selected city with a link back to the overview */}
        {selectedCity && (
          <div className="map-selection-bar">
            <span>Showing <strong>{selectedCity}</strong></span>
            <button type="button" className="map-reset" onClick={() => setSelectedCity(null)}>
              Show full service area
            </button>
          </div>
        )}
        </div>
  )
  
  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title" style={{ textAlign: 'center' }}>Service Area</h1>
        <p className="section-subtitle">
          We provide cleaning services to most of Northern California — including the Bay Area and Central Valley.
        </p>

       {renderMap()}
       {renderCitiesGrid()}

        {/* Callout note */}
        <p
          className="section-subtitle"
          style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}
        >
          Don't see your city? Reach out — we may still be able to help!
        </p>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          <a className="button button-main" href="/contact">
            Get a Free Quote
          </a>
        </div>

        {/* SCRUM-22: Sign In button for existing customers */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <Link className="button button-main" to="/signin">
            Sign In
          </Link>
        </div>
      </div>
    </section>
  )
}