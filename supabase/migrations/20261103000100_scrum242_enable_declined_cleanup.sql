-- SCRUM-242 phase 2: DESTRUCTIVE. Requires pg_cron enabled and phase 1 applied.
-- Enabling this deletes existing declined quotes older than one calendar month
-- on the next hourly run, and continues while the website is closed.
-- Get approval and review existing declined_quotes before applying this file.
begin;
select cron.schedule(
    'scrum-242-purge-declined-quotes',
    '0 * * * *',
    'select public.scrum242_purge_expired_declined_quotes();'
);
commit;
