# SCRUM-236: Testing — Admin Sign In

## What this tests

Unit tests for admin sign in: that an admin can sign in and reach the admin dashboard, and that everyone else is kept out of it.

Two pieces of code are covered:

- **Sign in page** (`src/pages/SignIn.jsx`): after login it checks the user's `is_admin` flag and sends admins to `/admin` and everyone else to `/portal`.
- **Admin route guard** (`src/components/ProtectedAdminRoute.jsx`): protects `/admin`. Signed-out visitors and non-admins are sent back to `/signin` with a message.

Supabase is fully mocked so these tests never touch the real database or auth server.

Customer sign in is tested separately in `Testing/signInTest/testScrum1.jsx`, so these tests only cover the admin side.

## Test file

`Testing/adminSignInTest/testScrum236.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-236 tests

```bash
npx vitest run Testing/adminSignInTest/testScrum236.jsx
```

You should see output like this:

```
✓ Testing/adminSignInTest/testScrum236.jsx (14 tests)

Test Files  1 passed (1)
     Tests  14 passed (14)
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

### Step 5 — View coverage report (optional)

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report. `ProtectedAdminRoute.jsx` should show 100% for statements, branches, functions and lines.

---

## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Admin reaches the dashboard | `is_admin: true` sends the user to `/admin`, and the profile lookup uses that admin's own user id |
| 2 | Email is cleaned up | `  ADMIN@Example.COM  ` is sent as `admin@example.com` and still reaches the dashboard |
| 3 | `is_admin: null` at sign in | The user goes to `/portal`, not `/admin` |
| 4 | No `is_admin` field | A profile with no `is_admin` field goes to `/portal` |
| 5 | Loading message | "Verifying admin access..." shows while the guard checks |
| 6 | Signed out | The visitor is sent to sign in with "Please sign in with an administrator account." |
| 7 | Session error | Treated the same as signed out |
| 8 | Customer | Sent to sign in with "Access denied. This account is not an administrator." |
| 9 | `is_admin: null` at the guard | Access denied |
| 10 | Profile lookup fails | Access denied (fails closed) |
| 11 | Admin | The dashboard shows |
| 12 | Page left during session check | The check stops and no profile lookup is made |
| 13 | Page left during profile check | The check stops and the dashboard never shows |
| 14 | Full admin flow | An admin signs in on the real sign in page, passes the guard and lands on the dashboard |

---

## How the mock works

Supabase is fully faked so the tests never touch the real database:

- `auth.signInWithPassword()` returns a fake user or a fake error
- `auth.getUser()` returns the signed-in user the guard sees, or a promise that never finishes to test the loading message
- `from('profiles').select().eq().maybeSingle()` is built by the `mockProfile` helper and returns `{ data, error }`

The guard tests render the **real** sign in page at `/signin`, so the redirect message ("Access denied..." or "Please sign in...") shows on screen exactly as a user would see it.

---

## Selenium tests

`Testing/selenium/test_admin_sign_in.py` has 4 functional tests that drive the real site in Chrome. They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

### How to run

```bash
pip install -r Testing/selenium/requirements.txt   # once
npm run dev                                         # terminal 1
```

The signed-in tests need real accounts and are skipped without them. The admin account must have `is_admin = true` in the `profiles` table. The customer account is only needed for test 4. In terminal 2:

```powershell
$env:TEST_ADMIN_EMAIL = 'admin@example.com'; $env:TEST_ADMIN_PASSWORD = '...'
$env:TEST_CUSTOMER_EMAIL = 'you@example.com'; $env:TEST_CUSTOMER_PASSWORD = '...'
python -m pytest Testing/selenium/test_admin_sign_in.py -v
```

If the project has a `.venv` folder, use its Python instead so it finds the Selenium you installed there (the quotes and `&` are needed because the folder path has a space):

```powershell
& ".venv\Scripts\python.exe" -m pytest Testing/selenium/test_admin_sign_in.py -v
```

To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Needs account? | Saves data? |
|---|---|---|---|---|
| 1 | Signed out | Opening `/admin` lands on `/signin` with "Please sign in with an administrator account." | No | No |
| 2 | Admin signs in | Signing in lands on `/admin` and the Sign Out button shows | Admin | No |
| 3 | Admin signs out | Sign Out returns to the home page, and opening `/admin` again goes back to sign in | Admin | No |
| 4 | Customer denied | A signed-in customer who opens `/admin` sees "Access denied. This account is not an administrator." | Customer | No |

### Why some cases are only unit tests

The Selenium tests use the real Supabase project, so they can't make a session check or profile lookup fail on purpose. Those cases (tests 7, 10, 12 and 13 above) are covered by the unit tests, which fake Supabase.
