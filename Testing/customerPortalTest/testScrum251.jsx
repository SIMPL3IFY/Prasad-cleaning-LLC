import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect , beforeEach } from 'vitest'
import CustomerPortal from '../../src/pages/CustomerPortal'
import ProtectedCustomerRoute from '../../src/components/ProtectedCustomerRoute'
import { useAuth } from '../../src/context/AuthContext'
import { useServices } from '../../src/hooks/useServices'

const { supabase } = vi.hoisted(() => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn(),
    },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../src/hooks/useServices', () => ({ useServices: vi.fn() }))

const customer = { id: 'test-customer-1' }

function renderCustomerRoute() {
    return render(
        <MemoryRouter initialEntries={['/portal']}>
            <Routes>
                <Route element={<ProtectedCustomerRoute />}>
                    <Route path="/portal" element={<CustomerPortal />} />
                </Route>
                <Route path="/signin" element={<h1>Sign In Page</h1>} />
                <Route path="/" element={<h1>Home Page</h1>} />
                <Route path="/contact" element={<h1>Contact Page</h1>} />
                <Route path="/services" element={<h1>Services Page</h1>} />
                <Route path="/service-area" element={<h1>Service Area Page</h1>} />
                <Route path="/settings" element={<h1>Settings Page</h1>} />
             </Routes>
        </MemoryRouter>
    )
}

function setSignedInCustomer() {
    useAuth.mockReturnValue({
        session: { user: customer },
        user: customer,
        loading: false,
    })
}

beforeEach(() => {
    vi.clearAllMocks()

    setSignedInCustomer()

    useServices.mockReturnValue({
        services: [],
        loading: false,
        error: null,
    })

    supabase.auth.getUser.mockResolvedValue({
        data: { user: customer },
        error: null,
    })

    supabase.auth.signOut.mockResolvedValue({ error: null })
})

describe('SCRUM-251 Customer Portal', () => {
    it('shows the portal content after the active customer is verified', async () => {
        renderCustomerRoute()

        expect(
            await screen.findByRole('heading', { name: 'Welcome back!' })
        ).toBeInTheDocument()

        expect(screen.getByText('What would you like to do today?')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /schedule appointment/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /get a quote/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /leave a review/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /view our services/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /service area/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /contact us/i })).toBeInTheDocument()
        expect(supabase.auth.getUser).toHaveBeenCalled()
    })

    it('shows the loading message while Supabase is verifying the session', () => {

        supabase.auth.getUser.mockReturnValue(new Promise(() => {}))
        renderCustomerRoute()

        expect(screen.getByText('Loading your account...')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Welcome back!' })).not.toBeInTheDocument()
    })

    it('redirects a signed-out visitor to Sign In', async () => {
        useAuth.mockReturnValue({
            session: null,
            user: null,
            loading: false,
        })

        renderCustomerRoute()

        expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Welcome back!' })).not.toBeInTheDocument()
        expect(supabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('redirects when Supabase reports a session error', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Session expired' },
        })

        renderCustomerRoute()

        expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Welcome back!' })).not.toBeInTheDocument()
        expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })

    it('redirects when the active Supabase user does not match the app user', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'different-user' } },
            error: null,
        })

        renderCustomerRoute()

        expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Welcome back!' })).not.toBeInTheDocument()
        expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })

    it('redirects if the Supabase session check rejects', async () => {
        supabase.auth.getUser.mockRejectedValue(new Error('Network unavailable'))

        renderCustomerRoute()

        expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Welcome back!' })).not.toBeInTheDocument()
    })

    it('navigates to Contact when Schedule Appointment is selected', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(
            await screen.findByRole('button', { name: /schedule appointment/i })
        )

        expect(await screen.findByRole('heading', { name: 'Contact Page' })).toBeInTheDocument()
    })

    it('navigates to Contact when Get a Quote is selected', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('link', { name: /get a quote/i }))

        expect(await screen.findByRole('heading', { name: 'Contact Page' })).toBeInTheDocument()
    })

    it('navigates to the Services page', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(
            await screen.findByRole('button', { name: /view our services/i })
        )

        expect(await screen.findByRole('heading', { name: 'Services Page' })).toBeInTheDocument()
    })

    it('navigates to the Service Area page', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('link', { name: /service area/i }))

        expect(await screen.findByRole('heading', { name: 'Service Area Page' })).toBeInTheDocument()
    })

    it('opens and closes the Contact Information dialog', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('button', { name: /contact us/i }))

        expect(screen.getByRole('dialog', { name: 'Contact Information' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '(916) 665-8474' })).toHaveAttribute('href', 'tel:+19166658474')

        await user.click(screen.getByRole('button', { name: 'Close' }))

        expect(screen.queryByRole('dialog', { name: 'Contact Information' })).not.toBeInTheDocument()
    })

    it('opens the review form', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('button', { name: /leave a review/i }))

        expect(screen.getByRole('heading', { name: 'Write a Review' })).toBeInTheDocument()
    })

    it('navigates to Settings', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('button', { name: 'Settings' }))

        expect(await screen.findByRole('heading', { name: 'Settings Page' })).toBeInTheDocument()
    })

    it('signs out and returns to Home', async () => {
        const user = userEvent.setup()
        renderCustomerRoute()

        await user.click(await screen.findByRole('button', { name: 'Sign Out' }))

        expect(supabase.auth.signOut).toHaveBeenCalled()
        expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument()
    })
})