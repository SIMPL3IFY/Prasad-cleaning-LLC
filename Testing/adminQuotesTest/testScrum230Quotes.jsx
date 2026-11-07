// Scrum-230: Unit tests for the Manage Quotes box in AdminDashboard.jsx
// Covers acceptance criteria 3, 4, 5, 7, 8 and 9.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Scrum-230: Replace the real Supabase client with the fake before the dashboard imports it
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase, makeQuote } from '../adminTestUtils/supabaseMock'
import { renderDashboardAsAdmin, getPanel } from '../adminTestUtils/renderDashboard'

const maria = makeQuote({ id: 'q-1', customerName: 'Maria Lopez', phone: '916-555-0101' })
const james = makeQuote({ id: 'q-2', customerName: 'James Chen', phone: '916-555-0202' })

describe('Scrum-230: Manage Quotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear() // make sure the demo-admin shortcut is off
    })

    describe('showing quotes', () => {
        // Scrum-230 
        it("shows each quote's customer name and phone number", async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { quotes: { rows: [maria, james] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            expect(await quotes.findByText('Maria Lopez')).toBeInTheDocument()
            expect(quotes.getByText('916-555-0101')).toBeInTheDocument()

            // One quote per page (QUOTES_PER_PAGE = 1), so page forward to see the next one
            await user.click(quotes.getByRole('button', { name: '›' }))
            expect(quotes.getByText('James Chen')).toBeInTheDocument()
            expect(quotes.getByText('916-555-0202')).toBeInTheDocument()
            expect(quotes.getByText('Page 2/2')).toBeInTheDocument()
        })

        // Scrum-230: guards against the silent empty-array RLS behavior
        it('shows an empty state when the query returns no rows', async () => {
            setupSupabase(supabase, { quotes: { rows: [] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            expect(supabase.from).toHaveBeenCalledWith('quotes')
            expect(await quotes.findByText('No quotes available.')).toBeInTheDocument()
            expect(quotes.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
        })

        // Scrum-230: fails until Step 4 adds the error message
        it('shows an error message when the query fails', async () => {
            setupSupabase(supabase, { quotes: { selectError: { message: 'permission denied' } } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            expect(await quotes.findByRole('alert')).toHaveTextContent(/unable to load quotes/i)
            expect(quotes.queryByText('No quotes available.')).not.toBeInTheDocument()
        })
    })

    describe('declining a quote', () => {
        // Scrum-230 
        it('blocks Decline without a reason and shows a validation message', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Decline' }))
            await user.click(quotes.getByRole('button', { name: 'Confirm Decline' }))

            expect(quotes.getByText('A reason is required before you can decline this quote.')).toBeInTheDocument()
            expect(db.insertsInto('declined_quotes')).toHaveLength(0)
        })

        // Scrum-230: confirmDecline() trims, so a reason of only spaces is still empty
        it('treats a reason of only spaces as missing', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Decline' }))
            await user.type(quotes.getByRole('textbox'), '   ')
            await user.click(quotes.getByRole('button', { name: 'Confirm Decline' }))

            expect(quotes.getByText('A reason is required before you can decline this quote.')).toBeInTheDocument()
            expect(db.insertsInto('declined_quotes')).toHaveLength(0)
        })

        // Scrum-230 
        it("saves the quote's data and reason to declined_quotes and removes it from the pending list", async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Decline' }))
            await user.type(quotes.getByRole('textbox'), 'Outside service area')
            await user.click(quotes.getByRole('button', { name: 'Confirm Decline' }))

            await waitFor(() => expect(db.insertsInto('declined_quotes')).toHaveLength(1))
            expect(db.insertsInto('declined_quotes')[0]).toEqual(expect.objectContaining({
                original_quote_id: 'q-1',
                customer_name: 'Maria Lopez',
                phone: '916-555-0101',
                decline_reason: 'Outside service area',
            }))
            expect(db.deletesFrom('quotes')).toContainEqual({ id: 'q-1' })
            await waitFor(() => expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument())
            expect(quotes.getByText('No quotes available.')).toBeInTheDocument()
        })

        // Scrum-230: If the archive insert fails, the quote must not be deleted or disappear
        it('keeps the quote when the insert into declined_quotes fails', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, {
                quotes: { rows: [maria] },
                declined_quotes: { insertError: { message: 'insert failed' } },
            })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Decline' }))
            await user.type(quotes.getByRole('textbox'), 'Outside service area')
            await user.click(quotes.getByRole('button', { name: 'Confirm Decline' }))

            await waitFor(() => expect(db.insertsInto('declined_quotes')).toHaveLength(1))
            expect(db.deletesFrom('quotes')).toHaveLength(0)
            expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()
        })
    })

    describe('accepting a quote', () => {
        // Scrum-230 (Scrum 150 modal): Cancel must not save anything
        it('asks for confirmation and changes nothing on Cancel', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Accept' }))
            expect(screen.getByRole('heading', { name: 'Accept Quote?' })).toBeInTheDocument()
            await user.click(screen.getByRole('button', { name: 'Cancel' }))

            expect(screen.queryByRole('heading', { name: 'Accept Quote?' })).not.toBeInTheDocument()
            expect(db.insertsInto('accepted_quotes')).toHaveLength(0)
            expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()
        })

        // Scrum-230 AC 9
        it("saves the quote's data to accepted_quotes and removes it from the pending list", async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const quotes = getPanel('Manage Quotes')

            await user.click(await quotes.findByRole('button', { name: 'Accept' }))
            await user.click(screen.getByRole('button', { name: 'Yes, Accept' }))

            await waitFor(() => expect(db.insertsInto('accepted_quotes')).toHaveLength(1))
            expect(db.insertsInto('accepted_quotes')[0]).toEqual(expect.objectContaining({
                original_quote_id: 'q-1',
                customer_name: 'Maria Lopez',
                phone: '916-555-0101',
                status: 'accepted',
            }))
            expect(db.deletesFrom('quotes')).toContainEqual({ id: 'q-1' })
            await waitFor(() => expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument())
            expect(screen.queryByRole('heading', { name: 'Accept Quote?' })).not.toBeInTheDocument()
        })
    })
})