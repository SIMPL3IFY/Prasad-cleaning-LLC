# Manage Quotes unit tests (SCRUM-230)

Tests the **Manage Quotes** box in `AdminDashboard.jsx` with Vitest and React Testing Library.
Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`, so no test touches the real database.

## What it checks

| Test |
|---|---|
| Shows each quote's name and phone, paging through quotes | 3 |
| Shows "No quotes available." when the query returns no rows | 4 |
| Shows an error message when the query fails | 5 |
| Decline with no reason, or only spaces, shows a message and saves nothing | 7 |
| Decline with a reason saves to `declined_quotes` and removes the quote | 8 |
| A failed decline insert keeps the quote | extra |
| Accept, then Cancel in the popup, saves nothing | extra |
| Accept, then Yes, saves to `accepted_quotes` and removes the quote | 9 |

## How to run

From the project root:

```
npx vitest run Testing/adminQuotesTest   # just this folder
npm run test:run                         # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.