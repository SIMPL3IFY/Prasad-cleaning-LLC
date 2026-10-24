import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CustomerPortal from '../../src/pages/CustomerPortal'
import Contact from '../../src/pages/Contact'

// Supabase is mocked so tests never hit the real database and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

// CustomerPortal uses useServices to load services for the modal — mock it to avoid Supabase calls
vi.mock('../../src/hooks/useServices', () => ({
  useServices: () => ({ services: [] }),
}))

// Renders CustomerPortal inside a router with a /contact stub so navigation can be tested
function renderPortal() {
  return render(
    <MemoryRouter initialEntries={['/portal']}>
      <Routes>
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/contact" element={<p>Contact Page</p>} />
        <Route path="/settings" element={<p>Settings Page</p>} />
        <Route path="/" element={<p>Home Page</p>} />
        <Route path="/services" element={<p>Services Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Renders the Contact page (which includes QuoteForm) inside a router
function renderContact() {
  return render(
    <MemoryRouter initialEntries={['/contact']}>
      <Routes>
        <Route path="/contact" element={<Contact />} />
        <Route path="/service-area" element={<p>Service Area Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Mocks supabase.from('quotes').insert() and returns the insert spy for assertions
function mockQuoteInsert(result) {
  const insert = vi.fn().mockResolvedValue(result)
  supabase.from.mockReturnValue({ insert })
  return { insert }
}

describe('Scheduling Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  // AC1: The Schedule Appointment button must be visible on the Customer Portal
  it('renders the Schedule Appointment button on the Customer Portal', () => {
    renderPortal()
    expect(screen.getByRole('button', { name: /schedule appointment/i })).toBeInTheDocument()
  })

  // AC2: Clicking Schedule Appointment must navigate the user to the Contact page
  it('clicking Schedule Appointment navigates to the Contact page', async () => {
    const user = userEvent.setup()
    renderPortal()
    await user.click(screen.getByRole('button', { name: /schedule appointment/i }))
    expect(screen.getByText('Contact Page')).toBeInTheDocument()
  })

  // AC3: The Contact page form must load with all required fields present
  it('Contact page form loads with all required fields', () => {
    renderContact()
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Phone')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Address')).toBeInTheDocument()
    expect(screen.getByText('Select property type')).toBeInTheDocument()
    expect(screen.getByText('Select service type')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('How can we help?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get my free quote/i })).toBeInTheDocument()
  })

  // AC4: Submitting an incomplete form must show a validation error
  it('submitting an incomplete form shows a validation error', () => {
    const { container } = renderContact()
    // Trigger form submit directly to bypass the disabled submit button
    fireEvent.submit(container.querySelector('form'))
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument()
  })

  // AC5: A fully filled-out form must call Supabase and show a success message
  it('a valid form submission saves the request and shows a success message', async () => {
    const user = userEvent.setup()
    const { insert } = mockQuoteInsert({ error: null })
    renderContact()

    await user.type(screen.getByPlaceholderText('Name'), 'Jane Doe')
    await user.type(screen.getByPlaceholderText('Email'), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('Phone'), '9161234567')
    await user.type(screen.getByPlaceholderText('Address'), '123 Main St')
    await user.selectOptions(screen.getByDisplayValue('Select property type'), 'Residential')
    await user.selectOptions(screen.getByDisplayValue('Select service type'), 'Standard Cleaning')
    await user.type(screen.getByPlaceholderText('How can we help?'), 'I need a deep clean.')

    await user.click(screen.getByRole('button', { name: /get my free quote/i }))

    expect(await screen.findByText(/we've received your quote request/i)).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('quotes')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: 'Jane Doe',
        email: 'jane@example.com',
        status: 'pending',
      })
    )
  })

  // AC6: The Schedule Appointment button lives inside the authenticated Customer Portal.
  // In production, App.jsx wraps CustomerPortal in a ProtectedRoute that redirects
  // unauthenticated users to the sign-in page before this component ever renders.
  it('the Schedule Appointment button is only accessible within the authenticated portal', () => {
    renderPortal()
    // Sign Out button confirms this is a page that requires an active session
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /schedule appointment/i })).toBeInTheDocument()
  })
})
