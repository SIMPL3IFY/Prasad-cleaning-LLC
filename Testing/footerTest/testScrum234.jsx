import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Footer from '../../src/components/Footer'

// Fake AuthContext
const mockAuth = { user: null, loading: false }
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

// Fake Supabase Client
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

function mockProfileRole(isAdmin, error = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  supabase.from.mockReturnValue({ select })
}

function renderFooter(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Footer />
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/about" element={<div>About Page</div>} />
        <Route path="/testimonials" element={<div>Testimonials Page</div>} />
        <Route path="/contact" element={<div>Contact Page</div>} />
        <Route path="/services" element={<div>Services Page</div>} />
        <Route path="/service-area" element={<div>Service Areas Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/signup" element={<div>Sign Up Page</div>} />
        <Route path="/portal" element={<div>Customer Portal Page</div>} />
        <Route path="/settings" element={<div>Change User Settings</div>} />
        <Route path="/admin" element={<div>Admin Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Footer Component (SCRUM-234)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.user = null
    mockAuth.loading = false
  })

  it('renders static navigation links when signed out', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: /prasad's cleaning llc/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /about us/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /testimonials/i })).toHaveAttribute('href', '/testimonials')
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
    expect(screen.getByRole('link', { name: /our services/i })).toHaveAttribute('href', '/services')
    expect(screen.getByRole('link', { name: /service areas/i })).toHaveAttribute('href', '/service-area')
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/signup')
  })

  it('renders phone link with tel: protocol and email link with mailto: protocol and pre-filled subject', () => {
    renderFooter()

    const phoneLink = screen.getByRole('link', { name: /\(916\) 665-8474/i })
    expect(phoneLink).toHaveAttribute('href', 'tel:+19166658474')

    const emailLink = screen.getByRole('link', { name: /prasadscleaning@gmail.com/i })
    expect(emailLink).toHaveAttribute(
      'href',
      "mailto:prasadscleaning@gmail.com?subject=Inquiry%20from%20Prasad's%20Cleaning%20website"
    )
  })

  it('dynamically displays the current year in copyright footer bottom', () => {
    renderFooter()
    const currentYear = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(`© ${currentYear} Prasad's Cleaning LLC`, 'i'))).toBeInTheDocument()
  })

  it('hides account links while auth context is loading', () => {
    mockAuth.user = null
    mockAuth.loading = true
    renderFooter()

    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^create account$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^dashboard$/i })).not.toBeInTheDocument()
  })

  it('shows Dashboard and Settings links, hides Sign In / Create Account, and navigates to Customer Portal when clicked', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'customer-123' }
    mockProfileRole(false)
    renderFooter('/about')

    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^create account$/i })).not.toBeInTheDocument()

    const dashboardLink = await screen.findByRole('link', { name: /^dashboard$/i })
    expect(dashboardLink).toHaveAttribute('href', '/portal')
    expect(screen.getByRole('link', { name: /^settings$/i })).toHaveAttribute('href', '/settings')

    await user.click(dashboardLink)
    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
  })

  it('shows Dashboard link, hides Settings link, and navigates to Admin Dashboard when clicked as admin', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'admin-123' }
    mockProfileRole(true)
    renderFooter('/about')

    const dashboardLink = await screen.findByRole('link', { name: /^dashboard$/i })
    expect(dashboardLink).toHaveAttribute('href', '/admin')

    // Admin footer should NOT include customer Settings link
    expect(screen.queryByRole('link', { name: /^settings$/i })).not.toBeInTheDocument()

    await user.click(dashboardLink)
    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
  })

  it('navigates customer to Settings page when clicking Settings in footer', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'user-123' }
    mockProfileRole(false)
    renderFooter('/about')

    const settingsLink = await screen.findByRole('link', { name: /^settings$/i })
    await user.click(settingsLink)

    expect(await screen.findByText('Change User Settings')).toBeInTheDocument()
  })

  it('hides Dashboard link during slow profile lookup to prevent incorrect routing', async () => {
    mockAuth.user = { id: 'admin-slow' }
    let resolvePromise
    const delayedPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    const maybeSingle = vi.fn().mockReturnValue(delayedPromise)
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    renderFooter()

    // Dashboard link should NOT be present while waiting (prevents admin defaulting to /portal)
    expect(screen.queryByRole('link', { name: /^dashboard$/i })).not.toBeInTheDocument()

    resolvePromise({ data: { is_admin: true }, error: null })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/admin')
    })
  })
})
