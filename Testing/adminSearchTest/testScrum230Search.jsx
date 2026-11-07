// SCRUM-230: Unit tests for the dashboard search bar in AdminDashboard.jsx
// Covers Scrum 218 (search by category across every box) and Scrum 219 (time search by hour).
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// SCRUM-230: Replace the real Supabase client with the fake
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase, makeQuote, makeAppointment, makeDeclinedQuote } from '../adminTestUtils/supabaseMock'
import { renderDashboardAsAdmin, getPanel } from '../adminTestUtils/renderDashboard'

// SCRUM-230: Two quotes that differ in every searchable field
const maria = makeQuote({
    id: 'q-1', customerName: 'Maria Lopez', address: '123 Oak St, Sacramento, CA',
    service: 'Standard Clean', property: 'House', appointmentDate: '2099-01-15', appointmentTime: '14:30:00',
})
const james = makeQuote({
    id: 'q-2', customerName: 'James Chen', address: '456 Pine Ave, Elk Grove, CA',
    service: 'Deep Clean', property: 'Apartment', appointmentDate: '2099-02-20', appointmentTime: '09:00:00',
})

// SCRUM-230: Small helpers for the search bar
const openSearch = (user) => user.click(screen.getByRole('button', { name: 'Search Quotes By' }))
async function chooseCategory(user, label) {
    await user.click(screen.getByRole('button', { name: /search by:/i })) // opens the dropdown
    await user.click(screen.getByRole('button', { name: label }))
}
const searchBox = () => screen.getByPlaceholderText(/^search by/i) // text input (name, city, service, property)
const expectNoPaging = (panel) => expect(panel.queryByText(/^Page \d+\/\d+$/)).not.toBeInTheDocument()

describe('SCRUM-230: Dashboard search (Scrum 218/219)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('is hidden until Search Quotes By is clicked, and Hide Search restores the full list', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        expect(await quotes.findByText('Maria Lopez')).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/^search by/i)).not.toBeInTheDocument()

        await openSearch(user)
        await user.type(searchBox(), 'james')
        expect(quotes.getByText('James Chen')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Hide Search' }))
        expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()
        expect(quotes.getByText('Page 1/2')).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/^search by/i)).not.toBeInTheDocument()

        // Hide Search also cleared the text
        await openSearch(user)
        expect(searchBox()).toHaveValue('')
    })

    it('filters by customer name, ignoring upper/lower case', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await user.type(searchBox(), 'JAMES')

        expect(quotes.getByText('James Chen')).toBeInTheDocument()
        expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument()
        expectNoPaging(quotes) // one result, so no page arrows
    })

    it('applies the search to every dashboard box', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, {
            quotes: { rows: [maria] },
            accepted_quotes: { rows: [makeAppointment({ id: 'a-1', customerName: 'James Chen' })] },
            declined_quotes: { rows: [makeDeclinedQuote({ id: 'd-1', customerName: 'Ana Ruiz' })] },
        })
        await renderDashboardAsAdmin()
        await getPanel('Manage Appointments').findByText('James Chen') // appointments load after the admin check

        await openSearch(user)
        await user.type(searchBox(), 'ana')

        expect(getPanel('Declined Quotes').getByText('Ana Ruiz')).toBeInTheDocument()
        expect(getPanel('Manage Quotes').getByText("No appointments found matching 'ana'.")).toBeInTheDocument()
        expect(getPanel('Manage Appointments').getByText("No appointments found matching 'ana'.")).toBeInTheDocument()
        expect(getPanel('Completed Appointments').getByText("No completed appointments found matching 'ana'.")).toBeInTheDocument()
    })

    // SCRUM-230: The three text categories work the same way, so one test runs for each
    it.each([
        ['City / Address', 'elk grove'],
        ['Service', 'deep'],
        ['Property Type', 'apart'],
    ])('filters by %s', async (label, query) => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await chooseCategory(user, label)
        expect(screen.getByRole('button', { name: new RegExp(`Search By: ${label}`) })).toBeInTheDocument()
        await user.type(searchBox(), query)

        expect(quotes.getByText('James Chen')).toBeInTheDocument()
        expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument()
        expectNoPaging(quotes)
    })

    it('filters by appointment date with the date picker', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await chooseCategory(user, 'Appointment Date')
        fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2099-02-20' } })

        expect(quotes.getByText('James Chen')).toBeInTheDocument()
        expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument()
    })

    // Scrum 219: any time in the same hour matches (09:15 finds a 09:00 appointment)
    it('matches appointment time by hour', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await chooseCategory(user, 'Appointment Time')
        const timePicker = document.querySelector('input[type="time"]')

        fireEvent.change(timePicker, { target: { value: '09:15' } })
        expect(quotes.getByText('James Chen')).toBeInTheDocument()     // 09:00:00
        expect(quotes.queryByText('Maria Lopez')).not.toBeInTheDocument()

        fireEvent.change(timePicker, { target: { value: '14:00' } })
        expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()    // 14:30:00
        expect(quotes.queryByText('James Chen')).not.toBeInTheDocument()
    })

    it('clears the search with the ✕ button', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await user.type(searchBox(), 'james')
        await user.click(screen.getByRole('button', { name: 'Clear text' }))

        expect(searchBox()).toHaveValue('')
        expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()
        expect(quotes.getByText('Page 1/2')).toBeInTheDocument()
    })

    // Scrum 218: changing the search resets every box to page 1
    it('goes back to page 1 when the search category changes', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase, { quotes: { rows: [maria, james] } })
        await renderDashboardAsAdmin()
        const quotes = getPanel('Manage Quotes')
        await quotes.findByText('Maria Lopez')

        await openSearch(user)
        await user.type(searchBox(), 'e') // both names contain "e"
        await user.click(quotes.getByRole('button', { name: '›' }))
        expect(quotes.getByText('Page 2/2')).toBeInTheDocument()

        await chooseCategory(user, 'Service') // both services also contain "e"

        expect(quotes.getByText('Page 1/2')).toBeInTheDocument()
        expect(quotes.getByText('Maria Lopez')).toBeInTheDocument()
    })
})