import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminQuoteForm from '../../src/components/AdminQuoteForm'
import AdminDashboard from '../../src/pages/AdminDashboard'

const { supabase, insert } = vi.hoisted(() => ({
    supabase: { auth: { getUser: vi.fn() }, from: vi.fn() }, insert: vi.fn()
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))
vi.mock('../../src/components/ServicePhotosManager', () => ({ default: () => null }))
let admin
let rows
beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    admin = true
    rows = []
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin' } }, error: null })
    insert.mockImplementation(async payload => {
        rows.push({ id: 'new', customerName: payload.customer_name, ...payload })
        return { error: null }
    })
    supabase.from.mockImplementation(table => {
        const query = {
            select: vi.fn(() => query), eq: vi.fn(() => query), insert,
            maybeSingle: vi.fn(async () => ({ data: { is_admin: admin }, error: null })),
            order: vi.fn(async () => ({ data: table === 'quotes' ? [...rows] : [], error: null }))
        }
        return query
    })
})
function fill() {
    for (const [label, value] of [
        ['Customer name', ' Alex Smith '], ['Email', ' alex@example.com '],
        ['Phone', '(916) 555-0100'], ['Address', ' 123 Main St '],
        ['Property type', 'Residential'], ['Service', 'Deep Cleaning'], ['Message', ' Kitchen cleaning ']
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function openForm() {
    const onCreated = vi.fn(), onClose = vi.fn()
    render(<AdminQuoteForm onCreated={onCreated} onClose={onClose} />)
    fill()
    return { onCreated, onClose }
}
it('creates a trimmed pending quote with no appointment and reports success once', async () => {
    const { onCreated } = openForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith({
        customer_name: 'Alex Smith', email: 'alex@example.com', phone: '(916) 555-0100',
        address: '123 Main St', property: 'Residential', service: 'Deep Cleaning',
        message: 'Kitchen cleaning', appointment_date: null, appointment_time: null, status: 'pending'
    })
})
it('requires a 10-digit phone number before writing', async () => {
    openForm()
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('10-digit')
    expect(insert).not.toHaveBeenCalled()
})
it('requires both schedule fields and saves the entered Pacific date and time', async () => {
    const { onCreated } = openForm()
    fireEvent.change(screen.getByLabelText('Appointment date (optional)'), { target: { value: '2026-12-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('both an appointment date and time')
    expect(insert).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Appointment time (optional, Pacific time)'), { target: { value: '14:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ appointment_date: '2026-12-10', appointment_time: '14:30' }))
})
it.each(['non-admin', 'signed-out'])('blocks %s sessions', async mode => {
    openForm()
    if (mode === 'non-admin') admin = false
    else supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    await screen.findByRole('alert')
    expect(insert).not.toHaveBeenCalled()
})
it('preserves the form on database failure and allows retry', async () => {
    const { onCreated } = openForm()
    insert.mockResolvedValueOnce({ error: { message: 'Save failed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
    expect(screen.getByLabelText('Customer name')).toHaveValue(' Alex Smith ')
    expect(onCreated).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
})
it('blocks duplicate submissions while saving', async () => {
    const { onCreated } = openForm()
    let finish
    insert.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const form = screen.getByRole('button', { name: 'Save Quote' }).closest('form')
    fireEvent.submit(form)
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    fireEvent.submit(form)
    expect(insert).toHaveBeenCalledTimes(1)
    finish({ error: null })
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
})
it('cancels without saving', async () => {
    const { onClose } = openForm()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
})
it('opens from the dashboard, refreshes quotes, and closes after creation', async () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Create Quote' }))
    fill()
    await userEvent.click(screen.getByRole('button', { name: 'Save Quote' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Quote created')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Alex Smith')).toBeInTheDocument()
})
