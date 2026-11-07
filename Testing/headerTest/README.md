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
npm run test:run -- Testing/headerTest
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
