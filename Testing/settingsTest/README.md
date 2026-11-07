# SCRUM-237: Testing — Change Settings Page

## What this tests

Unit tests for the Settings page (`src/pages/Settings.jsx`).

Supabase is fully mocked so these tests never touch the real database.

## Test file

`Testing/settingsTest/testScrum237.jsx`

## How to run

Follow these steps exactly to run the tests locally.

### Step 1 — Make sure you are in the project root

Open a terminal and navigate to the project folder:

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-237 tests

```bash
npx vitest run Testing/settingsTest/testScrum237.jsx
```

You should see output like this:

```
✓ Testing/settingsTest/testScrum237.jsx (6 tests)

Test Files  1 passed (1)
     Tests  6 passed (6)
```

### Step 4 — Run all tests together (optional)

```bash
npx vitest run
```

### Step 5 — View coverage report (optional)

```bash
npx vitest run --coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report.

---

## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Form loads and prefills | Email, phone, and address fields are populated with the user's saved data on page load |
| 2 | Valid phone saves | Entering a valid 10-digit phone and saving shows the "Account Updated!" popup |
| 3 | Invalid phone shows error | Entering fewer than 10 digits shows "Enter a valid 10-digit US phone number." |
| 4 | Valid address saves | Typing a new address and saving calls the Supabase upsert |
| 5 | Password mismatch shows error | Entering two different passwords shows "Passwords do not match." |
| 6 | Unauthenticated access | When no user is signed in, the page shows "You must be signed in to change your settings." |

---

## How the mock works

`supabase.auth.getUser` is mocked to return either a fake signed-in user or null (unauthenticated).

`supabase.from('settings')` is mocked to return saved phone and address data without hitting the database.

`DeleteAccount` component is mocked out since it is not part of these tests.
