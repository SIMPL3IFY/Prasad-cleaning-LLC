# SCRUM-233: Testing — Site Header

## What this tests

Unit tests for the site Header (`src/components/Header.jsx`). 

Unit tests for the 404 route handling using the real `NotFound` component (`src/pages/NotFound.jsx`). 

Supabase and `AuthContext` are mocked to evaluate header behavior across all authentication states (signed out, logged-in customer, logged-in admin), mobile menu responsiveness, and auto-closure behavior upon user action. These tests never touch the real database.

## Test file

`Testing/headerTest/testScrum233.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-233 tests

```bash
npm run test:run -- Testing/headerTest/testScrum233.jsx
```

### Alternatively use npx 

```bash
npx vitest run Testing/headerTest/testScrum233.jsx
```

You should see output like this:

```
✓ Testing/headerTest/testScrum233.jsx (18)

 Test Files  1 passed (1)
      Tests  18 passed (18)
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
| 1 | Logo Link | Clicking header logo redirects to / Home page |
| 2 | Services Link | Clicking Services redirects to /services |
| 3 | About Link | Clicking About redirects to /about |
| 4 | Testimonials Link | Clicking Testimonials redirects to /testimonials |
| 5 | Service Areas Link | Clicking Service Areas redirects to /service-area |
| 6 | Contact Link | Clicking Contact redirects to /contact |
| 7 | Active Route Link| Checks active route receives aria-current="page" |
| 8 | Desktop Sign In | Clicking desktop Sign In redirects to /signin |
| 9 | Desktop Customer Dashboard | Clicking desktop Dashboard as customer checks role and routes to /portal |
| 10 | Desktop Admin Dashboard | Clicking desktop Dashboard as admin checks role and routes to /admin |
| 11 | Desktop Sign Out | Clicking desktop Sign Out calls supabase.auth.signOut() and redirects to / Home Page |
| 12 | Sign-Out Error Handling | Verifies the app does not falsely redirect home if sign-out returns an error |
| 13 | Hamburger Button | Clicking toggles aria-expanded and opens/closes mobile menu |
| 14 | Mobile Sign In | Opening mobile menu, clicking Sign In redirects to /signin, and closes the mobile menu |
| 15 | Mobile Customer Dashboard | Opening mobile menu, clicking Dashboard routes customer to /portal, and closes the mobile menu |
| 16 | Mobile Admin Dashboard | Opening mobile menu, clicking Dashboard routes admin to /admin, and closes the mobile menu |
| 17 | Mobile Sign Out | Opening mobile menu, clicking Sign Out logs user out, redirects to / Home Page, and closes the mobile menu |
| 18 | 404 Page Test | Verifies the real NotFound component renders correctly on unknown routes with a link back to home |

---

## How the mock works

AuthContext: Fakes useAuth() to alternate between user = null (signed out) and populated user objects (signed in).

Supabase Client: supabase.from('profiles').select().eq().maybeSingle() is mocked to test role-based navigation logic for customers vs. administrators. supabase.auth.signOut() is mocked to ensure local storage clearance and routing without database interaction.

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
python -m pytest Testing/selenium/test_header.py -v
```

If the project has a `.venv` folder, use its Python instead so it finds the Selenium you installed there (quotes and `&` are needed because the folder path has a space):

```powershell
& ".venv\Scripts\python.exe" -m pytest Testing/selenium/test_header.py -v
```

Add `$env:HEADLESS="1"` first to run without opening a Chrome window.

### Selenium tests included

| # | Test | Needs | What it checks |
|---|---|---|---|
| 1 | Logo navigation | nothing | Clicking the header logo redirects back to the homepage from /about |
| 2 | All nav links | nothing | Sequentially clicks Services, About, Testimonials, Service Areas, and Contact links |
| 3 | Sign-in button | nothing | Clicking "Sign In" in the header redirects signed-out users to /signin |
| 4 | 404 route handling | nothing | Navigating to a non-existent URL displays the 404 page and 'Back to Home' links back correctly |
| 5 | Mobile hamburger menu | nothing | Resizes to mobile dimensions, toggles the hamburger menu, and verifies navigation |
| 6 | Customer dashboard & sign out | customer account | Tests customer "Dashboard" redirection to /portal and "Sign Out" resetting to home with "Sign In" reappearing |
| 7 | Admin dashboard & sign out | admin account | Tests admin "Dashboard" redirection to /admin and "Sign Out" resetting to home with "Sign In" reappearing |

---

Tests whose accounts aren't set are **skipped**, not failed.
