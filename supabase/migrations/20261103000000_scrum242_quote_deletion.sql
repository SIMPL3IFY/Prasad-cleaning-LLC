-- SCRUM-242 phase 1: Definitions only. Does not delete rows or schedule cleanup.
-- Review and apply separately before testing the Delete Quote UI against Supabase.
begin;

create or replace function public.scrum242_delete_quote(p_table text, p_quote_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    deleted_count integer;
begin
    if not exists (
        select 1 from public.profiles where id = auth.uid() and is_admin = true
    ) then
        raise exception 'Administrator access required.' using errcode = '42501';
    end if;
    -- Fixed statements: callers cannot target arbitrary tables or delete without an ID.
    case p_table
        when 'quotes' then
            delete from public.quotes where id = p_quote_id;
        when 'accepted_quotes' then
            -- Existing foreign keys cascade completion notes and detach review invitations.
            delete from public.accepted_quotes where id = p_quote_id;
        when 'declined_quotes' then
            delete from public.declined_quotes where id = p_quote_id;
        else
            raise exception 'Unknown quote table.';
    end case;
    get diagnostics deleted_count = row_count;
    if deleted_count = 0 then
        raise exception 'Quote no longer exists. Refresh the dashboard.';
    end if;
end;
$$;

create or replace function public.scrum242_purge_expired_declined_quotes()
returns integer
language plpgsql security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
    deleted_count integer;
begin
    -- One calendar month since decline, strictly older than the cutoff.
    -- NULL timestamps remain for admin review; other quote tables are untouched.
    delete from public.declined_quotes
     where declined_at < now() - interval '1 month';
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

revoke all on function public.scrum242_delete_quote(text, uuid) from public, anon, authenticated;
grant execute on function public.scrum242_delete_quote(text, uuid) to authenticated;
revoke all on function public.scrum242_purge_expired_declined_quotes() from public, anon, authenticated;
grant execute on function public.scrum242_purge_expired_declined_quotes() to service_role;

commit;
