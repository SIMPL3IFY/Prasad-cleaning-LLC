# SCRUM-230: Testing — Admin Access and Navigation

## What this tests

Unit tests for the admin dashboard (`src/pages/AdminDashboard.jsx`): who is allowed to open it, and what the header buttons (Sign Out, Home, Manage Services) do.

Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`, so these tests never touch the real database or auth server and never change a real account.

The Edit Services popup (`ServicePhotosManager`) is replaced with a simple stand-in. These tests only check that the dashboard opens and closes it, not what the popup does inside.

Admin Settings (password change) has its own scrum and is not covered here.

## Test file

`Testing/adminAccessTest/testScrum230Access.jsx`

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

### Step 3 — Run just the SCRUM-230 tests

```bash
npx vitest run Testing/adminAccessTest
```

You should see output like this:

```
✓ Testing/adminAccessTest/testScrum230.jsx (9 tests)

Test Files  1 passed (1)
     Tests  9 passed (9)
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
| 1 | Checking access | "Checking admin access..." shows until the admin check finishes (SCRUM-119) |
| 2 | Admin allowed in | An admin sees all six dashboard boxes (SCRUM-119) |
| 3 | Signed out | A signed-out visitor is sent to `/signin` (SCRUM-119) |
| 4 | Not an admin | A signed-in non-admin is sent to `/signin`, after their own profile row is checked (SCRUM-119) |
| 5 | Demo admin | The demo admin gets in without calling Supabase Auth (SCRUM-184) |
| 6 | Sign Out | Sign Out ends the session and goes to `/` (SCRUM-172) |
| 7 | Sign Out fails | A failed sign out keeps the admin on the dashboard (SCRUM-172) |
| 8 | Home link | The Home link goes to `/` (SCRUM-187) |
| 9 | Manage Services | Manage Services opens the Edit Services popup, and it closes again (SCRUM-204) |

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the dashboard talks to:

- Supabase Auth, to return the signed-in user (or nobody) and to sign out
- The profile row lookup, to decide whether the signed-in user is an admin

Each test can override these, for example to sign the user out, make them a non-admin, or make sign out fail.

`ServicePhotosManager` is replaced with a stand-in, so test 9 only checks that the popup opens and closes.