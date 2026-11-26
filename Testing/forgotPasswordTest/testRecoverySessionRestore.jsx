import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'
import Header from '../../src/components/Header'
import ProtectedCustomerRoute from '../../src/components/ProtectedCustomerRoute'
import ProtectedAdminRoute from '../../src/components/ProtectedAdminRoute'
import {
  clearPasswordRecovery, isRecoverySession, trackPasswordRecovery, usePasswordRecovery,
} from '../../src/lib/passwordRecovery'

const { supabase, callbacks } = vi.hoisted(() => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), getUser: vi.fn() },
    from: vi.fn(),
  },
  callbacks: new Set(),
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

function session(method = 'recovery', id = 'restored-session') {
  const claims = { session_id: id, amr: [{ method, timestamp: 1 }] }
  return { access_token: `header.${btoa(JSON.stringify(claims))}.signature`, user: { id: 'user-1' } }
}

function SessionStatus() {
  const { loading, session: active } = useAuth()
  const recovering = usePasswordRecovery()
  if (loading) return <p>Checking session</p>
  return <p>{recovering ? 'Recovery restricted' : active ? 'Normal sign-in' : 'Signed out'}</p>
}

function renderApp(path = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
        <SessionStatus />
        <Routes>
          <Route path="/" element={<p>Public page</p>} />
          <Route path="/reset-password" element={<p>Reset form destination</p>} />
          <Route element={<ProtectedCustomerRoute />}>
            <Route path="/portal" element={<p>Private customer page</p>} />
            <Route path="/settings" element={<p>Private settings page</p>} />
          </Route>
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/admin" element={<p>Private admin page</p>} />
          </Route>
          <Route path="*" element={<p>Unknown page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  callbacks.clear()
  clearPasswordRecovery()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
  supabase.auth.onAuthStateChange.mockImplementation(callback => {
    callbacks.add(callback)
    return { data: { subscription: { unsubscribe: () => callbacks.delete(callback) } } }
  })
})

afterEach(() => {
  act(() => clearPasswordRecovery())
})

describe('Restored password recovery sessions', () => {
  it.each(['/portal', '/settings', '/admin'])(
    'blocks %s when a recovery session is restored without URL details or a browser marker', async path => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: session() } })
      renderApp(path)
      expect(await screen.findByText('Recovery restricted')).toBeInTheDocument()
      expect(await screen.findByText('Reset form destination')).toBeInTheDocument()
      expect(screen.queryByText(/Private .* page/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
    }
  )

  it.each(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'])(
    'recognizes the recovery method on a generic %s event', async event => {
      renderApp('/unrecognized-path')
      await screen.findByText('Signed out')
      act(() => callbacks.forEach(callback => callback(event, session())))
      expect(screen.getByText('Recovery restricted')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
    }
  )

  it('leaves normal password sessions unrestricted', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: session('password') } })
    renderApp()
    expect(await screen.findByText('Normal sign-in')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('does not let a late old recovery lookup overwrite a newer password sign-in', async () => {
    let finishLookup
    supabase.auth.getSession.mockReturnValue(new Promise(resolve => { finishLookup = resolve }))
    renderApp()
    expect(screen.getByText('Checking session')).toBeInTheDocument()
    act(() => callbacks.forEach(callback => callback('SIGNED_IN', session('password', 'new-session'))))
    await act(async () => finishLookup({ data: { session: session() } }))
    expect(screen.getByText('Normal sign-in')).toBeInTheDocument()
    expect(screen.queryByText('Recovery restricted')).not.toBeInTheDocument()
  })

  it('recognizes recovery claims after the separate browser marker is removed', () => {
    const restored = session()
    clearPasswordRecovery()
    expect(isRecoverySession(restored)).toBe(true)
    expect(isRecoverySession(session('password'))).toBe(false)
  })

  it('does not mistake a malformed authentication-method claim for recovery', () => {
    const malformed = { access_token: `header.${btoa(JSON.stringify({ amr: 'recovery' }))}.signature` }
    expect(() => trackPasswordRecovery(malformed)).not.toThrow()
    expect(isRecoverySession(malformed)).toBe(false)
  })
})
