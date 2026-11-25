-- Shared rate limit for the validate-address Edge Function.
-- The old in-memory counter reset whenever Supabase restarted the function or ran it in
-- more than one copy, so the 10-per-minute limit did not hold. Every copy now counts here.
-- Only the service role (used by the Edge Function) can touch this table or call the function.
begin;

create table if not exists public.edge_rate_limit_hits (
    id bigint generated always as identity primary key,
    bucket text not null,          -- e.g. 'validate-address:<sha256 of client IP>', never a raw IP
    hit_at timestamptz not null default now()
);

create index if not exists edge_rate_limit_hits_bucket_hit_at_idx
    on public.edge_rate_limit_hits (bucket, hit_at);

alter table public.edge_rate_limit_hits enable row level security;
-- No policies on purpose: anon and authenticated users get no access.
revoke all on table public.edge_rate_limit_hits from anon, authenticated;

-- Sliding window: returns true if this call is allowed (and records it), false if over the limit.
create or replace function public.edge_rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    recent integer;
begin
    -- Serialize calls for the same bucket so two parallel requests cannot both slip under the limit.
    perform pg_advisory_xact_lock(hashtext(p_bucket));

    delete from public.edge_rate_limit_hits
    where bucket = p_bucket
      and hit_at < now() - make_interval(secs => p_window_seconds);

    select count(*) into recent
    from public.edge_rate_limit_hits
    where bucket = p_bucket;

    if recent >= p_limit then
        return false;
    end if;

    insert into public.edge_rate_limit_hits (bucket) values (p_bucket);

    -- Occasional cleanup of buckets that went quiet, so the table stays small.
    if random() < 0.01 then
        delete from public.edge_rate_limit_hits where hit_at < now() - interval '1 hour';
    end if;

    return true;
end;
$$;

revoke execute on function public.edge_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.edge_rate_limit_hit(text, integer, integer) to service_role;

commit;
