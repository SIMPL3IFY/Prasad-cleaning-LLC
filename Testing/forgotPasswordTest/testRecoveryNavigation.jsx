import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Header from '../../src/components/Header'
import Footer from '../../src/components/Footer'
import ProtectedCustomerRoute from '../../src/components/ProtectedCustomerRoute'
import ProtectedAdminRoute from '../../src/components/ProtectedAdminRoute'
import SignIn from '../../src/pages/SignIn'
import ResetPassword from '../../src/pages/ResetPassword'
import { clearPasswordRecovery, isRecoverySession, markPasswordRecovery } from '../../src/lib/passwordRecovery'

const { supabase, auth } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(), signOut: vi.fn(), updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
  auth: { user: { id: 'customer-1' }, session: { user: { id: 'customer-1' } }, loading: false },
}))
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase, recoveryLinkAccessToken: null, recoveryLinkError: null,
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth }))

const token = (id, extra = {}) => `header.${btoa(JSON.stringify({ session_id: id, ...extra }))}.signature`

function renderWebsite(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header />
      <Routes>
        <Route path="/" element={<p>Public homepage</p>} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/continue" element={<p>Continue page</p>} />
        <Route path="/continue" element={<p>Continue page</p>} />
        <Route element={<ProtectedCustomerRoute />}>
          <Route path="/portal" element={<p>Private customer content</p>} />
          <Route path="/settings" element={<p>Private settings content</p>} />
        </Route>
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin" element={<p>Private admin content</p>} />
        </Route>
      </Routes>
      <Footer />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  clearPasswordRecovery()
  supabase.auth.getUser.mockResolvedValue({ data: { user: auth.user }, error: null })
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  supabase.auth.signOut.mockResolvedValue({ error: null })
  supabase.auth.updateUser.mockResolvedValue({ error: null })
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
  }
  supabase.from.mockReturnValue(query)
})

afterEach(() => {
  clearPasswordRecovery()
})

describe('Password recovery navigation', () => {
  it.each(['/reset-password', '/reset-password/continue', '/continue', '/signin?mode=forgot'])(
    'hides desktop, mobile and footer account links on %s', async path => {
      const user = userEvent.setup()
      renderWebsite(path)
      await user.click(screen.getByRole('button', { name: 'Open menu' }))
      expect(supabase.from).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
    }
  )

  it('hides links when the email form opens and restores them when returning to sign in', async () => {
    const user = userEvent.setup()
    renderWebsite('/signin')
    await screen.findByRole('link', { name: 'Dashboard' })
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to Sign In' }))
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it.each(['/portal', '/settings', '/admin'])(
    'blocks a direct visit to %s before any private account checks run', async path => {
      const recoveryToken = token('recovery-session')
      markPasswordRecovery(recoveryToken)
      supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: recoveryToken } }, error: null })
      renderWebsite(path)
      expect(await screen.findByRole('heading', { name: 'Create New Password' })).toBeInTheDocument()
      expect(screen.queryByText(/Private .* content/)).not.toBeInTheDocument()
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
    }
  )

  it('keeps recovery restricted after remounting and accepts a refreshed token from the same session', async () => {
    markPasswordRecovery(token('same-session', { exp: 1 }))
    const refreshedSession = { access_token: token('same-session', { exp: 2 }) }
    supabase.auth.getSession.mockResolvedValue({ data: { session: refreshedSession }, error: null })
    const first = renderWebsite('/reset-password')
    await screen.findByLabelText('New Password')
    first.unmount()
    renderWebsite('/portal')
    expect(await screen.findByLabelText('New Password')).toBeInTheDocument()
    expect(screen.queryByText('Private customer content')).not.toBeInTheDocument()
    expect(isRecoverySession(refreshedSession)).toBe(true)
    expect(isRecoverySession({ access_token: token('unrelated-session') })).toBe(false)
  })

  it('responds to recovery starting while private content is open', async () => {
    renderWebsite('/portal')
    await screen.findByText('Private customer content')
    act(() => markPasswordRecovery(token('new-recovery')))
    expect(await screen.findByRole('heading', { name: 'Create New Password' })).toBeInTheDocument()
    expect(screen.queryByText('Private customer content')).not.toBeInTheDocument()
  })

  it('responds to recovery starting in another tab', async () => {
    renderWebsite('/portal')
    await screen.findByText('Private customer content')
    act(() => {
      localStorage.setItem('prasad-password-recovery', 'another-tab-session')
      window.dispatchEvent(new StorageEvent('storage', { key: 'prasad-password-recovery' }))
    })
    expect(await screen.findByRole('heading', { name: 'Create New Password' })).toBeInTheDocument()
    expect(screen.queryByText('Private customer content')).not.toBeInTheDocument()
  })

  it('keeps account navigation blocked if signing out after the update fails', async () => {
    const user = userEvent.setup()
    const recoveryToken = token('reset-session')
    markPasswordRecovery(recoveryToken)
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: recoveryToken } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: { message: 'Network unavailable' } })
    renderWebsite('/reset-password')
    await user.type(await screen.findByLabelText('New Password'), 'NewPassword!1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'NewPassword!1')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))
    await screen.findByText(/Your password has been updated/)
    await user.click(screen.getByRole('link', { name: 'Go to Sign In' }))
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(isRecoverySession({ access_token: recoveryToken })).toBe(true)
  })

  it('keeps a failed password sign-in restricted and releases access after a successful one', async () => {
    const user = userEvent.setup()
    const recoveryToken = token('recovery-session')
    markPasswordRecovery(recoveryToken)
    supabase.auth.signInWithPassword
      .mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials' } })
      .mockResolvedValueOnce({ data: { user: auth.user }, error: null })
    renderWebsite('/signin')
    await user.type(screen.getByLabelText('Email Address'), 'customer@example.com')
    await user.type(screen.getByLabelText('Password'), 'CorrectPassword!1')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    await screen.findByText('Invalid login credentials')
    expect(isRecoverySession({ access_token: recoveryToken })).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Private customer content')).toBeInTheDocument()
    expect(isRecoverySession({ access_token: recoveryToken })).toBe(false)
  })

  it('preserves ordinary signed-in navigation and dashboard access', async () => {
    renderWebsite('/portal')
    expect(await screen.findByText('Private customer content')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
})
