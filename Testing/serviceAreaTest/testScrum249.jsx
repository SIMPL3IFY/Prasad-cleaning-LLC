// SCRUM-249: Service Area page testing
// Automated tests for the Service Area page so changes don't break the page customers use to check whether we clean in their city.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ServiceArea from '../../src/pages/ServiceArea'

// The city list is mocked so a test can empty it. beforeEach puts the real list back.
const { citiesData } = vi.hoisted(() => ({ citiesData: { cities: [] } }))

vi.mock('../../src/data/cities.json', () => ({ default: citiesData }))

const { default: realCitiesData } = await vi.importActual('../../src/data/cities.json')
const CITIES = realCitiesData.cities

// Coordinates from the overview map URL (centered on Northern California)
const OVERVIEW_MAP = '!2d-121.4944!3d38.5816'

function renderServiceArea() {
  return render(
    <MemoryRouter initialEntries={['/service-area']}>
      <Routes>
        <Route path="/service-area" element={<ServiceArea />} />
        <Route path="/contact" element={<p>Contact Page</p>} />
        <Route path="/signin" element={<p>Sign In Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function map() {
  return screen.getByTitle("Prasad's Cleaning Service Area Map")
}

// The "Showing ..." bar above the map
function selectionBar() {
  return map().parentElement.querySelector('.map-selection-bar')
}

function cityButton(city) {
  return screen.getByRole('button', { name: city })
}

function expectFullServiceArea() {
  expect(map().getAttribute('src')).toContain(OVERVIEW_MAP)
  expect(selectionBar()).toHaveTextContent('Showing the full service area')
  expect(screen.queryByRole('button', { name: 'Show full service area' })).not.toBeInTheDocument()
}

function expectShowingCity(city) {
  expect(map().getAttribute('src')).toContain(`q=${encodeURIComponent(`${city}, CA`)}`)
  expect(selectionBar()).toHaveTextContent(`Showing ${city}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  citiesData.cities = [...CITIES]
  // jsdom has no scrollIntoView, which the page calls when a city is clicked
  Element.prototype.scrollIntoView = vi.fn()
})

// SCRUM-249 AC: Every city in the service list is shown as a button under "Cities We Serve".
describe('City list', () => {
  it('shows every city as a button under "Cities We Serve"', () => {
    renderServiceArea()

    const panel = screen.getByRole('heading', { name: 'Cities We Serve' }).closest('aside')
    const buttons = within(panel).getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual(CITIES)
  })

  it('shows "Service areas not available." if the city list is empty', () => {
    citiesData.cities = []
    renderServiceArea()

    expect(screen.getByText('Service areas not available.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cities We Serve' })).not.toBeInTheDocument()
  })
})

// SCRUM-249 AC: Before a city is picked, the map shows the full Northern California service area.
describe('Map before a city is picked', () => {
  it('shows the full service area', () => {
    renderServiceArea()

    expectFullServiceArea()
  })
})

// SCRUM-249 AC: Clicking a city focuses the map on it and shows "Showing [city]".
describe('Picking a city', () => {
  it('focuses the map on the city and shows "Showing [city]"', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Davis'))

    expectShowingCity('Davis')
    expect(cityButton('Davis')).toHaveAttribute('aria-pressed', 'true')
  })

  it('searches the whole Bay Area, since it is a region and not a city', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Bay Area'))

    expect(map().getAttribute('src')).toContain(`q=${encodeURIComponent('San Francisco Bay Area, CA')}`)
    expect(selectionBar()).toHaveTextContent('Showing Bay Area')
  })

  it('scrolls the map into view (for phones, where the map is above the list)', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Davis'))

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})

// SCRUM-249 AC: Clicking the same city again, or "Show full service area", returns to the full service area.
describe('Going back to the full service area', () => {
  it('returns when the same city is clicked again', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Davis'))
    await userEvent.click(cityButton('Davis'))

    expectFullServiceArea()
    expect(cityButton('Davis')).toHaveAttribute('aria-pressed', 'false')
  })

  it('returns when "Show full service area" is clicked', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Davis'))
    await userEvent.click(screen.getByRole('button', { name: 'Show full service area' }))

    expectFullServiceArea()
    expect(cityButton('Davis')).toHaveAttribute('aria-pressed', 'false')
  })
})

// SCRUM-249 AC: Only one city can be selected at a time.
describe('One city at a time', () => {
  it('picking a second city replaces the first', async () => {
    renderServiceArea()

    await userEvent.click(cityButton('Davis'))
    await userEvent.click(cityButton('Folsom'))

    expectShowingCity('Folsom')
    const selected = screen.getAllByRole('button', { pressed: true })
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Folsom')
  })
})

// SCRUM-249 AC: "Get a Free Quote" links to Contact, and "Sign In" goes to Sign In.
describe('Call-to-action buttons', () => {
  it('"Get a Free Quote" goes to the contact page', async () => {
    renderServiceArea()

    const link = screen.getByRole('link', { name: 'Get a Free Quote' })
    expect(link).toHaveAttribute('href', '/contact')

    await userEvent.click(link)

    expect(await screen.findByText('Contact Page')).toBeInTheDocument()
  })

  it('"Sign In" goes to the sign in page', async () => {
    renderServiceArea()

    const link = screen.getByRole('link', { name: 'Sign In' })
    expect(link).toHaveAttribute('href', '/signin')

    await userEvent.click(link)

    expect(await screen.findByText('Sign In Page')).toBeInTheDocument()
  })
})
