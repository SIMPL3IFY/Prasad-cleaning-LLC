import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Header from '../../src/components/Header'
import NotFound from '../../src/pages/NotFound'

// Fake AuthContext state
const mockAuth = {
  user: null,
  loading: false,
}

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

// Fake Supabase Client
const mockSignOut = vi.fn().mockResolvedValue({ error: null })
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))
supabase.auth.signOut = mockSignOut

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

// Helper to mock profile lookup for account role checks
function mockProfileRole(isAdmin) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  supabase.from.mockReturnValue({ select })
  return { select, eq, maybeSingle }
}

function renderHeader(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Header />
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/services" element={<div>Services Page</div>} />
        <Route path="/about" element={<div>About Page</div>} />
        <Route path="/testimonials" element={<div>Testimonials Page</div>} />
        <Route path="/service-area" element={<div>Service Areas Page</div>} />
        <Route path="/contact" element={<div>Contact Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/portal" element={<div>Customer Portal Page</div>} />
        <Route path="/admin" element={<div>Admin Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Header Component - Complete Button & Link Testing (SCRUM-233)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.user = null
    mockAuth.loading = false
    mockSignOut.mockResolvedValue({ error: null })
  })

  // ---------------------------------------------------------------------------
  // 1. Navigation Links & Logo Clicking
  // ---------------------------------------------------------------------------
  it('navigates to Home page when the logo link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/about')

    const logoLink = screen.getByRole('link', { name: /go to homepage/i })
    await user.click(logoLink)

    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })

  it('navigates to Services page when the Services link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const servicesLink = screen.getByRole('link', { name: /^services$/i })
    await user.click(servicesLink)

    expect(await screen.findByText('Services Page')).toBeInTheDocument()
  })

  it('navigates to About page when the About link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const aboutLink = screen.getByRole('link', { name: /^about$/i })
    await user.click(aboutLink)

    expect(await screen.findByText('About Page')).toBeInTheDocument()
  })

  it('navigates to Testimonials page when the Testimonials link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const testimonialsLink = screen.getByRole('link', { name: /^testimonials$/i })
    await user.click(testimonialsLink)

    expect(await screen.findByText('Testimonials Page')).toBeInTheDocument()
  })

  it('navigates to Service Areas page when the Service Areas link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const serviceAreaLink = screen.getByRole('link', { name: /^service areas$/i })
    await user.click(serviceAreaLink)

    expect(await screen.findByText('Service Areas Page')).toBeInTheDocument()
  })

  it('navigates to Contact page when the Contact link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const contactLink = screen.getByRole('link', { name: /^contact$/i })
    await user.click(contactLink)

    expect(await screen.findByText('Contact Page')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // 2. Active Link State Check
  // ---------------------------------------------------------------------------
  it('sets aria-current="page" on the active route link', () => {
    renderHeader('/about')

    expect(screen.getByRole('link', { name: /^about$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /^services$/i })).not.toHaveAttribute('aria-current')
  })

  // ---------------------------------------------------------------------------
  // 3. Desktop Authentication Buttons & Edge Cases
  // ---------------------------------------------------------------------------
  it('navigates to /signin when clicking desktop "Sign In" button', async () => {
    const user = userEvent.setup()
    mockAuth.user = null
    renderHeader('/')

    const signInLink = screen.getByRole('link', { name: /^sign in$/i })
    await user.click(signInLink)

    expect(await screen.findByText('Sign In Page')).toBeInTheDocument()
  })

  it('navigates customer to /portal when clicking desktop "Dashboard" button', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'customer-789' }
    mockProfileRole(false)
    renderHeader('/')

    const dashboardBtn = screen.getByRole('button', { name: /^dashboard$/i })
    await user.click(dashboardBtn)

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
  })

  it('navigates admin to /admin when clicking desktop "Dashboard" button', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'admin-789' }
    mockProfileRole(true)
    renderHeader('/')

    const dashboardBtn = screen.getByRole('button', { name: /^dashboard$/i })
    await user.click(dashboardBtn)

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
  })

  it('calls signOut and redirects home when clicking desktop "Sign Out" button', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'user-789' }
    renderHeader('/about')

    const signOutBtn = screen.getByRole('button', { name: /^sign out$/i })
    await user.click(signOutBtn)

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })

  it('does NOT redirect home if sign-out returns an error', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'user-789' }
    mockSignOut.mockResolvedValueOnce({ error: { message: 'Sign out failed' } })
    renderHeader('/about')

    const signOutBtn = screen.getByRole('button', { name: /^sign out$/i })
    await user.click(signOutBtn)

    expect(mockSignOut).toHaveBeenCalled()
    expect(screen.getByText('About Page')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // 4. Hamburger Toggle & Mobile Authentication Buttons (Scoped via `within()`)
  // ---------------------------------------------------------------------------
  it('toggles mobile menu open/close using hamburger button', async () => {
    const user = userEvent.setup()
    renderHeader('/')

    const hamburger = screen.getByRole('button', { name: /open menu/i })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')

    await user.click(hamburger)
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /close menu/i }))
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates to /signin when clicking mobile menu "Sign In" button and closes menu', async () => {
    const user = userEvent.setup()
    mockAuth.user = null
    renderHeader('/')

    const hamburger = screen.getByRole('button', { name: /open menu/i })
    await user.click(hamburger)

    // Scope lookup to the open navigation container
    const navElement = screen.getByRole('navigation', { name: /main/i })
    const mobileSignInBtn = within(navElement).getByRole('button', { name: /^sign in$/i })
    
    await user.click(mobileSignInBtn)

    expect(await screen.findByText('Sign In Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates customer to /portal when clicking mobile menu "Dashboard" button and closes menu', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'customer-mobile-123' }
    mockProfileRole(false)
    renderHeader('/')

    const hamburger = screen.getByRole('button', { name: /open menu/i })
    await user.click(hamburger)

    const navElement = screen.getByRole('navigation', { name: /main/i })
    const mobileDashboardBtn = within(navElement).getByRole('button', { name: /^dashboard$/i })
    
    await user.click(mobileDashboardBtn)

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates admin to /admin when clicking mobile menu "Dashboard" button and closes menu', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'admin-mobile-999' }
    mockProfileRole(true)
    renderHeader('/')

    const hamburger = screen.getByRole('button', { name: /open menu/i })
    await user.click(hamburger)

    const navElement = screen.getByRole('navigation', { name: /main/i })
    const mobileAdminDashboardBtn = within(navElement).getByRole('button', { name: /^dashboard$/i })
    
    await user.click(mobileAdminDashboardBtn)

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls signOut when clicking mobile menu "Sign Out" button and closes menu', async () => {
    const user = userEvent.setup()
    mockAuth.user = { id: 'user-mobile-123' }
    renderHeader('/about')

    const hamburger = screen.getByRole('button', { name: /open menu/i })
    await user.click(hamburger)

    const navElement = screen.getByRole('navigation', { name: /main/i })
    const mobileSignOutBtn = within(navElement).getByRole('button', { name: /^sign out$/i })
    
    await user.click(mobileSignOutBtn)

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('Home Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  // 404 test checking the real NotFound component routing
  it('renders the real NotFound 404 page for unknown routes', async () => {
    render(
      <MemoryRouter initialEntries={['/some-bad-url']}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByRole('heading', { name: /404/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
