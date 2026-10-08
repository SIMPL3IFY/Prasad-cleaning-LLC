-- SCRUM-184: Track the Calendly booking for each accepted appointment so a
-- later time change or cancellation can cancel the old booking.
alter table public.accepted_quotes
    add column if not exists calendly_event_uri text,
    add column if not exists calendar_synced_at timestamptz;
