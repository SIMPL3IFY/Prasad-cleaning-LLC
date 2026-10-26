import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SignUp from '../../src/pages/SignUp'

const { supabase } = vi.hoisted(() => ({
    supabase: {
        auth: {
            signUp: vi.fn(),
            resend: vi.fn(),
        },
    },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

function renderSignUp() {
    return render(
        <MemoryRouter>
            <SignUp />
        </MemoryRouter>
    )
}

async function fillValidForm(user, overrides = {}) {
    const values = {
        name: 'Test Customer',
        email: 'customer@example.com',
        password: 'ValidPass1!',
        confirmPassword: 'ValidPass1!',
        ...overrides,
    }

    await user.type(screen.getByLabelText(/name/i), values.name)
    await user.type(screen.getByLabelText(/email/i), values.email)
    await user.type(screen.getByLabelText(/^password$/i), values.password)
    await user.type(screen.getByLabelText(/^confirm password$/i), values.confirmPassword)
}

describe('Customer Sign Up', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the registration form', () => {
        renderSignUp()

        expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })

    it('sends the expected registration details to Supabase', async () => {
        const user = userEvent.setup()
        supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
        renderSignUp()
        
        await fillValidForm(user)
        await user.click(screen.getByRole('button', { name: /^sign up$/i }))

        expect(supabase.auth.signUp).toHaveBeenCalledWith({
            email: 'customer@example.com',
            password: 'ValidPass1!',
            options: {
                data: { full_name: 'Test Customer' },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })
    })

    it('shows instructions to check email after a successful sign up', async() => {
        const user = userEvent.setup()
        supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
        renderSignUp()

        await fillValidForm(user)
        await user.click(screen.getByRole('button', { name: /^sign up$/i }))

        expect(await screen.findByRole('heading', { name: /confirm your email/i })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Account created. We sent a confirmation link to customer@example.com. Confirm your email, then sign in.')
    })

    it('shows required-field errors and does not call Supabase when submitted empty', () => {
        const { container } = renderSignUp()

        fireEvent.submit(container.querySelector('form'))

        expect(screen.getByText(/Name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
        expect(screen.getByText('Password is required', { exact: true })).toBeInTheDocument()
        expect(screen.getByText('Confirm Password is required', { exact: true })).toBeInTheDocument()
        expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('shows an error for an invalid email and does not call Supabase', () => {
        const { container } = renderSignUp()

        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Customer' } })
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } })
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } })
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } })
        fireEvent.submit(container.querySelector('form'))

        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
        expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('shows the minimum-length password error and does not call Supabase', () => {
        const { container } = renderSignUp()

        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Customer' } })
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'customer@example.com' } })
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short!' } })
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short!' } })
        fireEvent.submit(container.querySelector('form'))

        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
        expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })
    
    it('shows the special-character password error and does not call Supabase', () => {
        const { container } = renderSignUp()

        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Customer' } })
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'customer@example.com' } })
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass123' } })
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass123' } })
        fireEvent.submit(container.querySelector('form'))

        expect(screen.getByText('Password must include at least 1 special character')).toBeInTheDocument()
        expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('shows an error when the password confirmation does not match', () => {
        const { container } = renderSignUp()

        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Customer' } })
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'customer@example.com' } })
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } })
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentPass1!' } })
        fireEvent.submit(container.querySelector('form'))

        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
        expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('shows the Supabase error when registration fails', async () => {
        const user = userEvent.setup()
        supabase.auth.signUp.mockResolvedValue({
            data: { session: null },
            error: { message: 'Unable to create account right now.' },
        })
        renderSignUp()

        await fillValidForm(user)
        await user.click(screen.getByRole('button', { name: /^sign up$/i }))

        expect(await screen.findByText('Unable to create account right now.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
    })

    it('prevents another submission while the sign-up request is pending', async () => {
        const user = userEvent.setup()
        supabase.auth.signUp.mockReturnValue(new Promise(() => {}))
        renderSignUp()

        await fillValidForm(user)
        const submitButton = screen.getByRole('button', { name: /^sign up$/i })
        await user.click(submitButton)

        expect(screen.getByText('Creating account...')).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
        await user.click(submitButton)
        expect(supabase.auth.signUp).toHaveBeenCalledTimes(1)
    })
})