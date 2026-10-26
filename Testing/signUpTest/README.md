# SCRUM-228: Testing — Account Creation

## What this tests

Unit tests for the account creation page (`src/pages/SignUp.jsx`).

Supabase is mocked, so these tests do not connect to the real Supabase project, create real accounts, or send real confirmation emails.

## Test file

`Testing/signUpTest/testScrum228.jsx`

## How to run

Follow these steps to run the tests locally.

### Step 1 — Make sure you are in the project root

Open a terminal and navigate to the project folder, the directory containing `package.json`:

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-228 tests

```bash
npx vitest run Testing/signUpTest/testScrum228.jsx
```

Expected output includes:

```text
✓ Testing/signUpTest/testScrum228.jsx (10 tests)

Test Files  1 passed (1)
     Tests  10 passed (10)
```

### Step 4 — Run all unit tests together (optional)

```bash
npx vitest run
```

The project currently has 20 sign-in tests and 10 signup tests, for 30 total.

### Step 5 — View the coverage report (optional)

```bash
npx vitest run --coverage
```

After it finishes, open `coverage/index.html` in your browser to view the report.

---

## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Registration form renders | The signup heading and name, email, password, and confirmation fields are visible |
| 2 | Valid registration submits | The mocked Supabase method receives the expected email, password, full name, and email callback URL |
| 3 | Confirmation instructions display | A successful mocked signup shows the instruction to check and confirm the email address |
| 4 | Empty fields show errors | Required-field errors appear and Supabase is not called |
| 5 | Invalid email shows an error | The email validation message appears and Supabase is not called |
| 6 | Password length is validated | A password shorter than eight characters is rejected and Supabase is not called |
| 7 | Password special character is validated | A password without a special character is rejected and Supabase is not called |
| 8 | Password confirmation is validated | A mismatch displays an error and Supabase is not called |
| 9 | Registration failure is displayed | A mocked Supabase error appears on the signup page |
| 10 | Pending submission blocks repeats | The loading state appears, the submit button is disabled, and a second click does not make another request |

---

## Why this uses unit tests instead of Selenium

The project’s existing Selenium setup uses the real Supabase project. A browser test of registration in that setup could create a real account or send a real confirmation email. This Scrum requires the tests to avoid both, so the signup flow is tested with Vitest and a mocked Supabase client instead.