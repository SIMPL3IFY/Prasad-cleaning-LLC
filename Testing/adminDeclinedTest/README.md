# SCRUM-230: Testing — Declined Quotes

## What this tests

Unit tests for the **Declined Quotes** box in the admin dashboard (`src/pages/AdminDashboard.jsx`): how declined quotes are listed, and what happens when the admin moves one back to Manage Quotes.

Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`. These tests never touch the real database and never change a real quote.

`alert()` doesn't exist in the test browser, so the tests replace it with a fake (`vi.stubGlobal`) and check that it was called.

## Test file

`Testing/adminDeclinedTest/testScrum230Declined.jsx`

## How to run

No dev server or `.env` is needed. These tests also run in CI on every pull request.

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the Declined Quotes tests

```bash
npx vitest run Testing/adminDeclinedTest
```

You should see output like this:

```
✓ Testing/adminDeclinedTest/testScrum230.jsx (6 tests)

Test Files  1 passed (1)
     Tests  6 passed (6)
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

### Step 5 — View coverage report (optional)

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report.

---

## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Declined quote details | Each declined quote's name, phone number and decline reason show, and the admin can page through them (AC 6) |
| 2 | No declined quotes | "No declined quotes." shows when the table is empty (extra, same as AC 4) |
| 3 | Load error | An error message shows when the query fails (extra, same as AC 5) |
| 4 | Move, then Cancel | Move to Manage Quotes, then Cancel, saves nothing (extra, SCRUM-183) |
| 5 | Move, then Yes | Move to Manage Quotes, then Yes, saves the quote to `quotes` as pending and deletes it from `declined_quotes` (extra, SCRUM-183) |
| 6 | Insert fails | A failed insert keeps the declined quote and alerts the admin (extra, SCRUM-183) |

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the Declined Quotes box talks to:

- The `declined_quotes` query, to load the list (or fail)
- The insert into `quotes`, to save the moved quote as pending (or fail)
- The delete from `declined_quotes`, to remove the moved quote

Each test can override any of them, for example to make the query return no rows or the insert return an error.