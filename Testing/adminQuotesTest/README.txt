# SCRUM-230: Testing — Manage Quotes

## What this tests

Unit tests for the **Manage Quotes** box in the admin dashboard (`src/pages/AdminDashboard.jsx`): how quotes are listed, and what happens when the admin declines or accepts one.

Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`. These tests never touch the real database and never change a real quote.

## Test file

`Testing/adminQuotesTest/testScrum230Quotes.jsx`

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

### Step 3 — Run just the Manage Quotes tests

```bash
npx vitest run Testing/adminQuotesTest
```

You should see output like this:

```
✓ Testing/adminQuotesTest/testScrum230.jsx (8 tests)

Test Files  1 passed (1)
     Tests  8 passed (8)
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
| 1 | Quote details | Each quote's name and phone number show, and the admin can page through the quotes (AC 3) |
| 2 | No quotes | "No quotes available." shows when the query returns no rows (AC 4) |
| 3 | Load error | An error message shows when the query fails (AC 5) |
| 4 | Decline, no reason | Declining with no reason, or only spaces, shows a message and saves nothing (AC 7) |
| 5 | Decline with reason | Declining with a reason saves the quote to `declined_quotes` and removes it from the list (AC 8) |
| 6 | Decline insert fails | A failed decline insert keeps the quote (extra) |
| 7 | Accept, then Cancel | Accept, then Cancel in the popup, saves nothing (extra) |
| 8 | Accept, then Yes | Accept, then Yes, saves the quote to `accepted_quotes` and removes it from the list (AC 9) |

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the Manage Quotes box talks to:

- The quotes query, to load the list (or fail)
- The insert into `declined_quotes`, to save a declined quote (or fail)
- The insert into `accepted_quotes`, to save an accepted quote
- The delete from `quotes`, to remove the quote once it is declined or accepted

Each test can override any of them, for example to make the query return no rows or the decline insert return an error.