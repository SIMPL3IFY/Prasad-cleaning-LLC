# SCRUM-234: Testing — Site Footer

## What this tests

Unit tests for the site Footer (`src/components/Footer.jsx`). 

Supabase and `AuthContext` are mocked in unit tests to evaluate footer behavior across all authentication states (signed out, loading, logged-in customer, logged-in admin), dynamic role-based dashboard redirection (`/portal` vs `/admin`), asynchronous slow lookups, fallback error handling, customer-only **Settings** link rendering, and admin settings link omission. These tests never touch the real database.

## Test file

`Testing/footerTest/testScrum234.jsx`

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
npm run test:run -- Testing/footerTest/testScrum234.jsx
```

### Alternatively use npx 

```bash
npx vitest run Testing/footerTest/testScrum234.jsx
```

You should see output like this:

```
✓ Testing/footerTest/testScrum234.jsx (8)

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
| 1 | Signed-Out Links | Verifies default column links (/about, /testimonials, /contact, /services, /service-area, /signin, /signup) render correctly |
| 2 | Phone & Email Protocols | Verifies phone link uses tel:+19166658474 and email uses mailto: with pre-filled subject line |
| 3 | Dynamic Copyright Year | Checks that the copyright line dynamically formats using new Date().getFullYear() |
| 4 | Auth Loading State | Verifies account links are hidden while loading from useAuth() is true |
| 5 | Customer Auth Links | Verifies Sign In / Create Account links are replaced with Dashboard (/portal) and Settings (/settings) when logged in as a customer, and clicking Dashboard opens the Customer Portal |
| 6 | Admin Auth Links | Verifies Dashboard routes to /admin, ensures the customer Settings link is omitted for admin users, and clicking Dashboard opens the Admin Dashboard |
| 7 | Settings Link Navigation | Verifies clicking Settings in the footer navigates customer users to /settings |
| 8 | Slow Profile Lookup | Verifies Dashboard link is suppressed until profile role lookup resolves, preventing incorrect premature routing |

---

## How the mock works

AuthContext: Fakes useAuth() to alternate between user = null (signed out), loading, and populated user objects (signed in).

Supabase Client: supabase.from('profiles').select().eq().maybeSingle() is mocked to asynchronously return profile data (is_admin: true/false) or errors, ensuring the footer dynamically points to /admin or /portal accordingly without hitting the live database.

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

$env:TEST_CUSTOMER_EMAIL="customer-account@example.com"
$env:TEST_CUSTOMER_PASSWORD="customer-password"
```

Test accounts are needed for testing the Header links as an Admin and Customer.

### Step 4 — Run the tests (terminal 2)

```bash
python -m pytest Testing/selenium/test_footer.py -v
```

If the project has a `.venv` folder, use its Python instead so it finds the Selenium you installed there (quotes and `&` are needed because the folder path has a space):

```powershell
& ".venv\Scripts\python.exe" -m pytest Testing/selenium/test_footer.py -v
```

Add `$env:HEADLESS="1"` first to run without opening a Chrome window.

### Selenium tests included

| # | Test | Needs | What it checks |
|---|---|---|---|
| 1 | Logo navigation | nothing | Clicking the footer logo redirects back to the homepage |
| 2 | Company column links | nothing | Verifies Company links: About Us, Testimonials, and Contact |
| 3 | Services column links | nothing | Verifies Services links: Our Services and Service Areas |
| 4 | Signed-out account links | nothing | Verifies Account column links when signed out: Sign In and Create Account |
| 5 | Contact protocols & encoding | nothing | Verifies exact full href values for tel: and mailto: contact links with properly encoded subject strings |
| 6 | Customer account links & settings | customer account | Verifies customer dashboard routing (/portal) and Settings page content check |
| 7 | Admin account links & omission | admin account | Verifies admin dashboard routing (/admin) and confirms the customer Settings link is omitted for admin |

---

Tests whose accounts aren't set are **skipped**, not failed.
