# SCRUM-230: Testing — Admin Dashboard Test Helpers

## What this is

Shared code used by every admin dashboard unit test (`Testing/admin*Test`). It fakes Supabase and renders the dashboard, so the tests never touch the network, never touch the real database, and never change real data.

These files contain no tests, so there is nothing to run here. Their names must not start with `test`, or Vitest will try to run them.

## Files

`Testing/adminTestUtils/supabaseMock.js`
`Testing/adminTestUtils/renderDashboard.jsx`

## How to use

Each test file replaces the real Supabase client with the fake at the top of the file:

```jsx
vi.mock('../../src/lib/supabaseClient', async () => {
  const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
  return { supabase: createSupabaseFake() }
})
import { supabase } from '../../src/lib/supabaseClient'
```

Then each test sets up what the tables return with `setupSupabase()` and renders the dashboard with `renderDashboard()` or `renderDashboardAsAdmin()`.

To run the tests that use these helpers, see the README in each test folder, or run every unit test from the project root:

```bash
npm run test:run
```

---

## How the mock works

`supabaseMock.js` is a fake Supabase client:

- `createSupabaseFake()` gives the empty fake. It is passed to `vi.mock()` at the top of each test file.
- `setupSupabase(supabase, tables, options)` sets what each table returns and records every call.

### What each test can set

| Setting | What it does |
|---|---|
| `tables.quotes.rows` | The rows a select returns |
| `selectError` | Makes the select fail |
| `insertError` | Makes the insert fail |
| `deleteError` | Makes the delete fail |
| `updateError` | Makes the update fail |
| `updateRows: []` | Imitates an update blocked by RLS: no error, but zero rows updated |
| `options.isAdmin` | Controls whether the admin check passes |
| `options.user` | Controls who is signed in for the admin check |

### What the mock gives back

`setupSupabase()` returns `insertsInto(table)`, `updatesTo(table)` and `deletesFrom(table)`, so a test can check exactly what the dashboard sent.

### Sample rows

`makeQuote`, `makeAppointment` and `makeDeclinedQuote` build sample rows for the tests.

---

## How the dashboard is rendered

`renderDashboard.jsx` renders `AdminDashboard.jsx` for the tests:

- `renderDashboard()` renders the dashboard at `/admin`, with stand-in `/signin` and `/` pages, so a test can check where the admin is sent.
- `renderDashboardAsAdmin()` does the same, then waits until the admin check passes.
- `getPanel('Manage Quotes')` limits queries to one dashboard box, so a test only looks inside that box.