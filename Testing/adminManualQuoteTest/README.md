# SCRUM-241: Manually create quotes

Base: main at 9f9dd0db0974a656ca276a132e6c9e52f08cd683.
Branch: scrum-241-manual-quotes.

## Behavior

Manage Quotes now has a Create Quote button. An admin can enter the customer,
contact, property, service, and message directly without using the public form.
Date/time are optional, but must be supplied together. Times use the existing
Pacific appointment convention. The new row is pending and can be accepted or
declined with the existing controls. The dashboard refreshes after saving.

The form checks the current signed-in user and profiles.is_admin before inserting.
Existing database RLS policies still govern quotes inserts; no permissions, schema,
or database functions are changed by this branch. Demo-only access cannot save.
The database remains the source of authorization; the browser check is not a replacement for RLS.

## Files

- src/components/AdminQuoteForm.css: scoped form columns and aligned inputs.
- src/components/AdminQuoteForm.jsx: admin entry, validation, auth check, save/failure states.
- src/pages/AdminDashboard.jsx: button, popup, success feedback, quote refresh.
- Testing/adminManualQuoteTest/testScrum241.jsx: isolated form and dashboard tests.

## Verification

Run from this branch:

```powershell
npm.cmd ci
npm.cmd run test:run -- Testing/adminManualQuoteTest/testScrum241.jsx Testing/adminCompletedTest/testScrum215.jsx
npm.cmd run build
```

Results verified on November 5, 2026:

- Automated tests: 19 passed (9 SCRUM-241 tests and 10 SCRUM-215 regression tests).
- Production build: passed.
- These automated checks preceded the final spacing/alignment adjustments.
- Manual creation: an approved, clearly labeled test quote saved successfully,
  appeared in Manage Quotes, and remained after a browser refresh.
- The test quote was later permanently deleted while testing SCRUM-242.
- Final form layout and Create Quote button spacing were reviewed in the browser.

Automated tests mock Supabase; the separate approved manual save used the shared
Supabase project. No schema, function, or permission changes are needed for SCRUM-241.
Node engine, dependency audit, router, act(), and bundle-size warnings appeared;
the automated checks and build still completed successfully. Dependencies were not
changed as part of this scrum. Browser failures and non-admin paths are covered
by mocks, not by live account testing.

For future manual tests, Save Quote writes a real database row even when Vite runs
locally. Use a separate test project or obtain approval before shared data changes.
