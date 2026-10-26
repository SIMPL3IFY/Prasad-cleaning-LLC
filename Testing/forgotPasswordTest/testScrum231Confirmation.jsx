import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ResetConfirmation from '../../src/pages/ResetConfirmation'

function renderConfirmation(hash = '') {
  window.history.replaceState({}, '', `/reset-password/continue${hash}`)
  return render(
    <MemoryRouter initialEntries={['/reset-password/continue']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/reset-password/continue" element={<ResetConfirmation />} />
        <Route path="/signin" element={<p>Sign In Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SCRUM-231 email-link confirmation page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    window.history.replaceState({}, '', '/')
  })

  it('requires Continue for a syntactically valid token and removes it from the address bar', () => {
    renderConfirmation('#token_hash=not-a-real-token_123')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/reset-password/continue')
    // Actual verification through Continue is tested with a real email, not a fake token.
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
  })

  it('fails safely if the configured Supabase URL is invalid', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url')
    renderConfirmation('#token_hash=not-a-real-token')
    expect(screen.getByRole('alert')).toHaveTextContent('This password-reset link is invalid.')
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
  })

  it('lets a user return to sign in after an invalid confirmation link', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(screen.getByRole('link', { name: 'Return to Sign In' }))
    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
  })
})
