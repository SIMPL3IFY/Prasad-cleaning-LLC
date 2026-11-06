# SCRUM-234: Testing — Site Footer

## What this tests

Unit tests for the site Footer (`src/components/Footer.jsx`). 

Supabase and `AuthContext` are mocked in unit tests to evaluate footer behavior across all authentication states (signed out, logged-in customer, logged-in admin), dynamic role-based dashboard redirection (`/portal` vs `/admin`), and the inclusion of the **Settings** link. These tests never touch the real database.

## Test file

`Testing/headerTest/testScrum234.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-234 tests

```bash
npm run test:run -- Testing/footerTest
```

You should see output like this:

```
 ✓ Testing/footerTest/testScrum234.jsx (6)

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
| 1 | Signed-Out Links | Verifies default column links (/about, /testimonials, /contact, /services, /service-area, /signin, /signup) render correctly |
| 2 | Phone & Email Protocols | Verifies phone link uses tel:+19166658474 and email uses mailto: with pre-filled subject line |
| 3 | Dynamic Copyright Year | Checks that the copyright line dynamically formats using new Date().getFullYear() |
| 4 | Customer Auth Links | Verifies Sign In / Create Account links are replaced with Dashboard (/portal) and Settings (/settings) when logged in as a customer |
| 5 | Admin Auth Links | Verifies Dashboard routes to /admin and Settings (/settings) is rendered for admin users |
| 6 | Settings Link Navigation | Verifies clicking Settings in the footer navigates the user to /settings |

---

## How the mock works

AuthContext: Fakes useAuth() to alternate between user = null (signed out) and populated user objects (signed in).

Supabase Client: supabase.from('profiles').select().eq().maybeSingle() is mocked to asynchronously return profile data (is_admin: true/false), ensuring the footer dynamically points to /admin or /portal accordingly without hitting the live database.
