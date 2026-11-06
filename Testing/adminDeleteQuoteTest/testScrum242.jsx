import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach, it, expect } from 'vitest'
import AdminDashboard from '../../src/pages/AdminDashboard'

const { supabase } = vi.hoisted(() => ({
    supabase: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() }
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))
vi.mock('../../src/components/ServicePhotosManager', () => ({ default: () => null }))
let tables
const row = (id, extra = {}) => ({ id, customerName: id, email: `${id}@example.com`,
    phone: '9165550100', property: 'Residential', service: 'Deep Cleaning',
    message: 'Kitchen', address: 'Main St', status: 'pending', ...extra })
beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    tables = {
        quotes: [row('Pending customer')],
        accepted_quotes: [row('Active customer', { status: 'accepted' }),
            row('Completed customer', { status: 'accepted', completion: { completedAt: '2026-10-01T12:00:00Z' } })],
        declined_quotes: [row('Declined customer')]
    }
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin' } }, error: null })
    supabase.from.mockImplementation(table => {
        const query = {
            select: vi.fn(() => query), eq: vi.fn(() => query),
            maybeSingle: vi.fn(async () => ({ data: { is_admin: true }, error: null })),
            order: vi.fn(async () => ({ data: [...(tables[table] || [])], error: null }))
        }
        return query
    })
    supabase.rpc.mockImplementation(async (_name, { p_table, p_quote_id }) => {
        tables[p_table] = tables[p_table].filter(row => row.id !== p_quote_id)
        return { error: null }
    })
})
function panel(name) { return screen.getByRole('heading', { name, exact: true }).parentElement }
async function open() {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    await screen.findByText('Active customer')
    await screen.findByText('Declined customer')
}
it.each([
    ['Manage Quotes', 'quotes', 'Pending customer'],
    ['Manage Appointments', 'accepted_quotes', 'Active customer'],
    ['Completed Appointments', 'accepted_quotes', 'Completed customer'],
    ['Declined Quotes', 'declined_quotes', 'Declined customer']
])('permanently deletes from %s only after confirmation', async (section, table, id) => {
    await open()
    await userEvent.click(within(panel(section)).getByRole('button', { name: 'Delete Quote' }))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(within(screen.getByRole('dialog')).getByText(id)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Permanently Delete' }))
    expect(await screen.findByRole('status')).toHaveTextContent(`Quote for ${id} permanently deleted.`)
    expect(supabase.rpc).toHaveBeenCalledWith('scrum242_delete_quote', { p_table: table, p_quote_id: id })
    expect(within(panel(section)).queryByText(id)).not.toBeInTheDocument()
    // A later server refresh must not bring the deleted appointment back.
    fireEvent.focus(window)
    await waitFor(() => expect(within(panel(section)).queryByText(id)).not.toBeInTheDocument())
})
it('cancels without any write', async () => {
    await open()
    await userEvent.click(within(panel('Manage Quotes')).getByRole('button', { name: 'Delete Quote' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Pending customer')).toBeInTheDocument()
})
it.each(['denied', 'network'])('keeps the row and dialog on %s failures', async mode => {
    await open()
    if (mode === 'denied') supabase.rpc.mockResolvedValueOnce({ error: { message: 'Administrator access required.' } })
    else supabase.rpc.mockRejectedValueOnce(new Error('Network unavailable'))
    await userEvent.click(within(panel('Manage Quotes')).getByRole('button', { name: 'Delete Quote' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Permanently Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(mode === 'denied' ? 'Administrator access required.' : 'Network unavailable')
    expect(within(panel('Manage Quotes')).getByText('Pending customer')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('blocks repeated confirmation and cancellation while deleting', async () => {
    await open()
    let finish
    supabase.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await userEvent.click(within(panel('Manage Quotes')).getByRole('button', { name: 'Delete Quote' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Permanently Delete' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Deleting…' }))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    finish({ error: null })
    await screen.findByRole('status')
})
it.each(['Manage Quotes', 'Declined Quotes'])('clamps %s pagination after deleting the last page', async section => {
    tables[section === 'Manage Quotes' ? 'quotes' : 'declined_quotes'].push(row('Second customer'))
    await open()
    await userEvent.click(within(panel(section)).getByRole('button', { name: '›' }))
    expect(within(panel(section)).getByText('Second customer')).toBeInTheDocument()
    await userEvent.click(within(panel(section)).getByRole('button', { name: 'Delete Quote' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Permanently Delete' }))
    await screen.findByRole('status')
    expect(within(panel(section)).getByText(section === 'Manage Quotes' ? 'Pending customer' : 'Declined customer')).toBeInTheDocument()
    expect(within(panel(section)).queryByText('Page 2/1')).not.toBeInTheDocument()
})
it('refreshes declined quotes after background cleanup without browser deletion calls', async () => {
    await open()
    tables.declined_quotes = []
    fireEvent.focus(window)
    await waitFor(() => expect(screen.queryByText('Declined customer')).not.toBeInTheDocument())
    expect(supabase.rpc).not.toHaveBeenCalled()
})
