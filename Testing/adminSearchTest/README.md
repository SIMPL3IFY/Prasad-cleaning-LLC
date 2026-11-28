# SCRUM-230: Testing — Dashboard Search

## What this tests

Unit tests for the **Search Quotes By** bar in the admin dashboard (`src/pages/AdminDashboard.jsx`): how the admin opens and hides the search, what each search category matches, and how one search filters every box on the dashboard.

Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`. These tests never touch the real database and never change real data.

## Test file

`Testing/adminSearchTest/testScrum230Search.jsx`

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

### Step 3 — Run just the Dashboard Search tests

```bash
npx vitest run Testing/adminSearchTest
```

You should see output like this:

```
✓ Testing/adminSearchTest/testScrum230.jsx (10 tests)

Test Files  1 passed (1)
     Tests  10 passed (10)
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
| 1 | Hide and show | Search is hidden until opened, and Hide Search restores the list and clears the text (SCRUM-218) |
| 2 | Name | Name search ignores upper and lower case (SCRUM-218) |
| 3 | All boxes at once | One search filters Manage Quotes, Manage Appointments, Declined and Completed at once (SCRUM-218) |
| 4 | City / address | Searching by city or address filters the list (SCRUM-218) |
| 5 | Service | Searching by service filters the list (SCRUM-218) |
| 6 | Property | Searching by property filters the list (SCRUM-218) |
| 7 | Appointment date | Searching with the date picker filters by appointment date (SCRUM-218) |
| 8 | Time | A time search matches any time in the same hour, so 09:15 finds 09:00 (SCRUM-219) |
| 9 | Clear | The ✕ button clears the search (SCRUM-218) |
| 10 | Change category | Changing the category resets to page 1 (SCRUM-218) |

Tests 4 to 6 are one test run three times with `it.each`.

**Note:** `matchesSearch()` has an AM/PM branch, but the time field is an `<input type="time">`, which always sends 24-hour values like `14:00`. Admins can't reach that branch, so these tests don't cover it. It will show as untested in the coverage report.

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the dashboard loads for the search to filter:

- The quotes, appointments, declined quotes and completed jobs queries, so one search can be checked against all four boxes

Each test can override any of them with its own rows, for example to give two quotes different names, cities or times and check which one the search keeps.