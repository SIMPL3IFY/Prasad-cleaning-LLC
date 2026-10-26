import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPassword from '../../src/pages/ResetPassword'

const { supabase, recovery, unsubscribe } = vi.hoisted(() => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() } },
  recovery: { token: null, error: null, listener: null },
  unsubscribe: vi.fn(),
}))
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase,
  get recoveryLinkAccessToken() { return recovery.token },
  get recoveryLinkError() { return recovery.error },
}))

const invalidLink = 'This password-reset link is invalid or has expired. Please request a new one.'

function renderReset() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/signin" element={<p>Sign In Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function readyReset() {
  recovery.token = 'test-recovery-token'
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: recovery.token } }, error: null })
  const result = renderReset()
  await screen.findByLabelText('New Password')
  return result
}

function submitPasswords(password, confirmation = password) {
  const input = screen.getByLabelText('New Password')
  fireEvent.change(input, { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirmation } })
  fireEvent.submit(input.closest('form'))
}

describe('SCRUM-231 recovery-link verification and new password', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    recovery.token = null
    recovery.error = null
    recovery.listener = null
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    supabase.auth.onAuthStateChange.mockImplementation(callback => {
      recovery.listener = callback
      return { data: { subscription: { unsubscribe } } }
    })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('shows link checking until the session lookup finishes', async () => {
    let finish
    supabase.auth.getSession.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderReset()
    expect(screen.getByText('Checking your reset link...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update Password' })).not.toBeInTheDocument()
    await act(async () => { finish({ data: { session: null }, error: null }) })
    expect(screen.getByRole('alert')).toHaveTextContent(invalidLink)
  })

  it('rejects a direct visit without a recovery session and can return to sign in', async () => {
    const user = userEvent.setup()
    renderReset()
    expect(await screen.findByRole('alert')).toHaveTextContent(invalidLink)
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Return to Sign In' }))
    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })

  it('does not treat an ordinary signed-in session as password recovery', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'ordinary-session' } }, error: null })
    renderReset()
    await screen.findByRole('alert')
    await act(async () => { recovery.listener('SIGNED_IN', { access_token: 'ordinary-session' }) })
    expect(screen.getByRole('alert')).toHaveTextContent(invalidLink)
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
  })

  it('rejects a recovery token that does not match the current session', async () => {
    recovery.token = 'url-token'
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'different-token' } }, error: null })
    renderReset()
    expect(await screen.findByRole('alert')).toHaveTextContent(invalidLink)
  })

  it('rejects a failed session lookup even if the token text matches', async () => {
    recovery.token = 'url-token'
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: recovery.token } }, error: { message: 'Invalid session' } })
    renderReset()
    expect(await screen.findByRole('alert')).toHaveTextContent(invalidLink)
  })

  it('rejects a link error even if a recovery event arrives', async () => {
    recovery.error = 'access_denied'
    renderReset()
    await screen.findByRole('alert')
    await act(async () => { recovery.listener('PASSWORD_RECOVERY', { access_token: 'test-token' }) })
    expect(screen.getByRole('alert')).toHaveTextContent(invalidLink)
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
  })

  it('unlocks the form when Supabase supplies a PASSWORD_RECOVERY event', async () => {
    renderReset()
    await screen.findByRole('alert')
    await act(async () => { recovery.listener('PASSWORD_RECOVERY', { access_token: 'test-token' }) })
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not let a late empty-session lookup undo a valid recovery event', async () => {
    let finish
    supabase.auth.getSession.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderReset()
    await act(async () => { recovery.listener('PASSWORD_RECOVERY', { access_token: 'test-token' }) })
    await act(async () => { finish({ data: { session: null }, error: null }) })
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
  })

  it.each([
    ['', '', 'Password must be at least 8 characters long.'],
    ['Short!1', 'Short!1', 'Password must be at least 8 characters long.'],
    ['LongPassword1', 'LongPassword1', 'Password must include at least 1 special character.'],
    ['ValidPass!1', 'Different!2', 'Passwords do not match.'],
  ])('blocks invalid password input: %s', async (password, confirmation, message) => {
    await readyReset()
    submitPasswords(password, confirmation)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('accepts the eight-character boundary, updates the password and signs out locally', async () => {
    const user = userEvent.setup()
    await readyReset()
    submitPasswords('Abcdef1!')
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated. Please sign in with your new password.')
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1)
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'Abcdef1!' })
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Go to Sign In' }))
    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })

  it('keeps the form available and shows an error when the update fails', async () => {
    supabase.auth.updateUser.mockResolvedValueOnce({ error: { message: 'Password update rejected' } })
    await readyReset()
    submitPasswords('ValidPass!1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Password update rejected')
    expect(screen.getByLabelText('New Password')).toHaveValue('ValidPass!1')
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    submitPasswords('AnotherPass!2')
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables the button while the password update is pending', async () => {
    let finish
    supabase.auth.updateUser.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    await readyReset()
    submitPasswords('ValidPass!1')
    const updating = screen.getByRole('button', { name: 'Updating...' })
    expect(updating).toBeDisabled()
    await user.click(updating)
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ error: null }) })
    expect(screen.getByRole('status')).toHaveTextContent('Your password has been updated.')
  })

  it('unsubscribes from recovery events when the page unmounts', async () => {
    const view = await readyReset()
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
