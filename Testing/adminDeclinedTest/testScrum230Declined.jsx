// SCRUM-230: Unit tests for the Declined Quotes box in AdminDashboard.jsx
// Covers acceptance criterion 6, plus the Scrum 183 "Move to Manage Quotes" flow.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// SCRUM-230: Replace the real Supabase client with the fake
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase, makeDeclinedQuote } from '../adminTestUtils/supabaseMock'
import { renderDashboardAsAdmin, getPanel } from '../adminTestUtils/renderDashboard'

const lee = makeDeclinedQuote({ id: 'd-1', customerName: 'Lee Park', phone: '916-555-0303', declineReason: 'Outside service area' })
const ana = makeDeclinedQuote({ id: 'd-2', customerName: 'Ana Ruiz', phone: '916-555-0404', declineReason: 'Fully booked that week' })

describe('SCRUM-230: Declined Quotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        // jsdom has no real alert(); handleConfirmReopen() calls it when a save fails
        vi.stubGlobal('alert', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('showing declined quotes', () => {
        // SCRUM-230 
        it('shows each declined quote with its decline reason', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { declined_quotes: { rows: [lee, ana] } })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            expect(await declined.findByText('Lee Park')).toBeInTheDocument()
            expect(declined.getByText('916-555-0303')).toBeInTheDocument()
            expect(declined.getByText('Decline Reason')).toBeInTheDocument()
            expect(declined.getByText('Outside service area')).toBeInTheDocument()

            // One declined quote per page, so page forward for the second one
            await user.click(declined.getByRole('button', { name: '›' }))
            expect(declined.getByText('Ana Ruiz')).toBeInTheDocument()
            expect(declined.getByText('Fully booked that week')).toBeInTheDocument()
        })

        // SCRUM-230: Same empty-state guard as Manage Quotes (AC 4)
        it('shows an empty state when there are no declined quotes', async () => {
            setupSupabase(supabase, { declined_quotes: { rows: [] } })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            expect(supabase.from).toHaveBeenCalledWith('declined_quotes')
            expect(await declined.findByText('No declined quotes.')).toBeInTheDocument()
        })

        // SCRUM-230: Same error guard as Manage Quotes (AC 5). Fails until 5b is applied.
        it('shows an error message when the query fails', async () => {
            setupSupabase(supabase, { declined_quotes: { selectError: { message: 'permission denied' } } })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            expect(await declined.findByRole('alert')).toHaveTextContent(/unable to load declined quotes/i)
            expect(declined.queryByText('No declined quotes.')).not.toBeInTheDocument()
        })
    })

    describe('moving a declined quote back to Manage Quotes', () => {
        // SCRUM-230 (Scrum 183 modal): Cancel must not save anything
        it('asks for confirmation and changes nothing on Cancel', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { declined_quotes: { rows: [lee] } })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            await user.click(await declined.findByRole('button', { name: 'Move to Manage Quotes' }))
            expect(screen.getByRole('heading', { name: 'Move Quote to Pending?' })).toBeInTheDocument()
            await user.click(screen.getByRole('button', { name: 'Cancel' }))

            expect(screen.queryByRole('heading', { name: 'Move Quote to Pending?' })).not.toBeInTheDocument()
            expect(db.insertsInto('quotes')).toHaveLength(0)
            expect(declined.getByText('Lee Park')).toBeInTheDocument()
        })

        // SCRUM-230 (Scrum 183): Confirm moves the row from declined_quotes back to quotes
        it('saves the quote as pending, deletes it from declined_quotes, and removes the card', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { declined_quotes: { rows: [lee] } })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            await user.click(await declined.findByRole('button', { name: 'Move to Manage Quotes' }))
            await user.click(screen.getByRole('button', { name: 'Yes, Move to Manage Quotes' }))

            await waitFor(() => expect(db.insertsInto('quotes')).toHaveLength(1))
            expect(db.insertsInto('quotes')[0]).toEqual(expect.objectContaining({
                customer_name: 'Lee Park',
                phone: '916-555-0303',
                status: 'pending',
            }))
            expect(db.deletesFrom('declined_quotes')).toContainEqual({ id: 'd-1' })
            expect(await declined.findByText('No declined quotes.')).toBeInTheDocument()

            // Manage Quotes is reloaded, and the popup closes
            await waitFor(() => {
                const quoteSelects = db.calls.filter(c => c.table === 'quotes' && c.op === 'select')
                expect(quoteSelects.length).toBeGreaterThanOrEqual(2) // initial load + reload
            })
            await waitFor(() =>
                expect(screen.queryByRole('heading', { name: 'Move Quote to Pending?' })).not.toBeInTheDocument()
            )
        })

        // SCRUM-230: A failed insert must not delete the declined row
        it('keeps the declined quote and alerts the admin when the insert fails', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, {
                declined_quotes: { rows: [lee] },
                quotes: { insertError: { message: 'insert failed' } },
            })
            await renderDashboardAsAdmin()
            const declined = getPanel('Declined Quotes')

            await user.click(await declined.findByRole('button', { name: 'Move to Manage Quotes' }))
            await user.click(screen.getByRole('button', { name: 'Yes, Move to Manage Quotes' }))

            await waitFor(() =>
                expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to restore quote: insert failed'))
            )
            expect(db.deletesFrom('declined_quotes')).toHaveLength(0)
            expect(declined.getByText('Lee Park')).toBeInTheDocument()
        })
    })
})