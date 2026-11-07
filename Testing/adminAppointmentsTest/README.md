# Manage Appointments unit tests (SCRUM-230)

Tests the **Manage Appointments** box in `AdminDashboard.jsx` with Vitest and React Testing Library.
Supabase, including the `sync-appointment` edge function, is faked with `Testing/adminTestUtils/supabaseMock.js`.
No test touches the real database or sends real emails.

Mark Completed is covered separately in `Testing/adminCompletedTest` (SCRUM-215).

## What it checks

| Area | Test |
|---|---|---|
| Display | Shows customer, contact and job details | Scrum 84 / 88 |
| Display | Empty state, with Update Appointment disabled | Scrum 87 |
| Display | Error message when the appointments query fails | SCRUM-215 |
| Display | Changing pages leaves edit mode | Scrum 87 |
| Edit | Saving with no changes is blocked | SCRUM-142 |
| Edit | Blanking a required field is blocked | SCRUM-142 |
| Edit | Moving to a past date is blocked | SCRUM-184 |
| Edit | Only the changed field is sent, and a success message appears | SCRUM-142 |
| Edit | Zero updated rows (RLS block) shows an error | SCRUM-189 |
| Edit | A database error is shown, and the typed value is kept | SCRUM-189 |
| Email | A date change calls `sync-appointment` and shows "Emails sent." | SCRUM-184 |
| Email | A failed email shows an error, and Retry sync resends without saving again | SCRUM-184 |
| Cancel | Cancelling without a reason is blocked | Scrum 150 |
| Cancel | Keep Appointment closes the prompt | Scrum 150 |
| Cancel | Archives to `declined_quotes`, emails, and deletes from `accepted_quotes` | Scrum 150 / SCRUM-184 |
| Cancel | A failed email still cancels, but alerts the admin | SCRUM-184 |

## How to run

From the project root:

```
npx vitest run Testing/adminAppointmentsTest   # just this folder
npm run test:run                               # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.