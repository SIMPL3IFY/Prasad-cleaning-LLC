// SCRUM-247: Services page testing
// Automated tests for the Services page so changes don't break the page customers use to compare our cleaning services.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Services from '../../src/pages/Services'
import { SERVICES_LIST } from '../../src/data/ServicesData'

// Supabase is mocked so tests never hit the real database and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const DEFAULT_DESCRIPTION = 'Customized cleaning solutions designed around your needs.'
const BUILT_IN_RESIDENTIAL = SERVICES_LIST.find((service) => service.name === 'Residential Cleaning').description

// One service for each description case, and one that isn't featured
const MOCK_SERVICES = [
  // Admin-written description
  { id: 1, name: 'Commercial Cleaning', image_path: 'com.jpg', is_featured: true, description: 'Admin-written office cleaning.' },
  // No admin description, but has a built-in one
  { id: 2, name: 'Residential Cleaning', image_path: 'res.jpg', is_featured: true, description: null },
  // Neither, so the page shows the default
  { id: 3, name: 'Window Cleaning', image_path: 'win.jpg', is_featured: false, description: null },
]

// Helper: fakes from('services').select().eq().order(), plus storage.from().getPublicUrl() for the images
function mockSupabase({ services = Promise.resolve({ data: MOCK_SERVICES, error: null }) } = {}) {
  const eq = vi.fn(() => ({ order: () => services }))

  supabase.from.mockReturnValue({ select: () => ({ eq }) })
  supabase.storage.from.mockReturnValue({
    getPublicUrl: (path) => ({ data: { publicUrl: `https://example.com/${path}` } }),
  })

  return { eq }
}

function renderServices() {
  return render(
    <MemoryRouter initialEntries={['/services']}>
      <Routes>
        <Route path="/services" element={<Services />} />
        <Route path="/contact" element={<p>Contact Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Each card is a button labelled "Toggle details for <name>"
function findCard(name) {
  return screen.findByRole('button', { name: `Toggle details for ${name}` })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// SCRUM-247 AC: A loading message appears while services are loading.
describe('Loading', () => {
  it('shows a loading message while services load', () => {
    mockSupabase({ services: new Promise(() => {}) })
    renderServices()

    expect(screen.getByRole('status')).toHaveTextContent('Loading services...')
  })

  it('hides the loading message once services load', async () => {
    mockSupabase()
    renderServices()

    await findCard('Commercial Cleaning')

    expect(screen.queryByText('Loading services...')).not.toBeInTheDocument()
  })
})

// SCRUM-247 AC: All active services are shown (not only featured), each with its name and image.
describe('Service cards', () => {
  it('shows every active service, not only featured ones', async () => {
    const { eq } = mockSupabase()
    renderServices()

    expect(await findCard('Commercial Cleaning')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle details for Residential Cleaning' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle details for Window Cleaning' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(MOCK_SERVICES.length)
    expect(eq).toHaveBeenCalledWith('is_active', true)
  })

  it('shows the name and image on each card', async () => {
    mockSupabase()
    renderServices()

    await findCard('Commercial Cleaning')

    for (const service of MOCK_SERVICES) {
      const card = screen.getByRole('button', { name: `Toggle details for ${service.name}` })
      // The name is on both faces, so check the front title specifically
      expect(card.querySelector('.service-card-front .service-card-title')).toHaveTextContent(service.name)
      expect(within(card).getByAltText(service.name)).toHaveAttribute('src', `https://example.com/${service.image_path}`)
    }
  })
})

// SCRUM-247 AC: Clicking a card flips it, and clicking it again flips it back.
describe('Card flip', () => {
  it('flips a card on click and back on a second click', async () => {
    mockSupabase()
    renderServices()

    const card = await findCard('Commercial Cleaning')
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(card).not.toHaveClass('is-flipped')

    await userEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveClass('is-flipped')

    await userEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(card).not.toHaveClass('is-flipped')
  })

  it('flips only the card that was clicked', async () => {
    mockSupabase()
    renderServices()

    const commercial = await findCard('Commercial Cleaning')
    const residential = screen.getByRole('button', { name: 'Toggle details for Residential Cleaning' })

    await userEvent.click(commercial)

    expect(commercial).toHaveAttribute('aria-pressed', 'true')
    expect(residential).toHaveAttribute('aria-pressed', 'false')
  })
})

// SCRUM-247 AC: The back of a card shows the admin description, then the built-in one, then the default.
// The back is always in the DOM (the flip is CSS only), so these check the text without clicking.
describe('Card description', () => {
  it('shows the admin-written description when there is one', async () => {
    mockSupabase()
    renderServices()

    const card = await findCard('Commercial Cleaning')

    expect(within(card).getByText('Admin-written office cleaning.')).toBeInTheDocument()
  })

  it('shows the built-in description when there is no admin description', async () => {
    mockSupabase()
    renderServices()

    const card = await findCard('Residential Cleaning')

    expect(within(card).getByText(BUILT_IN_RESIDENTIAL)).toBeInTheDocument()
  })

  it('shows the default description when neither exists', async () => {
    mockSupabase()
    renderServices()

    const card = await findCard('Window Cleaning')

    expect(within(card).getByText(DEFAULT_DESCRIPTION)).toBeInTheDocument()
  })
})

// SCRUM-247 AC: If services fail to load, the built-in list of services is shown instead.
describe('Load failure', () => {
  it('shows the built-in services if loading fails', async () => {
    mockSupabase({ services: Promise.resolve({ data: null, error: { message: 'boom' } }) })
    renderServices()

    await findCard(SERVICES_LIST[0].name)

    for (const service of SERVICES_LIST) {
      const card = screen.getByRole('button', { name: `Toggle details for ${service.name}` })
      expect(within(card).getByText(service.description)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(SERVICES_LIST.length)
    expect(screen.queryByText('Loading services...')).not.toBeInTheDocument()
  })
})

// SCRUM-247 AC: The "Request a quote" button links to the Contact page.
describe('Request a quote', () => {
  it('links to the contact page', async () => {
    mockSupabase()
    renderServices()

    const link = screen.getByRole('link', { name: /request a quote/i })
    expect(link).toHaveAttribute('href', '/contact')

    await userEvent.click(link)

    expect(await screen.findByText('Contact Page')).toBeInTheDocument()
  })
})
