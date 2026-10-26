import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AdminDashboard from '../../src/pages/AdminDashboard'

// SCRUM-215: No live appointments, admin sessions or emails are used by these tests.
const { supabase } = vi.hoisted(() => ({
    supabase: {
        auth: { getUser: vi.fn() },
        from: vi.fn(),
        rpc: vi.fn()
    }
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))
vi.mock('../../src/components/ServicePhotosManager', () => ({ default: () => null }))

let appointments

function appointment(id, changes = {}) {
    return {
        id, customerName: id === 'active' ? 'Upcoming Customer' : 'Completed Customer',
        email: `${id}@example.com`, phone: '9165550100', service: 'Deep Cleaning',
        property: 'Residential', appointmentDate: '2026-10-24', appointmentTime: '15:30:00',
        address: 'Sacramento', message: 'Original customer message', status: 'accepted',
        completedAt: null, completionNote: '', autoCompletionPaused: false,
        ...changes
    }
}

function panel(name) {
    return screen.getByRole('heading', { name, exact: true }).parentElement
}

async function openDashboard() {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/admin']}><AdminDashboard /></MemoryRouter>)
    await screen.findByText('Upcoming Customer')
    await screen.findByText('Completed Customer')
    return user
}

describe('SCRUM-215 completed appointments', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        localStorage.clear()
        appointments = [
            appointment('active'),
            appointment('completed', { completedAt: '2026-10-24T18:00:00Z', appointmentTime: '10:00:00' })
        ]
        supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null })
        supabase.from.mockImplementation(table => {
            const query = {
                select: vi.fn(() => query),
                eq: vi.fn(() => query),
                maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: true }, error: null }),
                order: vi.fn(async () => ({
                    data: table === 'accepted_quotes' ? appointments.map(({ completedAt, completionNote, autoCompletionPaused, ...row }) => ({
                        ...row,
                        completion: completedAt || completionNote || autoCompletionPaused
                            ? { completedAt, completionNote, autoCompletionPaused }
                            : null
                    })) : [],
                    error: null
                }))
            }
            return query
        })
        // Responses stand in for persisted changes; SQL eligibility is not simulated here.
        supabase.rpc.mockImplementation(async (_name, { p_action, p_appointment_id, p_note }) => {
            const row = appointments.find(item => item.id === p_appointment_id)
            if (p_action === 'note') row.completionNote = p_note
            if (p_action === 'restore') {
                row.completedAt = null
                row.autoCompletionPaused = true
            }
            if (p_action === 'complete') {
                row.completedAt = '2026-10-25T18:00:00Z'
                row.completionNote = p_note
            }
            return { error: null }
        })
    })

    it('separates completed rows from active appointments', async () => {
        await openDashboard()
        expect(within(panel('Manage Appointments')).getByText('Upcoming Customer')).toBeInTheDocument()
        expect(within(panel('Manage Appointments')).queryByText('Completed Customer')).not.toBeInTheDocument()
        expect(within(panel('Completed Appointments')).getByText('Completed Customer')).toBeInTheDocument()
        // Opening/refreshing the page only reads data; Cron is enabled separately.
        expect(supabase.rpc).not.toHaveBeenCalled()
    })

    it('saves a completion note separately from the original customer message', async () => {
        const user = await openDashboard()
        const completed = within(panel('Completed Appointments'))
        await user.type(completed.getByLabelText('Completion note'), 'All rooms cleaned.')
        await user.click(completed.getByRole('button', { name: 'Save Note' }))
        expect(await screen.findByText('Completion note saved.')).toBeInTheDocument()
        expect(supabase.rpc).toHaveBeenCalledWith('scrum215_update_completion', {
            p_action: 'note', p_appointment_id: 'completed', p_note: 'All rooms cleaned.'
        })
        expect(completed.getByText('Original customer message')).toBeInTheDocument()
        expect(completed.getByLabelText('Completion note')).toHaveValue('All rooms cleaned.')
    })

    it('retains an unsaved note across a background refresh', async () => {
        const user = await openDashboard()
        await user.type(within(panel('Completed Appointments')).getByLabelText('Completion note'), 'Draft note')
        const previousCalls = supabase.from.mock.calls.filter(([table]) => table === 'accepted_quotes').length
        fireEvent.focus(window)
        await waitFor(() => expect(supabase.from.mock.calls.filter(([table]) => table === 'accepted_quotes').length).toBeGreaterThan(previousCalls))
        expect(within(panel('Completed Appointments')).getByLabelText('Completion note')).toHaveValue('Draft note')
    })

    it('shows failed saves and keeps the typed note for retry', async () => {
        const user = await openDashboard()
        await user.type(within(panel('Completed Appointments')).getByLabelText('Completion note'), 'Keep this draft')
        supabase.rpc.mockResolvedValueOnce({ error: { message: 'Unable to save note.' } })
        await user.click(within(panel('Completed Appointments')).getByRole('button', { name: 'Save Note' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save note.')
        expect(within(panel('Completed Appointments')).getByLabelText('Completion note')).toHaveValue('Keep this draft')
        expect(screen.queryByText('Completion note saved.')).not.toBeInTheDocument()
    })

    it('returns a completed appointment to the active list with automatic completion paused', async () => {
        const user = await openDashboard()
        await user.click(within(panel('Completed Appointments')).getByRole('button', { name: 'Remove from Completed' }))
        expect(await screen.findByText('Appointment returned to Manage Appointments.')).toBeInTheDocument()
        expect(within(panel('Completed Appointments')).queryByText('Completed Customer')).not.toBeInTheDocument()
        // The restored row is the second active appointment (one card per page).
        await user.click(within(panel('Manage Appointments')).getByRole('button', { name: '›' }))
        expect(within(panel('Manage Appointments')).getByText('Completed Customer')).toBeInTheDocument()
        expect(supabase.rpc).toHaveBeenCalledWith('scrum215_update_completion', {
            p_action: 'restore', p_appointment_id: 'completed', p_note: null
        })
    })

    it('lets the admin manually complete an accepted appointment with a note', async () => {
        const user = await openDashboard()
        const active = within(panel('Manage Appointments'))
        await user.click(active.getByRole('button', { name: 'Mark Completed' }))
        await user.type(active.getByLabelText('Completion note (optional)'), 'Finished early.')
        await user.click(active.getByRole('button', { name: 'Confirm Completion' }))
        expect(await screen.findByText('Appointment moved to Completed Appointments.')).toBeInTheDocument()
        expect(within(panel('Manage Appointments')).queryByText('Upcoming Customer')).not.toBeInTheDocument()
        expect(within(panel('Completed Appointments')).getByText('Upcoming Customer')).toBeInTheDocument()
        expect(within(panel('Completed Appointments')).getByLabelText('Completion note')).toHaveValue('Finished early.')
    })

    it('keeps SCRUM-219 appointment-time filtering working in both boxes', async () => {
        const user = await openDashboard()
        await user.click(screen.getByRole('button', { name: 'Search Quotes By' }))
        await user.click(screen.getByRole('button', { name: /Search By:/ }))
        await user.click(screen.getByRole('button', { name: 'Appointment Time', exact: true }))
        // Native time inputs have no implicit textbox role in jsdom.
        fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '10:00' } })
        expect(within(panel('Completed Appointments')).getByText('Completed Customer')).toBeInTheDocument()
        expect(within(panel('Manage Appointments')).queryByText('Upcoming Customer')).not.toBeInTheDocument()
        fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '15:00' } })
        expect(within(panel('Manage Appointments')).getByText('Upcoming Customer')).toBeInTheDocument()
        expect(within(panel('Completed Appointments')).queryByText('Completed Customer')).not.toBeInTheDocument()
    })

    it('refreshes the visible lists when the server marks an appointment completed', async () => {
        await openDashboard()
        appointments[0].completedAt = '2026-10-25T18:00:00Z'
        fireEvent.focus(window)
        await waitFor(() => expect(within(panel('Completed Appointments')).getByText('Upcoming Customer')).toBeInTheDocument())
        expect(within(panel('Manage Appointments')).queryByText('Upcoming Customer')).not.toBeInTheDocument()
    })

    it('keeps the completed page valid after removing the last card on page two', async () => {
        appointments.push(appointment('earlier', {
            customerName: 'Earlier Customer', completedAt: '2026-10-23T18:00:00Z'
        }))
        const user = await openDashboard()
        await user.click(within(panel('Completed Appointments')).getByRole('button', { name: '›' }))
        expect(within(panel('Completed Appointments')).getByText('Earlier Customer')).toBeInTheDocument()
        await user.click(within(panel('Completed Appointments')).getByRole('button', { name: 'Remove from Completed' }))
        expect(await screen.findByText('Appointment returned to Manage Appointments.')).toBeInTheDocument()
        expect(within(panel('Completed Appointments')).getByText('Completed Customer')).toBeInTheDocument()
        expect(within(panel('Completed Appointments')).queryByText('Earlier Customer')).not.toBeInTheDocument()
        expect(within(panel('Completed Appointments')).queryByText('Page 2/1')).not.toBeInTheDocument()
    })

    it('does not show completion controls before admin access is checked', async () => {
        supabase.auth.getUser.mockReturnValue(new Promise(() => {}))
        render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
        expect(screen.getByText('Checking admin access...')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark Completed' })).not.toBeInTheDocument()
        expect(supabase.rpc).not.toHaveBeenCalled()
    })
})
