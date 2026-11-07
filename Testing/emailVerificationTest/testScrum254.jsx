// SCRUM-254: Email authentication/verify testing
// Automated tests for the email confirmation page so changes don't stop new customers from verifying their account after signing up.

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AuthCallback from '../../src/pages/AuthCallback'

// Supabase is mocked so tests never hit the real auth server and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const SESSION = { user: { id: 'user-1', email: 'jane@example.com' } }
const EXPIRED_LINK_HASH = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'

// Helper: fakes the auth calls the page makes and returns a function that fires an auth event,
// the way Supabase does after it reads the tokens from the confirmation link.
function mockAuth({ session = null } = {}) {
  let authListener
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authListener = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  supabase.auth.getSession.mockResolvedValue({ data: { session } })
  supabase.auth.signOut.mockResolvedValue({ error: null })

  return {
    fireAuthEvent: (event, eventSession) => act(async () => authListener(event, eventSession)),
  }
}

// The page reads link errors from the real address bar, so the hash goes there too.
function renderAuthCallback(hash = '') {
  window.history.replaceState({}, '', `/auth/callback${hash}`)
  return render(
    <MemoryRouter initialEntries={['/auth/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/signin" element={<p>Sign In Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Lets pending promises (getSession, signOut) finish and moves fake time forward
async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
})

// SCRUM-254 AC: While the link is being checked, the page shows a waiting message.
describe('Checking the link', () => {
  it('shows "Confirming your email..." while the link is checked', () => {
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    supabase.auth.getSession.mockReturnValue(new Promise(() => {}))
    renderAuthCallback()

    expect(screen.getByRole('heading', { name: 'Confirming your email...' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Please wait a moment.')
  })
})

// SCRUM-254 AC: A valid link confirms the email, signs the customer out, and sends them to Sign In.
describe('Valid confirmation link', () => {
  it('shows "Email confirmed" when the link signs the customer in', async () => {
    mockAuth({ session: SESSION })
    renderAuthCallback()

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your email has been verified. Redirecting you to sign in...')
  })

  it('confirms when Supabase reports the sign-in after the first check', async () => {
    // Supabase can still be reading the link when the page first asks for the session
    const { fireAuthEvent } = mockAuth({ session: null })
    renderAuthCallback()

    await fireAuthEvent('SIGNED_IN', SESSION)

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
  })

  it('signs the customer out so they sign in themselves', async () => {
    mockAuth({ session: SESSION })
    renderAuthCallback()

    await screen.findByRole('heading', { name: 'Email confirmed' })

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('redirects to the Sign In page about 2.5 seconds after confirming', async () => {
    vi.useFakeTimers()
    mockAuth({ session: SESSION })
    renderAuthCallback()

    await advance()
    expect(screen.getByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()

    await advance(2499)
    expect(screen.queryByText('Sign In Page')).not.toBeInTheDocument()

    await advance(1)
    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })

  it('"Go to Sign In" goes to the Sign In page', async () => {
    mockAuth({ session: SESSION })
    renderAuthCallback()

    await userEvent.click(await screen.findByRole('link', { name: 'Go to Sign In' }))

    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })

  it('confirms only once, even if Supabase reports the sign-in twice', async () => {
    const { fireAuthEvent } = mockAuth({ session: SESSION })
    renderAuthCallback()

    await screen.findByRole('heading', { name: 'Email confirmed' })
    await fireAuthEvent('SIGNED_IN', SESSION)

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
  })
})

// SCRUM-254 AC: An expired, used, or invalid link shows an error and a way back to Sign In.
describe('Failed confirmation', () => {
  it('shows the error from an expired or already-used link', () => {
    mockAuth()
    renderAuthCallback(EXPIRED_LINK_HASH)

    expect(screen.getByRole('heading', { name: 'Confirmation failed' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Email link is invalid or has expired')
    // The page stops at the link error and never tries to confirm
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('shows "This confirmation link is invalid or has expired." if nothing confirms within 5 seconds', async () => {
    vi.useFakeTimers()
    mockAuth({ session: null })
    renderAuthCallback()

    await advance(4999)
    expect(screen.getByRole('heading', { name: 'Confirming your email...' })).toBeInTheDocument()

    await advance(1)
    expect(screen.getByRole('heading', { name: 'Confirmation failed' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This confirmation link is invalid or has expired.')
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('"Go to Sign In" goes to the Sign In page to request a new email', async () => {
    mockAuth()
    renderAuthCallback(EXPIRED_LINK_HASH)

    expect(screen.getByText(/to request a new confirmation email/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Go to Sign In' }))

    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })
})
