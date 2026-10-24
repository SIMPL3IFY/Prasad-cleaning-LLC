# SCRUM-237: Testing — Change Settings Page

## What this tests

Unit tests for the Settings page (`src/pages/Settings.jsx`).

Supabase is fully mocked so these tests never touch the real database.

## Test file

`Testing/settingsTest/testScrum237.jsx`

## How to run

```
npm run test:run
```

Look for `testScrum237.jsx` in the output to confirm your tests ran.

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
