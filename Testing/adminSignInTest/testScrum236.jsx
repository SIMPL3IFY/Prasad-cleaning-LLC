import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SignIn from '../../src/pages/SignIn'
import ProtectedAdminRoute from '../../src/components/ProtectedAdminRoute'

// Supabase is mocked so tests never hit the real auth server and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const SIGNED_OUT_MESSAGE = 'Please sign in with an administrator account.'
const FORBIDDEN_MESSAGE = 'Access denied. This account is not an administrator.'

// Mocks supabase.from('profiles').select().eq().maybeSingle()
function mockProfile(result) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  supabase.from.mockReturnValue({ select })
  return { select, eq, maybeSingle }
}

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={['/signin']}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/portal" element={<p>Customer Portal Page</p>} />
        <Route path="/admin" element={<p>Admin Dashboard Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// The real SignIn page sits at /signin so the guard's redirect message is visible on screen.
function renderAdminRoute(initialEntry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/portal" element={<p>Customer Portal Page</p>} />
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin" element={<p>Admin Dashboard Page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

async function fillAndSubmit(user, email, password) {
  await user.type(screen.getByLabelText(/email address/i), email)
  await user.type(screen.getByLabelText(/^password$/i), password)
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.signOut.mockResolvedValue({ error: null })
})

describe('Admin Sign In', () => {
  it('sends an admin to the dashboard using their own profile', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const { select, eq } = mockProfile({ data: { is_admin: true }, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'admin@example.com', 'secret123')

    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith('is_admin')
    expect(eq).toHaveBeenCalledWith('id', 'admin-1')
  })

  it('trims and lowercases an admin email and still reaches the dashboard', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockProfile({ data: { is_admin: true }, error: null })
    renderSignIn()

    await fillAndSubmit(user, '  ADMIN@Example.COM  ', 'secret123')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'secret123',
    })
    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
  })

  it('sends a user with is_admin null to the portal, not the dashboard', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: { is_admin: null }, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'user@example.com', 'secret123')

    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })

  it('sends a user whose profile has no is_admin field to the portal', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: {}, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'user@example.com', 'secret123')

    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })
})

describe('Admin Route Guard', () => {
  it('shows "Verifying admin access..." while the check is running', () => {
    supabase.auth.getUser.mockReturnValue(new Promise(() => {}))
    renderAdminRoute()

    expect(screen.getByRole('status')).toHaveTextContent('Verifying admin access...')
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })

  it('sends a signed-out visitor to sign in with the administrator message', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    renderAdminRoute()

    expect(await screen.findByText(SIGNED_OUT_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('treats a session error as signed out', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Session expired' } })
    renderAdminRoute()

    expect(await screen.findByText(SIGNED_OUT_MESSAGE)).toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('denies access to a signed-in customer', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: { is_admin: false }, error: null })
    renderAdminRoute()

    expect(await screen.findByText(FORBIDDEN_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })

  it('denies access when is_admin is null', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: { is_admin: null }, error: null })
    renderAdminRoute()

    expect(await screen.findByText(FORBIDDEN_MESSAGE)).toBeInTheDocument()
  })

  it('denies access when the profile lookup fails', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockProfile({ data: null, error: { message: 'db down' } })
    renderAdminRoute()

    expect(await screen.findByText(FORBIDDEN_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })

  it('lets an admin through to the dashboard', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const { eq } = mockProfile({ data: { is_admin: true }, error: null })
    renderAdminRoute()

    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
    expect(eq).toHaveBeenCalledWith('id', 'admin-1')
  })

  it('stops checking if the page is left before the session check finishes', async () => {
    let resolveUser
    supabase.auth.getUser.mockReturnValue(new Promise((resolve) => { resolveUser = resolve }))
    const { unmount } = renderAdminRoute()

    unmount()
    await resolveUser({ data: { user: { id: 'admin-1' } }, error: null })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('stops checking if the page is left before the profile check finishes', async () => {
    let resolveProfile
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const { maybeSingle } = mockProfile(null)
    maybeSingle.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve }))
    const { unmount } = renderAdminRoute()

    await vi.waitFor(() => expect(maybeSingle).toHaveBeenCalled())
    unmount()
    await resolveProfile({ data: { is_admin: true }, error: null })

    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument()
  })
})

describe('Admin Sign In + Route Guard together', () => {
  it('an admin signs in and passes the guard into the dashboard', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockProfile({ data: { is_admin: true }, error: null })
    renderAdminRoute('/signin')

    await fillAndSubmit(user, 'admin@example.com', 'secret123')

    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
    // Profile is checked twice: once by the sign-in page, once by the guard
    expect(supabase.auth.getUser).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledTimes(2)
  })
})
