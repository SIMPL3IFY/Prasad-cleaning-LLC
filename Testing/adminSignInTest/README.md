# SCRUM-236: Testing — Admin Sign In

## What this tests

That an admin can sign in and reach the admin dashboard, and that everyone else is kept out of it.

Two pieces of code are covered:

- **Sign in page** (`src/pages/SignIn.jsx`): after login it checks the user's `is_admin` flag and sends admins to `/admin` and everyone else to `/portal`.
- **Admin route guard** (`src/components/ProtectedAdminRoute.jsx`): protects `/admin`. Signed-out visitors and non-admins are sent back to `/signin` with a message.

There are two kinds of tests:

| Kind | File | Runs against |
|---|---|---|
| Unit tests (Vitest) | `Testing/adminSignInTest/testScrum236.jsx` | Fake Supabase, no network |
| Functional tests (Selenium) | `Testing/selenium/test_admin_sign_in.py` | The real site in Chrome, real Supabase |

Customer sign in is tested separately in `Testing/signInTest/testScrum1.jsx`, so these tests only cover the admin side.

---

## Unit tests

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

You should see:

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

Then open `coverage/index.html` in your browser. `ProtectedAdminRoute.jsx` should show 100% for statements, branches, functions and lines.

### Unit tests included

**Admin Sign In** (sign in page)

| # | Test | What it checks |
|---|---|---|
| 1 | Admin reaches the dashboard | `is_admin: true` sends the user to `/admin`, and the profile lookup uses that admin's own user id |
| 2 | Email is cleaned up | `  ADMIN@Example.COM  ` is sent as `admin@example.com` and still reaches the dashboard |
| 3 | `is_admin: null` is not an admin | Goes to `/portal`, not `/admin` |
| 4 | Missing `is_admin` is not an admin | A profile with no `is_admin` field goes to `/portal` |

**Admin Route Guard** (`/admin`)

| # | Test | What it checks |
|---|---|---|
| 5 | Loading message | Shows "Verifying admin access..." while the check runs |
| 6 | Signed out | Sent to sign in with "Please sign in with an administrator account." |
| 7 | Session error | Treated the same as signed out |
| 8 | Customer | Sent to sign in with "Access denied. This account is not an administrator." |
| 9 | `is_admin: null` | Access denied |
| 10 | Profile lookup fails | Access denied (fails closed) |
| 11 | Admin | Dashboard is shown |
| 12 | Page left during session check | The check stops and no profile lookup is made |
| 13 | Page left during profile check | The check stops and the dashboard is never shown |

**Together**

| # | Test | What it checks |
|---|---|---|
| 14 | Full admin flow | Admin signs in on the real sign in page, passes the guard, and lands on the dashboard |

### How the mock works

Supabase is fully faked so the unit tests never touch the real database:

- `supabase.auth.signInWithPassword` returns a fake user or a fake error.
- `supabase.auth.getUser` returns the signed-in user the guard sees, or a never-ending promise to test the loading state.
- `supabase.from('profiles').select().eq().maybeSingle()` is built by the `mockProfile` helper and returns `{ data, error }`.

The guard tests render the **real** sign in page at `/signin`, so the redirect message ("Access denied..." or "Please sign in...") shows up on screen exactly as a user would see it.

---

## Functional tests (Selenium)

These open real Chrome and click through the running site.

### Step 1 — Install Selenium (first time only)

```bash
pip install -r Testing/selenium/requirements.txt
```

### Step 2 — Start the site (terminal 1)

```bash
npm run dev
```

### Step 3 — Set test accounts (terminal 2, PowerShell)

```powershell
$env:TEST_ADMIN_EMAIL="admin-account@example.com"
$env:TEST_ADMIN_PASSWORD="admin-password"

# optional, for the "customer is denied" test
$env:TEST_CUSTOMER_EMAIL="customer-account@example.com"
$env:TEST_CUSTOMER_PASSWORD="customer-password"
```

Use real accounts. The admin account must have `is_admin = true` in the `profiles` table.

### Step 4 — Run the tests (terminal 2)

```bash
python -m pytest Testing/selenium/test_admin_sign_in.py -v
```

If the project has a `.venv` folder, use its Python instead so it finds the Selenium you installed there (quotes and `&` are needed because the folder path has a space):

```powershell
& ".venv\Scripts\python.exe" -m pytest Testing/selenium/test_admin_sign_in.py -v
```

Add `$env:HEADLESS="1"` first to run without opening a Chrome window.

### Selenium tests included

| # | Test | Needs | What it checks |
|---|---|---|---|
| 1 | Signed-out visitor is sent to sign in | nothing | Opening `/admin` lands on `/signin` with "Please sign in with an administrator account." |
| 2 | Admin reaches the dashboard | admin account | Signing in lands on `/admin` and the Sign Out button is visible |
| 3 | Admin signs out and loses access | admin account | Sign Out returns to the home page; opening `/admin` again goes back to sign in |
| 4 | Customer is denied | customer account | A signed-in customer who opens `/admin` sees "Access denied. This account is not an administrator." |

Tests whose accounts aren't set are **skipped**, not failed. Selenium tests don't run in CI, so run them yourself before opening a PR.
