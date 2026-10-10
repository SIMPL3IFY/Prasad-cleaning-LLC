alter table public.accepted_quotes
    drop column if exists calendly_event_uri,
    drop column if exists calendar_synced_at;
