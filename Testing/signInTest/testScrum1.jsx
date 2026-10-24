import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SignIn from '../../src/pages/SignIn'

// Supabase is mocked so tests never hit the real auth server and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

// Mocks supabase.from('profiles').select().eq().maybeSingle()
function mockProfile(result) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  supabase.from.mockReturnValue({ select })
  return { select, eq, maybeSingle }
}

function renderSignIn(initialEntry = '/signin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/portal" element={<p>Customer Portal Page</p>} />
        <Route path="/admin" element={<p>Admin Dashboard Page</p>} />
        <Route path="/signup" element={<p>Sign Up Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function fillAndSubmit(user, email, password) {
  await user.type(screen.getByLabelText(/email address/i), email)
  await user.type(screen.getByLabelText(/^password$/i), password)
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
}

describe('Customer Sign In', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('renders the sign in form', () => {
    renderSignIn()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('shows an error when email or password is missing', () => {
    const { container } = renderSignIn()
    // Submit the form directly to skip the browser's built-in "required" check
    fireEvent.submit(container.querySelector('form'))
    expect(screen.getByText('Please enter both email and password.')).toBeInTheDocument()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows an error for an invalid email address', () => {
    const { container } = renderSignIn()
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } })
    fireEvent.submit(container.querySelector('form'))
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('trims and lowercases the email before signing in', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: { is_admin: false }, error: null })
    renderSignIn()

    await fillAndSubmit(user, '  Customer@Example.COM  ', 'secret123')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'customer@example.com',
      password: 'secret123',
    })
  })

  it('sends a customer to the portal after a successful sign in', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const { eq } = mockProfile({ data: { is_admin: false }, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByText('Customer Portal Page')).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('sends an admin to the admin dashboard', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'a1' } }, error: null })
    mockProfile({ data: { is_admin: true }, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'admin@example.com', 'secret123')

    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument()
  })

  it('shows the Supabase error for wrong credentials', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'wrongpass')

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
    expect(screen.getByText('Sign In', { selector: 'h1' })).toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('shows "Signing In..." and disables the form while the request is pending', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockReturnValue(new Promise(() => {}))
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    expect(screen.getByLabelText(/email address/i)).toBeDisabled()
    expect(screen.getByLabelText(/^password$/i)).toBeDisabled()
  })

  it('signs out and shows an error when the profile is not found', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: null, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByText('User profile not found. Please try again.')).toBeInTheDocument()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('signs out and shows an error when the profile lookup fails', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfile({ data: null, error: { message: 'db down' } })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByText('Unable to retrieve user profile. Please try again.')).toBeInTheDocument()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('asks unconfirmed users to confirm their email and lets them resend it', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    supabase.auth.resend.mockResolvedValue({ error: null })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByText(/please confirm your email before signing in/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /resend confirmation email/i }))

    expect(supabase.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'customer@example.com' })
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A new confirmation link was sent to customer@example.com.'
    )
    expect(screen.getByRole('button', { name: /resend available in 60s/i })).toBeDisabled()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderSignIn()
    const password = screen.getByLabelText(/^password$/i)

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('shows a message passed in from navigation state', () => {
    renderSignIn({ pathname: '/signin', state: { message: 'Please sign in to continue.' } })
    expect(screen.getByText('Please sign in to continue.')).toBeInTheDocument()
  })

  it('goes to the sign up page from the Sign Up button', async () => {
    const user = userEvent.setup()
    renderSignIn()
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    expect(screen.getByText('Sign Up Page')).toBeInTheDocument()
  })

  it('goes to the sign up page from the "Create one" link', async () => {
    const user = userEvent.setup()
    renderSignIn()
    await user.click(screen.getByRole('link', { name: /create one/i }))
    expect(screen.getByText('Sign Up Page')).toBeInTheDocument()
  })

  it('shows an error when Supabase returns no user and no error', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByText('Unable to identify the signed-in account. Please try again.')).toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('treats a "not confirmed" message without an error code as unconfirmed', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email not confirmed' },
    })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')

    expect(await screen.findByRole('button', { name: /resend confirmation email/i })).toBeInTheDocument()
  })

  it('shows the Supabase error when resending the confirmation email fails', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    supabase.auth.resend.mockResolvedValue({ error: { message: 'For security purposes, you can only request this after 60 seconds.' } })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')
    await user.click(await screen.findByRole('button', { name: /resend confirmation email/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('For security purposes, you can only request this after 60 seconds.')
    // No cooldown starts when the resend failed
    expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeEnabled()
  })

  it('counts the resend cooldown down each second', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    supabase.auth.resend.mockResolvedValue({ error: null })
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'secret123')
    await user.click(await screen.findByRole('button', { name: /resend confirmation email/i }))

    expect(await screen.findByRole('button', { name: /resend available in 60s/i })).toBeDisabled()
    expect(await screen.findByRole('button', { name: /resend available in 59s/i }, { timeout: 2000 })).toBeDisabled()
  })

  it('clears the previous error when the form is submitted again', async () => {
    const user = userEvent.setup()
    supabase.auth.signInWithPassword
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials' } })
      .mockReturnValueOnce(new Promise(() => {}))
    renderSignIn()

    await fillAndSubmit(user, 'customer@example.com', 'wrongpass')
    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(screen.queryByText('Invalid login credentials')).not.toBeInTheDocument()
  })
})
