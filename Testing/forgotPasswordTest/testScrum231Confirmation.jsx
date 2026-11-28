import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ResetConfirmation from '../../src/pages/ResetConfirmation'
import ResetPassword from '../../src/pages/ResetPassword'
import { clearPasswordRecovery, isRecoverySession } from '../../src/lib/passwordRecovery'

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn(),
      updateUser: vi.fn(), signOut: vi.fn(),
    },
  },
}))
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase, recoveryLinkAccessToken: null, recoveryLinkError: null,
}))

function verifiedSession() {
  const claims = { session_id: 'verified-recovery-session', amr: [{ method: 'recovery' }] }
  return { access_token: `header.${btoa(JSON.stringify(claims))}.signature` }
}

function renderConfirmation(hash = '', path = '/reset-password/continue') {
  window.history.replaceState({}, '', `${path}${hash}`)
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/reset-password/continue" element={<ResetConfirmation />} />
        <Route path="/continue" element={<ResetConfirmation />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/signin" element={<p>Sign In Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SCRUM-231 email-link confirmation page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearPasswordRecovery()
    const session = verifiedSession()
    supabase.auth.verifyOtp.mockResolvedValue({ data: { session }, error: null })
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  afterEach(() => {
    clearPasswordRecovery()
    window.history.replaceState({}, '', '/')
  })

  it('requires Continue for a syntactically valid token and removes it from the address bar', () => {
    renderConfirmation('#token_hash=not-a-real-token_123')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/reset-password/continue')
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
  })

  it.each([
    '',
    '#token_hash=',
    '#access_token=wrong-parameter',
    '#token_hash=bad%20token',
    '#token_hash=token&redirect_to=https://example.com',
    `#token_hash=${'a'.repeat(513)}`,
  ])('rejects missing or malformed token input %j', hash => {
    renderConfirmation(hash)
    expect(screen.getByRole('alert')).toHaveTextContent('This password-reset link is invalid. Please request a new one.')
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
  })

  it.each(['/reset-password/continue', '/continue'])(
    'verifies recovery directly from %s and opens the real reset form on the same origin', async path => {
      const user = userEvent.setup()
      renderConfirmation('#token_hash=not-a-real-token_123', path)
      const origin = window.location.origin
      await user.click(screen.getByRole('button', { name: 'Continue' }))
      expect(await screen.findByLabelText('New Password')).toBeInTheDocument()
      expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1)
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'not-a-real-token_123', type: 'recovery',
      })
      expect(isRecoverySession(verifiedSession())).toBe(true)
      expect(window.location.origin).toBe(origin)
      expect(window.location.hash).toBe('')
    }
  )

  it('shows an expired-link error without opening the reset form', async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } })
    const user = userEvent.setup()
    renderConfirmation('#token_hash=expired-token')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Token has expired or is invalid')
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
  })

  it('rejects a verification response that does not create a session', async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderConfirmation('#token_hash=missing-session-token')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This password-reset link is invalid or has expired.')
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
  })

  it('handles a network failure and lets the user retry', async () => {
    supabase.auth.verifyOtp.mockRejectedValueOnce(new Error('Network unavailable'))
    const user = userEvent.setup()
    renderConfirmation('#token_hash=retry-token')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByLabelText('New Password')).toBeInTheDocument()
  })

  it('disables Continue and prevents duplicate verification while pending', async () => {
    let finish
    supabase.auth.verifyOtp.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    renderConfirmation('#token_hash=pending-token')
    await user.dblClick(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled()
    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1)
    await act(async () => finish({ data: { session: verifiedSession() }, error: null }))
    expect(await screen.findByLabelText('New Password')).toBeInTheDocument()
  })

  it('lets a user return to sign in after an invalid confirmation link', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(screen.getByRole('link', { name: 'Return to Sign In' }))
    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })
})
