# Declined Quotes unit tests (SCRUM-230)

Tests the **Declined Quotes** box in `AdminDashboard.jsx` with Vitest and React Testing Library.
Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`, so no test touches the real database.

## What it checks

| Test | 
|---|---|
| Shows each declined quote's name, phone and decline reason, paging through them | 6 |
| Shows "No declined quotes." when the table is empty | extra (same as AC 4) |
| Shows an error message when the query fails | extra (same as AC 5) |
| Move to Manage Quotes, then Cancel, saves nothing | extra (Scrum 183) |
| Move to Manage Quotes, then Yes, saves to `quotes` as pending and deletes from `declined_quotes` | extra (Scrum 183) |
| A failed insert keeps the declined quote and alerts the admin | extra (Scrum 183) |

`alert()` doesn't exist in the test browser, so the tests replace it with a fake (`vi.stubGlobal`) and check that it was called.

## How to run

From the project root:

```
npx vitest run Testing/adminDeclinedTest   # just this folder
npm run test:run                           # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.