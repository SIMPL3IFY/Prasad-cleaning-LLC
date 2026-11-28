# SCRUM-230: Testing — Manage Appointments

## What this tests

Unit tests for the **Manage Appointments** box in the admin dashboard (`src/pages/AdminDashboard.jsx`): how appointments are shown, edited and cancelled, and when emails are sent.

Supabase, including the `sync-appointment` edge function, is faked with `Testing/adminTestUtils/supabaseMock.js`. These tests never touch the real database, never change a real appointment, and never send a real email.

Mark Completed is not covered here. It has its own tests in `Testing/adminCompletedTest` (SCRUM-215).

## Test file

`Testing/adminAppointmentsTest/testScrum230Appointments.jsx`

## How to run

No dev server or `.env` is needed. These tests also run in CI on every pull request.

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the Manage Appointments tests

```bash
npx vitest run Testing/adminAppointmentsTest
```

You should see output like this:

```
✓ Testing/adminAppointmentsTest/testScrum230.jsx (16 tests)

Test Files  1 passed (1)
     Tests  16 passed (16)
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
| 1 | Appointment details | The customer, contact and job details show (SCRUM-84 / SCRUM-88) |
| 2 | No appointments | The empty state shows and Update Appointment is disabled (SCRUM-87) |
| 3 | Load error | An error message shows when the appointments query fails (SCRUM-215) |
| 4 | Change page | Changing pages leaves edit mode (SCRUM-87) |
| 5 | No changes | Saving with nothing changed is blocked (SCRUM-142) |
| 6 | Required field | Blanking a required field is blocked (SCRUM-142) |
| 7 | Past date | Moving to a past date is blocked (SCRUM-184) |
| 8 | Only the change | Only the changed field is sent, and a success message shows (SCRUM-142) |
| 9 | Zero rows updated | An error shows when no rows were updated, which happens when RLS blocks the save (SCRUM-189) |
| 10 | Database error | The database error shows and the typed value is kept (SCRUM-189) |
| 11 | Date change email | A date change calls `sync-appointment` and "Emails sent." shows (SCRUM-184) |
| 12 | Email fails | A failed email shows an error, and Retry sync resends without saving again (SCRUM-184) |
| 13 | Cancel, no reason | Cancelling without a reason is blocked (SCRUM-150) |
| 14 | Keep Appointment | Keep Appointment closes the cancel prompt (SCRUM-150) |
| 15 | Cancel appointment | The appointment is archived to `declined_quotes`, the customer is emailed, and it is deleted from `accepted_quotes` (SCRUM-150 / SCRUM-184) |
| 16 | Cancel email fails | A failed email still cancels the appointment, but alerts the admin (SCRUM-184) |

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the Manage Appointments box talks to:

- The appointments query, to load the list (or fail)
- The update call, to save an edit (or return an error, or zero updated rows)
- The `sync-appointment` edge function, to send the emails (or fail)
- The inserts and deletes on `declined_quotes` and `accepted_quotes` used when cancelling

Each test can override any of them, for example to make the email fail or the update return a database error.