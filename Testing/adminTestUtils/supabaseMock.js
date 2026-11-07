// Scrum-230: Shared fake Supabase client for the Admin Dashboard unit tests.
// No test that uses this file makes a real network or database call (AC 2).
import { vi } from 'vitest'

// Scrum-230: The bare fake client. Each test file passes this to vi.mock().
export function createSupabaseFake() {
    return {
        auth: { getUser: vi.fn(), signOut: vi.fn() },
        from: vi.fn(),
        rpc: vi.fn(),
        functions: { invoke: vi.fn() },
    }
}

// Scrum-230: What each table returns unless a test says otherwise
const DEFAULT_TABLE = {
    rows: [],           // returned by select queries
    selectError: null,  // e.g. { message: 'permission denied' }
    insertError: null,
    deleteError: null,
    updateRows: null,   // rows an .update().select() returns; [] imitates an RLS block
    updateError: null,
}

// Scrum-230: Sets what every Supabase call returns, and records each call so tests can check it.
// tables:  { quotes: { rows: [...] }, declined_quotes: { insertError: {...} }, ... }
// options: isAdmin (profiles.is_admin), user (null means signed out)
export function setupSupabase(supabase, tables = {}, { isAdmin = true, user = { id: 'admin-1' } } = {}) {
    const calls = [] // one entry per supabase.from(...) chain: { table, op, payload, filters }
    const config = (table) => ({ ...DEFAULT_TABLE, ...tables[table] })

    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: user ? null : { message: 'No session' } })
    supabase.auth.signOut.mockResolvedValue({ error: null })
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    // SCRUM-184 edge function: report both emails as sent by default
    supabase.functions.invoke.mockResolvedValue({
        data: { clientEmail: { sent: true }, adminEmail: { sent: true } },
        error: null,
    })

    supabase.from.mockImplementation((table) => {
        const call = { table, op: 'select', payload: null, filters: {} }
        calls.push(call)

        // Decides the response when the dashboard awaits the chain
        const result = () => {
            if (table === 'profiles') return { data: { is_admin: isAdmin }, error: null }
            const c = config(table)
            switch (call.op) {
                case 'insert': return { data: null, error: c.insertError }
                case 'delete': return { data: null, error: c.deleteError }
                case 'update': return c.updateError
                    ? { data: null, error: c.updateError }
                    : { data: c.updateRows ?? [call.payload], error: null }
                default: return c.selectError
                    ? { data: null, error: c.selectError }
                    : { data: [...c.rows], error: null }
            }
        }

        // Every method returns the same builder, so any chain order works:
        // .select().eq().order(), .update().eq().select(), .delete().eq(), ...
        const builder = {
            select: () => builder, // keeps op as 'update' when used after .update()
            order: () => builder,
            eq: (column, value) => { call.filters[column] = value; return builder },
            insert: (payload) => {
                call.op = 'insert'
                call.payload = Array.isArray(payload) ? payload[0] : payload // acceptQuote sends [ {...} ]
                return builder
            },
            update: (payload) => { call.op = 'update'; call.payload = payload; return builder },
            delete: () => { call.op = 'delete'; return builder },
            maybeSingle: () => Promise.resolve(result()),
            // Makes `await supabase.from(...)...` resolve to result()
            then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
        }
        return builder
    })

    // Scrum-230: Read back what the dashboard sent
    const byOp = (table, op) => calls.filter(c => c.table === table && c.op === op)
    return {
        calls,
        insertsInto: (table) => byOp(table, 'insert').map(c => c.payload),
        updatesTo: (table) => byOp(table, 'update').map(c => ({ payload: c.payload, filters: c.filters })),
        deletesFrom: (table) => byOp(table, 'delete').map(c => c.filters),
    }
}

// Scrum-230: Sample rows, shaped like the aliased select results (camelCase)
export const makeQuote = (overrides = {}) => ({
    id: 'q-1',
    customerName: 'Maria Lopez',
    email: 'maria@example.com',
    phone: '916-555-0101',
    service: 'Standard Clean',
    property: 'House',
    appointmentDate: '2099-01-15',
    appointmentTime: '14:30:00',
    address: '123 Oak St, Sacramento, CA',
    message: 'Two dogs in the backyard',
    status: 'pending',
    ...overrides,
})

export const makeAppointment = (overrides = {}) =>
    makeQuote({ id: 'a-1', originalQuoteId: 'q-1', status: 'accepted', completion: null, ...overrides })

export const makeDeclinedQuote = (overrides = {}) =>
    makeQuote({ id: 'd-1', declineReason: 'Outside service area', declinedAt: '2026-10-01T10:00:00Z', ...overrides })