import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerPortal from '../../src/pages/CustomerPortal'

const { supabase } = vi.hoisted(() => ({
    supabase: {
        auth: { getUser: vi.fn(), signOut: vi.fn() },
        from: vi.fn(),
    },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

vi.mock('../../src/hooks/useServices', () => ({
    useServices: () => ({ services: [], loading: false, error: null }),
}))

function renderPortal() {
    return render(
        <MemoryRouter initialEntries={['/portal']}>
            <Routes>
                <Route path="/portal" element={<CustomerPortal />} />
            </Routes>
        </MemoryRouter>
    )
}

function mockReviewInsert(result = { error: null }) {
    const insert = vi.fn().mockResolvedValue(result)

    supabase.from.mockImplementation((table) => {
        if (table === 'customer_reviews') return { insert }
        throw new Error(`Unexpected Supabase table in SCRUM-246 test: ${table}`)
    })

    return insert
}

describe('SCRUM-246 customer review submission', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'customer-test-246' } },
            error: null,
        })
    })

    it('submits a valid review through the mocked Supabase client', async () => {
        const user = userEvent.setup()
        const insert = mockReviewInsert()

        renderPortal()

        await user.click(screen.getByRole('button', { name: /leave a review/i }))
        await user.type(screen.getByPlaceholderText('Name') , 'Test Customer')
        await user.type(screen.getByPlaceholderText('Message'), 'The service was excellent.')
        await user.click(screen.getByTestId('review-rating-5'))
        await user.click(screen.getByRole('button', { name: 'Send' }))

        expect(
            await screen.findByText('Review submitted and awaiting approval.')
        ).toBeInTheDocument()

        expect(supabase.auth.getUser).toHaveBeenCalledOnce()
        expect(supabase.from).toHaveBeenCalledWith('customer_reviews')
        expect(insert).toHaveBeenCalledWith({
            user_id: 'customer-test-246',
            customer_name: 'Test Customer',
            review: 'The service was excellent.',
            rating: 5,
            approved: false,
        })
    })

    it('shows required-field validation and does not call Supabase for an empty review', async () => {
        const user = userEvent.setup()
        mockReviewInsert()
        renderPortal()

        await user.click(screen.getByRole('button', { name: /leave a review/i }))
        await user.click(screen.getByRole('button', { name: 'Send' }))

        expect(screen.getByText('Please enter your name.')).toBeInTheDocument()
        expect(screen.getByText('Please enter a review')).toBeInTheDocument()
        expect(screen.getByText('Please select a star rating')).toBeInTheDocument()

        expect(supabase.auth.getUser).not.toHaveBeenCalled()
        expect(supabase.from).not.toHaveBeenCalled()
    })
})