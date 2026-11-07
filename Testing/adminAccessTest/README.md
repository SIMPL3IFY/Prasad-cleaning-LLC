# Admin access and navigation unit tests (SCRUM-230)

Tests who can open `AdminDashboard.jsx` and what the header buttons do, with Vitest and React Testing Library.
Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`, so no test touches the real database.

## What it checks

| Test | 
|---|---|
| "Checking admin access..." shows until the admin check finishes | SCRUM-119 |
| An admin sees all six dashboard boxes | SCRUM-119 |
| A signed-out visitor is sent to `/signin` | SCRUM-119 |
| A signed-in non-admin is sent to `/signin`, after checking their own profile row | SCRUM-119 |
| The demo admin gets in without calling Supabase Auth | SCRUM-184 |
| Sign Out ends the session and goes to `/` | SCRUM 172 |
| A failed sign out keeps the admin on the dashboard | SCRUM 172 |
| The Home link goes to `/` | SCRUM 187 |
| Manage Services opens the Edit Services popup, and it closes again | SCRUM-204 |

The Edit Services popup (`ServicePhotosManager`) is replaced with a simple stand-in.
These tests only check that the dashboard opens and closes it, not what the popup does inside.

Admin Settings (password change) is out of scope for this ticket.

## How to run

From the project root:

```
npx vitest run Testing/adminAccessTest   # just this folder
npm run test:run                         # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.