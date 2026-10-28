import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignIn from '../../src/pages/SignIn'

const { supabase } = vi.hoisted(() => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn() } },
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const successMessage = 'If an account exists for that email, a reset link has been sent. Please check your inbox.'

async function openForgotPassword() {
  const user = userEvent.setup()
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SignIn />
    </MemoryRouter>
  )
  await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
  return user
}

function submitResetForm(email) {
  const input = screen.getByLabelText('Email Address')
  fireEvent.change(input, { target: { value: email } })
  // Exercise application validation as well as the separate Selenium browser checks.
  fireEvent.submit(input.closest('form'))
}

describe('SCRUM-231 request a password-reset email', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('opens the reset form and prefills the email from sign in', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SignIn /></MemoryRouter>)
    await user.type(screen.getByLabelText('Email Address'), 'customer@example.com')
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toHaveValue('customer@example.com')
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it.each(['', 'not-an-email', 'customer@example'])(
    'blocks the invalid email %j without contacting Supabase', async email => {
      await openForgotPassword()
      submitResetForm(email)
      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.')
      expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
    }
  )

  it('normalizes the email, requests the recovery route, and clears the field on success', async () => {
    await openForgotPassword()
    submitResetForm('  Customer@Example.COM  ')
    expect(await screen.findByRole('status')).toHaveTextContent(successMessage)
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('customer@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    expect(screen.getByLabelText('Email Address')).toHaveValue('')
  })

  it('uses the same generic confirmation for an email with no known account', async () => {
    await openForgotPassword()
    submitResetForm('unregistered@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent(successMessage)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the service error and retains the email so the user can retry', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })
    await openForgotPassword()
    submitResetForm('customer@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded')
    expect(screen.getByLabelText('Email Address')).toHaveValue('customer@example.com')
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('disables the send button during the request and prevents repeated button clicks', async () => {
    let finish
    supabase.auth.resetPasswordForEmail.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const user = await openForgotPassword()
    submitResetForm('customer@example.com')
    const sending = screen.getByRole('button', { name: 'Sending...' })
    expect(sending).toBeDisabled()
    await user.click(sending)
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ error: null }) })
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent(successMessage)
  })

  it('clears an old error when retrying successfully', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Unable to send email' } })
    await openForgotPassword()
    submitResetForm('customer@example.com')
    await screen.findByRole('alert')
    submitResetForm('customer@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent(successMessage)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('removes a previous success message if a subsequent request fails', async () => {
    await openForgotPassword()
    submitResetForm('customer@example.com')
    await screen.findByRole('status')
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Try again later' } })
    submitResetForm('customer@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again later')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('returns to sign in and clears reset-form feedback when reopened', async () => {
    const user = await openForgotPassword()
    submitResetForm('invalid')
    await user.click(screen.getByRole('link', { name: 'Back to Sign In' }))
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Email Address')).toHaveValue('')
  })
})
