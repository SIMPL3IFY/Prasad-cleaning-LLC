# SCRUM-250: Testing — Admin Settings

## What this tests

Unit tests for the Settings page (`src/pages/Settings.jsx`), the `/settings` page where an admin updates their email, phone number, address and password.

Supabase is fully mocked so these tests never touch the real database or auth server, never change a real account, and never send an email.

The delete-account section has its own scrum and is not covered here. It is replaced by an empty stand-in.

SCRUM-237 (`Testing/settingsTest/`) also tests this page, with 6 basic tests. These tests cover the rest of the page: the email edit flow, the success messages, every error from Supabase, the show/hide buttons and the saving state.

## Test file

`Testing/adminSettingsTest/testScrum250.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-250 tests

```bash
npx vitest run Testing/adminSettingsTest/testScrum250.jsx
```

You should see output like this:

```
✓ Testing/adminSettingsTest/testScrum250.jsx (25 tests)

Test Files  1 passed (1)
     Tests  25 passed (25)
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
| 1 | Page layout | The "Change User Settings" heading, all five fields, Save and Cancel show |
| 2 | Cancel | The Cancel link goes to `/portal` |
| 3 | Loads saved values | The saved email, phone number and address fill the form |
| 4 | Nothing saved yet | The phone number and address stay empty when there are no saved settings |
| 5 | Password fields | Both password fields start empty |
| 6 | Signed out | "You must be signed in to change your settings." shows |
| 7 | No changes | Save with nothing changed shows "Make a change before saving." and sends nothing |
| 8 | Email read-only | The email is read-only until it is clicked |
| 9 | Cancel email edit | The original email comes back and the field is read-only again |
| 10 | New email | The trimmed email goes to `updateUser` and "Email address updated successfully." shows |
| 11 | Confirmation pending | "A confirmation link was sent to <email>…" shows when the login email hasn't changed yet |
| 12 | Email error | Supabase's error message shows when the email can't be changed |
| 13 | Empty email | "Email is required." shows and nothing is sent |
| 14 | Invalid email | "Please enter a valid email address." shows and nothing is sent |
| 15 | New phone number | Digits only are saved (`(555) 987-6543` becomes `5559876543`) and "Phone number updated." and the "Account Updated!" popup show |
| 16 | Only the phone | Saving a phone number doesn't send the address or touch the login details |
| 17 | Bad phone number | A phone number without 10 digits shows "Enter a valid 10-digit US phone number." and isn't saved |
| 18 | Phone save error | Supabase's error shows, with no success message or popup |
| 19 | New address | The trimmed address is saved, "Address updated." shows, and the phone number isn't sent |
| 20 | Address save error | Supabase's error shows and no success message does |
| 21 | New password | The password goes to `updateUser` and "Password updated." shows |
| 22 | Passwords differ | "Passwords do not match." shows and nothing is sent |
| 23 | Password error | Supabase's error shows, with no success message |
| 24 | Show and hide | Each eye button changes only its own field, and its label switches between "Show password" and "Hide password" |
| 25 | While saving | The button reads "Saving..." and is disabled until the save finishes |

---

## How the mock works

`mockSupabase()` fakes everything the page talks to:

- `auth.getUser()` returns the signed-in admin (or nobody)
- `auth.updateUser()` is used for email and password changes. By default it succeeds and returns the old email, which is what Supabase does until a new email is confirmed
- `from('settings').select().eq().maybeSingle()` loads the saved phone number and address
- `from('settings').upsert()` saves the phone number or address

Each test can override any of them, for example `mockSupabase({ upsertResult: { error: { message: 'Could not save settings.' } } })` to make saving fail, or `mockSupabase({ user: null })` to sign the admin out.

`renderLoadedSettings()` waits for the saved values to load before the test starts. Until then the Save button reads "Saving..." and is disabled.

The "Account Updated!" popup redirects to the portal after 2 seconds. The tests check the popup text and don't wait for the redirect.

---

## Selenium tests

`Testing/selenium/test_settings_page.py` has 11 functional tests that drive the real site in Chrome. They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

### How to run

```bash
pip install -r Testing/selenium/requirements.txt   # once
npm run dev                                         # terminal 1
```

The signed-in tests need a real account and are skipped without one. In terminal 2:

```powershell
$env:TEST_CUSTOMER_EMAIL = 'you@example.com'; $env:TEST_CUSTOMER_PASSWORD = '...'
python -m pytest Testing/selenium/test_settings_page.py -v
```

To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Needs account? | Saves data? |
|---|---|---|---|---|
| 1 | Signed out | A visitor who isn't signed in is sent to the sign-in page | No | No |
| 2 | Page layout | The heading, all five fields, Save and a Cancel link to `/portal` show | Yes | No |
| 3 | Saved email | The email field shows the signed-in email | Yes | No |
| 4 | No changes | Save with nothing changed shows "Make a change before saving." | Yes | No |
| 5 | Email edit | The email is read-only until clicked, and "Cancel email edit" restores it | Yes | No |
| 6 | Empty email | "Email is required." shows | Yes | No |
| 7 | Invalid email | "Please enter a valid email address." shows | Yes | No |
| 8 | Bad phone | A phone number without 10 digits shows "Enter a valid 10-digit US phone number." | Yes | No |
| 9 | Passwords differ | "Passwords do not match." shows | Yes | No |
| 10 | Show and hide | Each eye button changes only its own password field | Yes | No |
| 11 | Cancel | The Cancel link goes to `/portal` | Yes | No |

### Why there are no save tests

The tests use the real Supabase project. Saving would change the account's real email, phone number, address or password. Every form test here either only looks at the page or fills in a bad value, so the page's own validation stops it before anything is sent. Successful saves, and the errors Supabase can return, are covered by the unit tests above, which fake Supabase.

The unit tests also cover the "You must be signed in" message. A real signed-out visitor never sees it, because the site sends them to the sign-in page first (test 1).
