// SCRUM-235: Landing page testing
// Automated tests for the landing page (Home) so changes don't break the first page customers see.

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Home from '../../src/pages/Home'

// Supabase is mocked so tests never hit the real database and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const MOCK_SERVICES = [
  { id: 1, name: 'Residential Cleaning', image_path: 'res.jpg', is_featured: true },
  { id: 2, name: 'Commercial Cleaning', image_path: 'com.jpg', is_featured: true },
  { id: 3, name: 'Window Cleaning', image_path: 'win.jpg', is_featured: false },
]

const MOCK_REVIEWS = [
  { id: 'r1', customer_name: 'Jane D.', review: 'Spotless kitchen!', rating: 5, created_at: '2026-01-15T12:00:00Z' },
  { id: 'r2', customer_name: 'Sam P.', review: 'Very friendly team.', rating: 4, created_at: '2026-01-10T12:00:00Z' },
]

// Helper: Home talks to 3 tables, so hand back a different fake for each one.
function mockSupabase({
  services = Promise.resolve({ data: MOCK_SERVICES, error: null }),
  reviews = Promise.resolve({ data: MOCK_REVIEWS, error: null }),
  insertResult = { error: null },
} = {}) {
  const limit = vi.fn(() => reviews)
  const insert = vi.fn().mockResolvedValue(insertResult)

  supabase.from.mockImplementation((table) => {
    if (table === 'services') {
      // from('services').select().eq().order()
      return { select: () => ({ eq: () => ({ order: () => services }) }) }
    }
    if (table === 'customer_reviews') {
      // from('customer_reviews').select().eq().order().limit(3)
      return { select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) }
    }
    if (table === 'quotes') {
      // from('quotes').insert({...})
      return { insert }
    }
  })
  supabase.storage.from.mockReturnValue({
    getPublicUrl: (path) => ({ data: { publicUrl: `https://example.com/${path}` } }),
  })

  return { limit, insert }
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<p>Contact Page</p>} />
        <Route path="/services" element={<p>Services Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Helper: fill every quote field (the button stays disabled until all are filled)
async function fillQuoteForm(overrides = {}) {
  const values = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9161234567',
    address: '123 Main St',
    message: 'Please clean my kitchen.',
    ...overrides,
  }
  await userEvent.type(screen.getByPlaceholderText('Name'), values.name)
  await userEvent.type(screen.getByPlaceholderText('Email'), values.email)
  await userEvent.type(screen.getByPlaceholderText('Phone'), values.phone)
  await userEvent.type(screen.getByPlaceholderText('Address'), values.address)
  await userEvent.selectOptions(screen.getByDisplayValue('Select property type'), 'Residential')
  await userEvent.selectOptions(screen.getByDisplayValue('Select service type'), 'Deep Cleaning')
  await userEvent.type(screen.getByPlaceholderText('How can we help?'), values.message)
}

function submitQuoteForm() {
  fireEvent.submit(screen.getByRole('button', { name: /get my free quote/i }).closest('form'))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// SCRUM-235 AC: The hero buttons link to the correct pages.
describe('Hero buttons', () => {
  it('Book Now goes to the contact page', async () => {
    mockSupabase()
    renderHome()

    await userEvent.click(screen.getByRole('link', { name: /book now/i }))

    expect(await screen.findByText('Contact Page')).toBeInTheDocument()
  })

  it('Our Services goes to the services page', async () => {
    mockSupabase()
    renderHome()

    await userEvent.click(screen.getByRole('link', { name: /^our services$/i }))

    expect(await screen.findByText('Services Page')).toBeInTheDocument()
  })
})

// SCRUM-235 AC: Only featured services are shown, and the cards flip when clicked.
describe('Featured services', () => {
  it('shows only featured services', async () => {
    mockSupabase()
    renderHome()

    expect(await screen.findByRole('button', { name: /residential cleaning/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /commercial cleaning/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /window cleaning/i })).not.toBeInTheDocument()
  })

  it('flips a card when clicked', async () => {
    mockSupabase()
    renderHome()

    const card = await screen.findByRole('button', { name: /residential cleaning/i })
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(card)

    expect(card).toHaveAttribute('aria-pressed', 'true')
  })
})

// SCRUM-235 AC: Testimonials show a loading message, up to 3 reviews, and an error message if loading fails.
describe('Testimonials', () => {
  it('shows a loading message while reviews load', () => {
    mockSupabase({ reviews: new Promise(() => {}) })
    renderHome()

    expect(screen.getByText('Loading testimonials...')).toBeInTheDocument()
  })

  it('shows the reviews and asks for at most 3', async () => {
    const { limit } = mockSupabase()
    renderHome()

    expect(await screen.findByText('Spotless kitchen!')).toBeInTheDocument()
    expect(screen.getByText('Very friendly team.')).toBeInTheDocument()
    expect(limit).toHaveBeenCalledWith(3)
  })

  it('shows an error message if loading fails', async () => {
    mockSupabase({ reviews: Promise.resolve({ data: null, error: { message: 'boom' } }) })
    renderHome()

    expect(await screen.findByText('We could not load testimonials right now.')).toBeInTheDocument()
  })
})

// SCRUM-235 AC: Quote form validation, saving, and error handling.
describe('Quote form', () => {
  it('rejects an invalid email', async () => {
    const { insert } = mockSupabase()
    renderHome()

    await fillQuoteForm({ email: 'not-an-email' })
    submitQuoteForm()

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects an invalid phone number', async () => {
    const { insert } = mockSupabase()
    renderHome()

    await fillQuoteForm({ phone: '123' })
    submitQuoteForm()

    expect(await screen.findByText('Please enter a valid 10-digit phone number.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })

  it('saves a valid quote and shows a success message', async () => {
    const { insert } = mockSupabase()
    renderHome()

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(/we've received your quote request/i)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      customer_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '9161234567',
      status: 'pending',
    }))
  })

  it('shows an error and keeps the input if saving fails', async () => {
    mockSupabase({ insertResult: { error: { message: 'db down' } } })
    renderHome()

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(/something went wrong submitting your quote/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByPlaceholderText('Email')).toHaveValue('jane@example.com')
  })
})
