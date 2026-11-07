# Dashboard search unit tests (SCRUM-230)

Tests the **Search Quotes By** bar in `AdminDashboard.jsx` with Vitest and React Testing Library.
Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`, so no test touches the real database.

## What it checks

| Test | 
|---|---|
| Search is hidden until opened, and Hide Search restores the list and clears the text | Scrum 218 |
| Name search ignores upper/lower case | Scrum 218 |
| One search filters Manage Quotes, Manage Appointments, Declined and Completed at once | Scrum 218 |
| Filters by city/address, service and property (one test each, using `it.each`) | Scrum 218 |
| Filters by appointment date with the date picker | Scrum 218 |
| Time search matches any time in the same hour (09:15 finds 09:00) | Scrum 219 |
| The ✕ button clears the search | Scrum 218 |
| Changing the category resets to page 1 | Scrum 218 |

Note: `matchesSearch()` has an AM/PM branch, but the time field is an `<input type="time">`,
which always sends 24-hour values like `14:00`. Admins can't reach that branch, so these tests
don't cover it. It will show as untested in the coverage report.

## How to run

From the project root:

```
npx vitest run Testing/adminSearchTest   # just this folder
npm run test:run                         # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.