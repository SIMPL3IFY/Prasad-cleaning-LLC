# SCRUM-229: Testing — Customer Sign In

## What this tests

Unit tests for customer sign in on the Sign In page (`src/pages/SignIn.jsx`): that a customer can sign in and reach their portal at `/portal`, and that bad input and failed sign ins show a clear message.

Supabase is fully mocked so these tests never touch the real database or auth server.

Admin sign in is tested separately in `Testing/adminSignInTest/testScrum236.jsx` (SCRUM-236), and the Forgot Password form on the same page in `Testing/forgotPasswordTest/` (SCRUM-231), so these tests only cover customer sign in.

## Test file

`Testing/signInTest/testScrum1.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-229 tests

```bash
npx vitest run Testing/signInTest/testScrum1.jsx
```

You should see output like this:

```
✓ Testing/signInTest/testScrum1.jsx (19 tests)

Test Files  1 passed (1)
     Tests  19 passed (19)
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

**The form**

| # | Test | What it checks |
|---|---|---|
| 1 | Form shows | The Sign In heading, Email Address and Password fields, and Sign In button show |
| 2 | Missing fields | "Please enter both email and password." shows and nothing is sent to Supabase |
| 3 | Invalid email | `not-an-email` shows "Please enter a valid email address." and nothing is sent to Supabase |
| 4 | Show and hide password | The eye button switches the password between hidden and visible |
| 5 | Message from another page | A message passed in when another page sends the user here, such as "Please sign in to continue.", shows |
| 6 | Sign Up button | Goes to the sign up page |
| 7 | "Create one" link | Goes to the sign up page |

**Signing in**

| # | Test | What it checks |
|---|---|---|
| 8 | Email is cleaned up | `  Customer@Example.COM  ` is sent as `customer@example.com` |
| 9 | Customer reaches the portal | A customer goes to `/portal`, and the profile lookup uses that customer's own user id |
| 10 | While signing in | The button reads "Signing In..." and the form is disabled |
| 11 | Wrong credentials | Supabase's "Invalid login credentials" shows and the user stays on Sign In |
| 12 | Error cleared on retry | Signing in again clears the last error |
| 13 | No user returned | "Unable to identify the signed-in account. Please try again." shows |
| 14 | Profile not found | "User profile not found. Please try again." shows and the user is signed out |
| 15 | Profile lookup fails | "Unable to retrieve user profile. Please try again." shows and the user is signed out |

**Unconfirmed email**

| # | Test | What it checks |
|---|---|---|
| 16 | Confirm your email | "Please confirm your email before signing in" shows, and Resend sends a new link and starts a 60 second wait |
| 17 | Message without an error code | An "Email not confirmed" message with no error code is treated the same way |
| 18 | Resend fails | Supabase's error shows and no wait starts |
| 19 | Wait counts down | The resend button counts down from 60s to 59s |

---

## How the mock works

Supabase is fully faked so the tests never touch the real database:

- `auth.signInWithPassword()` returns a fake user, a fake error, or a promise that never finishes to test "Signing In..."
- `auth.resend()` returns success or an error for the confirmation email tests
- `auth.signOut()` is checked when the profile can't be found or read
- `from('profiles').select().eq().maybeSingle()` is built by the `mockProfile` helper and returns `{ data, error }`

The page is rendered inside a `MemoryRouter` with simple stand-in pages for `/portal` and `/signup`, so tests can check where the user ends up.

---

## Selenium tests

`Testing/selenium/test_sign_in.py` has 10 functional tests that drive the real site in Chrome. They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

### How to run

```bash
pip install -r Testing/selenium/requirements.txt   # once
npm run dev                                         # terminal 1
```

In terminal 2:

```powershell
python -m pytest Testing/selenium/test_sign_in.py -v
```

Tests 9 and 10 sign in with a real customer account, so they are skipped unless you set one first:

```powershell
$env:TEST_CUSTOMER_EMAIL = 'customer@example.com'; $env:TEST_CUSTOMER_PASSWORD = '...'
python -m pytest Testing/selenium/test_sign_in.py -v
```

To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Needs account? | Saves data? |
|---|---|---|---|---|
| 1 | Form shows | "Access your account", the email and password fields, Sign In and "Forgot password?" show | No | No |
| 2 | Empty form | The browser blocks the submit and the user stays on Sign In | No | No |
| 3 | Email without @ | `not-an-email` is blocked by the browser | No | No |
| 4 | Email without an ending | `user@example` gets past the browser, and the page shows "Please enter a valid email address." | No | No |
| 5 | Wrong credentials | A made-up account shows "Invalid login credentials" | No | No |
| 6 | Show and hide password | The password switches between hidden and visible | No | No |
| 7 | Sign Up button | Goes to `/signup` | No | No |
| 8 | "Create one" link | Goes to `/signup` | No | No |
| 9 | Customer signs in | A real customer reaches `/portal` | Customer | No |
| 10 | Email with capitals and spaces | The same customer still signs in with the email in capitals and padded with spaces | Customer | No |
