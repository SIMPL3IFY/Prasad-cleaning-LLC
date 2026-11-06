# SCRUM-242: Permanent quote deletion and declined retention

Base: main at 9f9dd0db0974a656ca276a132e6c9e52f08cd683.
Branch: scrum-242-delete-quotes.

## Behavior

Delete Quote is available in Manage Quotes, Manage Appointments, Completed
Appointments, and Declined Quotes. The popup identifies the customer and asks
for explicit confirmation. Cancel does not write anything. While deleting,
repeat confirmation is blocked. Failure keeps the card and provides an error.
Success removes the row and adjusts pagination; stale appointment/quote reads
cannot restore the removed card.

The admin-checked RPC deletes the selected row from quotes, accepted_quotes,
or declined_quotes. No soft-delete marker or archive copy is created. Completed
and active appointments both live in accepted_quotes. The existing foreign keys
remove appointment_completions and set review invitation accepted_quote_id to
NULL; independent reviews/review invitations remain. Deletion does not send
cancellation email or cancel an external calendar event. Use the existing Cancel
Appointment action for cancellation notifications before permanently deleting,
if those notifications are needed.

The server cleanup deletes declined_quotes rows strictly older than one calendar
month based on declined_at, evaluated in UTC. Exactly-at-cutoff, newer, and NULL
timestamps remain. Pending/accepted/completed quotes are unaffected. Cleanup
runs hourly after enabling phase 2, even with the dashboard closed. The dashboard
refreshes declined quotes every 30 seconds and on focus/visibility return.

## Database files and deployment status

1. supabase/migrations/20261103000000_scrum242_quote_deletion.sql defines the two
   functions and their permissions. It neither deletes existing rows nor schedules
   cleanup. Only authenticated admins can use the manual-delete RPC. Background
   cleanup is executable by the server role and database scheduler, not browser roles.
2. supabase/migrations/20261103000100_scrum242_enable_declined_cleanup.sql schedules
   the purge at the top of every hour. It requires pg_cron to already be enabled.
   Existing expired declined quotes will be permanently deleted on its next run.

Both SQL files were manually applied through the Supabase SQL Editor with
approval on November 5, 2026. No existing table policies were modified.
The existing quote tables retain their broad "Allow all for now" policies; the
new RPC admin check does not prevent callers using those existing direct-table
permissions. Tightening existing permissions is outside this change.

Cron job 2 is active, named scrum-242-purge-declined-quotes, with schedule
0 * * * * and command select public.scrum242_purge_expired_declined_quotes();.
There were zero qualifying declined quotes before enabling it. An approved manual
call returned deleted_quote_count = 0. No scheduled execution was recorded at the
last history check; the first scheduled success remains to be confirmed.

Do not blindly run supabase db push: these definitions were applied manually and
may not be recorded in the CLI migration history. Coordinate any later deployment
with the existing database state and other pending migrations.

Read-only queries used for schema, relationship, policy, and retention review:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('quotes', 'accepted_quotes', 'declined_quotes', 'profiles')
order by table_name, ordinal_position;

select conrelid::regclass as child_table, confrelid::regclass as parent_table,
       conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and (conrelid in ('public.quotes'::regclass, 'public.accepted_quotes'::regclass,
                    'public.declined_quotes'::regclass)
       or confrelid in ('public.quotes'::regclass, 'public.accepted_quotes'::regclass,
                       'public.declined_quotes'::regclass));

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('quotes', 'accepted_quotes', 'declined_quotes', 'profiles');

select id, customer_name, declined_at
from public.declined_quotes
where declined_at < (((now() at time zone 'UTC') - interval '1 month') at time zone 'UTC')
order by declined_at;
```

Live schema inspection confirmed UUID quote IDs, declined_at as timestamptz,
and profiles.id/is_admin. Incoming quote foreign keys were:
- appointment_completions.accepted_quote_id -> accepted_quotes.id ON DELETE CASCADE.
- customer_reviews.accepted_quote_id -> accepted_quotes.id ON DELETE SET NULL.
These relationship definitions were inspected; their effects were not exercised
by deleting a live completed appointment.

## Verification

```powershell
npm.cmd ci
npm.cmd run test:run -- Testing/adminDeleteQuoteTest/testScrum242.jsx Testing/adminCompletedTest/testScrum215.jsx
npm.cmd run build
```

Results verified on November 5, 2026:

- Automated tests: 21 passed (11 SCRUM-242 tests and 10 SCRUM-215 regression tests).
- Production build: passed.
- These automated checks preceded the final button/badge layout adjustments.
- Manual pending quote deletion: confirmation named the approved test customer,
  Cancel retained the quote, confirmed deletion removed it, and refresh confirmed
  it stayed deleted.
- Delete Quote button centering and Completed badge alignment were reviewed.
- Both SQL files executed successfully; the active Cron configuration was read back.
- An approved manual purge returned 0. No live expired quotes existed to exercise
  actual expired-row deletion or the calendar-month boundary.

Automated tests mock Supabase and cover all four sections, cancel, denied/network
failures, duplicate confirmation, pagination, and refresh after cleanup. Live
manual deletion from active, completed, and declined sections has not been tested.
Live anonymous/non-admin RPC access, missing IDs, invalid table names, and cascade
behavior also remain untested. Engine, dependency audit, router, act(), and
bundle-size warnings did not block the tests/build; dependencies were not changed.

In an isolated test project, verify those remaining database cases and retention
rows before, at, and after the calendar-month cutoff, including NULL and month-end
timestamps. Use one transaction so now() is stable. Confirm other quote tables
survive. Check cron.job_run_details for the first successful scheduled run.

To disable future runs (a separate shared-database change requiring approval):
select cron.unschedule('scrum-242-purge-declined-quotes');
Disabling the schedule cannot restore records already deleted.
