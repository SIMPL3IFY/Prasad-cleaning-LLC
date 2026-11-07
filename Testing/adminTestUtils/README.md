# Admin Dashboard test helpers (Scrum-230)

Shared code for every `Testing/admin*Test` unit test. These files contain no tests,
and their names must not start with `test`, or Vitest will try to run them.

## supabaseMock.js

A fake Supabase client, so admin tests never touch the network or the real database.

- `createSupabaseFake()`: the empty fake. Passed to `vi.mock()` at the top of each test file.
- `setupSupabase(supabase, tables, options)`: sets what each table returns and records every call.
  - `tables.quotes.rows`: rows a select returns
  - `selectError`, `insertError`, `deleteError`, `updateError`: make that call fail
  - `updateRows: []`: imitates an RLS-blocked update (no error, zero rows)
  - `options.isAdmin`, `options.user`: control the admin access check
- It returns `insertsInto(table)`, `updatesTo(table)` and `deletesFrom(table)`, so tests can check what the dashboard sent.
- `makeQuote`, `makeAppointment`, `makeDeclinedQuote`: sample rows.

## renderDashboard.jsx

- `renderDashboard()`: renders the dashboard at `/admin`, with stand-in `/signin` and `/` pages.
- `renderDashboardAsAdmin()`: the same, then waits until the admin check passes.
- `getPanel('Manage Quotes')`: queries limited to one dashboard box.

## Usage

```jsx
vi.mock('../../src/lib/supabaseClient', async () => {
  const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
  return { supabase: createSupabaseFake() }
})
import { supabase } from '../../src/lib/supabaseClient'
```