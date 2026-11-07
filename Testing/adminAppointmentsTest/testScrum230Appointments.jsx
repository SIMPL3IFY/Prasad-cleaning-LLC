// SCRUM-230: Unit tests for the Manage Appointments box in AdminDashboard.jsx
// Covers display, editing (SCRUM-142/189), email sync (SCRUM-184) and cancelling (Scrum 150).
// Mark Completed is covered separately by Testing/adminCompletedTest (SCRUM-215).
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// SCRUM-230: Replace the real Supabase client with the fake
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase, makeAppointment } from '../adminTestUtils/supabaseMock'
import { renderDashboardAsAdmin, getPanel } from '../adminTestUtils/renderDashboard'

const maria = makeAppointment({ id: 'a-1', originalQuoteId: 'q-1', customerName: 'Maria Lopez', phone: '916-555-0101' })
const james = makeAppointment({ id: 'a-2', originalQuoteId: 'q-2', customerName: 'James Chen', phone: '916-555-0202' })

// SCRUM-230: The row Supabase sends back after .update().select(), in database column names
const savedRow = (overrides = {}) => ({
    service: maria.service,
    property: maria.property,
    appointment_date: maria.appointmentDate,
    appointment_time: maria.appointmentTime,
    address: maria.address,
    message: maria.message,
    ...overrides,
})

// SCRUM-230: The raw panel element, needed for the date/time pickers (they have no textbox role)
const appointmentsBox = () =>
    screen.getByRole('heading', { level: 2, name: 'Manage Appointments' }).closest('.admin-panel')

// SCRUM-230: Clicks Edit and returns the edit fields.
// The edit inputs have no labels, so they're picked by position: service, property, address, message.
async function startEditing(user) {
    const box = getPanel('Manage Appointments')
    await user.click(await box.findByRole('button', { name: 'Edit' }))
    const [service, property, address, message] = box.getAllByRole('textbox')
    return {
        box,
        service,
        property,
        address,
        message,
        date: appointmentsBox().querySelector('input[type="date"]'),
        time: appointmentsBox().querySelector('input[type="time"]'),
        save: () => user.click(box.getByRole('button', { name: 'Update Appointment' })),
    }
}

describe('SCRUM-230: Manage Appointments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear() // demo mode off, so the email sync really runs
        vi.stubGlobal('alert', vi.fn()) // a failed cancellation email uses alert()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('showing appointments', () => {
        it("shows the appointment's customer, contact and job details", async () => {
            setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            expect(await box.findByText('Maria Lopez')).toBeInTheDocument()
            expect(box.getByText('916-555-0101')).toBeInTheDocument()
            expect(box.getByText(maria.service)).toBeInTheDocument()
            expect(box.getByText(maria.address)).toBeInTheDocument()
        })

        // SCRUM-243: Update Appointment only exists inside a card being edited
        it('shows an empty state with no Update Appointment button when there are none', async () => {
            setupSupabase(supabase, { accepted_quotes: { rows: [] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            expect(await box.findByText('No appointments available.')).toBeInTheDocument()
            expect(box.queryByRole('button', { name: 'Update Appointment' })).not.toBeInTheDocument()
        })

        it('shows an error message when the appointments query fails', async () => {
            setupSupabase(supabase, { accepted_quotes: { selectError: { message: 'permission denied' } } })
            await renderDashboardAsAdmin()

            // This message is shown at the top of the dashboard, not inside the box
            expect(await screen.findByText('Unable to load appointments. Please refresh and try again.')).toBeInTheDocument()
        })

        // Scrum 87: changing pages must cancel edit mode
        it('leaves edit mode when paging to another appointment', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { accepted_quotes: { rows: [maria, james] } })
            await renderDashboardAsAdmin()
            const { box } = await startEditing(user)

            await user.click(box.getByRole('button', { name: '›' }))

            expect(box.getByText('James Chen')).toBeInTheDocument()
            expect(box.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
            // SCRUM-243: out of edit mode, the card shows Mark Completed instead of Update Appointment
            expect(box.getByRole('button', { name: 'Mark Completed' })).toBeInTheDocument()
            expect(box.queryByRole('button', { name: 'Update Appointment' })).not.toBeInTheDocument()        
        })
    })

    describe('editing an appointment', () => {
        // SCRUM-243: Edit swaps Mark Completed for Update Appointment, and Cancel swaps it back
        it('shows Update Appointment in place of Mark Completed while editing', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            // Before editing: Mark Completed, no Update Appointment
            expect(await box.findByRole('button', { name: 'Mark Completed' })).toBeInTheDocument()
            expect(box.queryByRole('button', { name: 'Update Appointment' })).not.toBeInTheDocument()

            await user.click(box.getByRole('button', { name: 'Edit' }))
            expect(box.getByRole('button', { name: 'Update Appointment' })).toBeInTheDocument()
            expect(box.queryByRole('button', { name: 'Mark Completed' })).not.toBeInTheDocument()

            await user.click(box.getByRole('button', { name: 'Cancel' }))
            expect(box.getByRole('button', { name: 'Mark Completed' })).toBeInTheDocument()
            expect(box.queryByRole('button', { name: 'Update Appointment' })).not.toBeInTheDocument()
        })
        
        // SCRUM-142: nothing changed, so no database call
        it('blocks saving when nothing was changed', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            await edit.save()

            expect(edit.box.getByRole('alert')).toHaveTextContent('No changes to save. Edit a field first.')
            expect(db.updatesTo('accepted_quotes')).toHaveLength(0)
        })

        // SCRUM-142: required fields can't be blanked out
        it('blocks saving a blank required field', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            await user.clear(edit.address)
            await edit.save()

            expect(edit.box.getByRole('alert')).toHaveTextContent('Address cannot be empty.')
            expect(db.updatesTo('accepted_quotes')).toHaveLength(0)
        })

        // SCRUM-184: a new time is emailed to the client, so it can't be in the past
        it('blocks moving the appointment to a past date', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            fireEvent.change(edit.date, { target: { value: '2020-01-01' } })
            await edit.save()

            expect(edit.box.getByRole('alert')).toHaveTextContent('Appointment time must be in the future.')
            expect(db.updatesTo('accepted_quotes')).toHaveLength(0)
        })

        // SCRUM-142: only the changed column is sent, and the card shows what Supabase saved
        it('sends only the changed field and shows a success message', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, {
                accepted_quotes: { rows: [maria], updateRows: [savedRow({ service: 'Deep Clean' })] },
            })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            await user.clear(edit.service)
            await user.type(edit.service, 'Deep Clean')
            await edit.save()

            expect(await edit.box.findByText('Appointment updated for Maria Lopez.')).toBeInTheDocument()
            expect(db.updatesTo('accepted_quotes')).toEqual([
                { payload: { service: 'Deep Clean' }, filters: { id: 'a-1' } },
            ])
            expect(edit.box.getByText('Deep Clean')).toBeInTheDocument()
            expect(edit.box.getByRole('button', { name: 'Edit' })).toBeInTheDocument() // left edit mode
            expect(supabase.functions.invoke).not.toHaveBeenCalled() // no time change, so no emails
        })

        // SCRUM-189: an RLS-blocked update returns no error and zero rows
        it('shows an error when the update saves zero rows (RLS block)', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { accepted_quotes: { rows: [maria], updateRows: [] } })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            await user.clear(edit.service)
            await user.type(edit.service, 'Deep Clean')
            await edit.save()

            expect(await edit.box.findByRole('alert')).toHaveTextContent(
                'Changes were not saved. You may not have permission, or this appointment no longer exists.'
            )
            expect(edit.box.getByRole('button', { name: 'Cancel' })).toBeInTheDocument() // still editing
        })

        // SCRUM-189: a database error is shown, and the admin's typing is kept
        it('shows the database error when the update fails', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, { accepted_quotes: { rows: [maria], updateError: { message: 'network down' } } })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            await user.clear(edit.service)
            await user.type(edit.service, 'Deep Clean')
            await edit.save()

            expect(await edit.box.findByRole('alert')).toHaveTextContent('Unable to save changes: network down')
            expect(edit.service).toHaveValue('Deep Clean')
        })

        // SCRUM-184: a new date emails the client and Nigel through sync-appointment
        it('emails the new time after a date change', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase, {
                accepted_quotes: { rows: [maria], updateRows: [savedRow({ appointment_date: '2099-02-01' })] },
            })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            fireEvent.change(edit.date, { target: { value: '2099-02-01' } })
            await edit.save()

            expect(await edit.box.findByText('Appointment updated for Maria Lopez. Emails sent.')).toBeInTheDocument()
            expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-appointment', {
                body: { quoteId: 'a-1', mode: 'schedule', previous: { date: '2099-01-15', time: '14:30:00' } },
            })
        })

        // SCRUM-184: a failed email is reported, and Retry sync resends without re-saving
        it('reports a failed email and lets the admin retry', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, {
                accepted_quotes: { rows: [maria], updateRows: [savedRow({ appointment_date: '2099-02-01' })] },
            })
            // First call: client email fails. Later calls fall back to the default (both sent).
            supabase.functions.invoke.mockResolvedValueOnce({
                data: { clientEmail: { sent: false }, adminEmail: { sent: true } },
                error: null,
            })
            await renderDashboardAsAdmin()
            const edit = await startEditing(user)

            fireEvent.change(edit.date, { target: { value: '2099-02-01' } })
            await edit.save()

            expect(await edit.box.findByRole('alert')).toHaveTextContent('Saved, but the client email was not sent.')
            await user.click(edit.box.getByRole('button', { name: 'Retry sync' }))

            expect(await edit.box.findByText('Appointment updated for Maria Lopez. Emails sent.')).toBeInTheDocument()
            expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
            expect(db.updatesTo('accepted_quotes')).toHaveLength(1) // retry did not save again
            expect(edit.box.queryByRole('button', { name: 'Retry sync' })).not.toBeInTheDocument()
        })
    })

    describe('cancelling an appointment', () => {
        // Scrum 150: a reason is required
        it('blocks cancelling without a reason', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            await user.click(await box.findByRole('button', { name: 'Cancel Appointment' }))
            await user.click(box.getByRole('button', { name: 'Confirm Cancellation' }))

            expect(box.getByText('A reason is required before you can cancel this appointment.')).toBeInTheDocument()
            expect(db.insertsInto('declined_quotes')).toHaveLength(0)
        })

        it('closes the prompt and changes nothing on Keep Appointment', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            await user.click(await box.findByRole('button', { name: 'Cancel Appointment' }))
            await user.click(box.getByRole('button', { name: 'Keep Appointment' }))

            expect(box.queryByRole('button', { name: 'Confirm Cancellation' })).not.toBeInTheDocument()
            expect(db.insertsInto('declined_quotes')).toHaveLength(0)
            expect(box.getByText('Maria Lopez')).toBeInTheDocument()
        })

        // Scrum 150 + SCRUM-184: archive, email both sides, then delete
        it('archives to declined_quotes, emails the cancellation, and removes the appointment', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            await user.click(await box.findByRole('button', { name: 'Cancel Appointment' }))
            await user.type(box.getByRole('textbox'), 'Customer moved')
            await user.click(box.getByRole('button', { name: 'Confirm Cancellation' }))

            expect(await box.findByText('No appointments available.')).toBeInTheDocument()
            expect(db.insertsInto('declined_quotes')[0]).toEqual(expect.objectContaining({
                original_quote_id: 'q-1', // keeps the link to the original quote
                customer_name: 'Maria Lopez',
                phone: '916-555-0101',
                decline_reason: 'Customer moved',
            }))
            expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-appointment', {
                body: { quoteId: 'a-1', mode: 'cancel', reason: 'Customer moved' },
            })
            expect(db.deletesFrom('accepted_quotes')).toContainEqual({ id: 'a-1' })
            expect(globalThis.alert).not.toHaveBeenCalled()
        })

        // SCRUM-184: a failed email doesn't block the cancellation, but the admin is warned
        it('still cancels but alerts the admin when the emails fail', async () => {
            const user = userEvent.setup()
            const db = setupSupabase(supabase, { accepted_quotes: { rows: [maria] } })
            supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
            await renderDashboardAsAdmin()
            const box = getPanel('Manage Appointments')

            await user.click(await box.findByRole('button', { name: 'Cancel Appointment' }))
            await user.type(box.getByRole('textbox'), 'Customer moved')
            await user.click(box.getByRole('button', { name: 'Confirm Cancellation' }))

            await waitFor(() =>
                expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('was cancelled, but email sending failed (boom)'))
            )
            expect(db.deletesFrom('accepted_quotes')).toContainEqual({ id: 'a-1' })
        })
    })
})