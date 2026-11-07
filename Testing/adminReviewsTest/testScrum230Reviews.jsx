// SCRUM-230: Unit tests for the Customer Reviews box and popup in AdminDashboard.jsx
// Covers Scrum 135: listing reviews and approving or rejecting them.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// SCRUM-230: Replace the real Supabase client with the fake
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase } from '../adminTestUtils/supabaseMock'
import { renderDashboardAsAdmin, getPanel } from '../adminTestUtils/renderDashboard'

// SCRUM-230: Review rows use the raw column names (fetchReviews doesn't alias them)
const makeReview = (overrides = {}) => ({
    id: 'r-1',
    customer_name: 'Priya S',
    review: 'Great job on the kitchen!',
    rating: 5,
    approved: false,
    created_at: '2026-10-02T12:00:00Z',
    ...overrides,
})
const priya = makeReview() // pending
const tom = makeReview({ id: 'r-2', customer_name: 'Tom B', review: 'Very thorough.', rating: 4, approved: true, created_at: '2026-10-01T12:00:00Z' })

// SCRUM-230: Opens the popup and returns queries scoped to it and to each group
async function openReviews(user) {
    await user.click(screen.getByRole('button', { name: 'View Review Table' }))
    const modal = within(screen.getByRole('heading', { level: 3, name: 'Customer Reviews' }).closest('.admin-modal-box'))
    const group = (title) => within(modal.getByRole('heading', { level: 4, name: title }).parentElement)
    return { modal, pending: () => group('Pending Reviews'), approved: () => group('Approved Reviews') }
}

describe('SCRUM-230: Customer Reviews (Scrum 135)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    describe('listing reviews', () => {
        it('splits reviews into Pending and Approved groups', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { customer_reviews: { rows: [priya, tom] } })
            await renderDashboardAsAdmin()

            const { pending, approved } = await openReviews(user)

            expect(pending().getByText('Priya S')).toBeInTheDocument()
            expect(pending().getByText('Great job on the kitchen!')).toBeInTheDocument()
            expect(pending().getByText('⭐⭐⭐⭐⭐')).toBeInTheDocument() // rating 5
            expect(pending().getByRole('button', { name: 'Approve' })).toBeInTheDocument()

            expect(approved().getByText('Tom B')).toBeInTheDocument()
            expect(approved().getByText('⭐⭐⭐⭐')).toBeInTheDocument() // rating 4
            expect(approved().getByRole('button', { name: 'Reject' })).toBeInTheDocument()
        })

        it('lists the newest review first', async () => {
            const user = userEvent.setup()
            const older = makeReview({ id: 'r-3', customer_name: 'Ana R', created_at: '2026-09-01T12:00:00Z' })
            setupSupabase(supabase, { customer_reviews: { rows: [older, priya] } }) // out of order on purpose
            await renderDashboardAsAdmin()

            const { pending } = await openReviews(user)
            const names = pending().getAllByText(/^(Priya S|Ana R)$/).map(el => el.textContent)

            expect(names).toEqual(['Priya S', 'Ana R'])
        })

        it('closes the popup with the × button', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { customer_reviews: { rows: [priya] } })
            await renderDashboardAsAdmin()

            const { modal } = await openReviews(user)
            await user.click(modal.getByRole('button', { name: '×' }))

            expect(screen.queryByRole('heading', { level: 3, name: 'Customer Reviews' })).not.toBeInTheDocument()
        })

        it('shows an empty state when there are no reviews', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { customer_reviews: { rows: [] } })
            await renderDashboardAsAdmin()

            const { modal } = await openReviews(user)

            expect(modal.getByText('No reviews available.')).toBeInTheDocument()
        })

        it('shows a message when the reviews query fails', async () => {
            setupSupabase(supabase, { customer_reviews: { selectError: { message: 'permission denied' } } })
            await renderDashboardAsAdmin()

            expect(await getPanel('Customer Reviews').findByText('Unable to load customer reviews.')).toBeInTheDocument()
        })
    })

    describe('approving and rejecting', () => {
        it('approves a pending review and moves it to Approved', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { customer_reviews: { rows: [priya] } })
            await renderDashboardAsAdmin()
            const { pending, approved } = await openReviews(user)

            await user.click(pending().getByRole('button', { name: 'Approve' }))

            expect(await getPanel('Customer Reviews').findByText('Review approved and now visible publicly.')).toBeInTheDocument()
            expect(db.updatesTo('customer_reviews')).toEqual([{ payload: { approved: true }, filters: { id: 'r-1' } }])
            expect(approved().getByText('Priya S')).toBeInTheDocument()
            expect(pending().getByText('No pending reviews.')).toBeInTheDocument()
        })

        it('rejects an approved review and moves it to Pending', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { customer_reviews: { rows: [tom] } })
            await renderDashboardAsAdmin()
            const { pending, approved } = await openReviews(user)

            await user.click(approved().getByRole('button', { name: 'Reject' }))

            expect(await getPanel('Customer Reviews').findByText('Review rejected and hidden from the public page.')).toBeInTheDocument()
            expect(db.updatesTo('customer_reviews')).toEqual([{ payload: { approved: false }, filters: { id: 'r-2' } }])
            expect(pending().getByText('Tom B')).toBeInTheDocument()
            expect(approved().getByText('No approved reviews.')).toBeInTheDocument()
        })

        it('shows the error and leaves the review where it was when the update fails', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { customer_reviews: { rows: [priya], updateError: { message: 'permission denied' } } })
            await renderDashboardAsAdmin()
            const { pending, approved } = await openReviews(user)

            await user.click(pending().getByRole('button', { name: 'Approve' }))

            expect(await getPanel('Customer Reviews').findByText('permission denied')).toBeInTheDocument()
            expect(pending().getByText('Priya S')).toBeInTheDocument()
            expect(approved().getByText('No approved reviews.')).toBeInTheDocument()
        })
    })
})