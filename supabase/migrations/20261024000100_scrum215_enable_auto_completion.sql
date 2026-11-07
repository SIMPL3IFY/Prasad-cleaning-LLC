-- SCRUM-215 phase 2: Enable Supabase Cron (pg_cron) in the dashboard FIRST.
-- Run only after the schema and manual actions have been checked.
-- This starts automatic completion, including existing past accepted appointments.
begin;
select cron.schedule(
    'scrum-215-complete-appointments',
    '* * * * *',
    'select public.scrum215_complete_due_appointments();'
);
commit;
