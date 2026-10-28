-- SCRUM-215: New completion data is separate from the permissive accepted_quotes table.
-- Phase 1: Schema and admin actions only. Does not schedule or complete any jobs.
begin;

create table public.appointment_completions (
    accepted_quote_id uuid primary key references public.accepted_quotes(id) on delete cascade,
    completed_at timestamptz,
    completion_note text not null default '' check (length(completion_note) <= 4000),
    auto_completion_paused boolean not null default false
);

alter table public.appointment_completions enable row level security;
revoke all on table public.appointment_completions from public, anon, authenticated;
grant select on table public.appointment_completions to authenticated;
grant all on table public.appointment_completions to service_role;

-- Browser sessions may only READ completion data, and only if they are admins.
-- All browser writes go through the admin-checked RPC below.
create policy "Admins can read appointment completions"
    on public.appointment_completions for select to authenticated
    using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Keep the existing accepted appointment and its permissions intact. Rescheduling
-- clears completion and its pause flag while preserving any saved completion note.
create or replace function public.scrum215_reset_completion_on_reschedule()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
    if new.appointment_date is distinct from old.appointment_date
       or new.appointment_time is distinct from old.appointment_time then
        update public.appointment_completions
           set completed_at = null, auto_completion_paused = false
         where accepted_quote_id = new.id;
    end if;
    return new;
end;
$$;

create trigger scrum215_reschedule_completion
    after update of appointment_date, appointment_time on public.accepted_quotes
    for each row execute function public.scrum215_reset_completion_on_reschedule();

-- Only Cron/server roles can call this. Appointment row locks serialize it with
-- admin actions and rescheduling. SKIP LOCKED leaves in-progress edits for next run.
create or replace function public.scrum215_complete_due_appointments()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
    changed integer;
begin
    with due as (
        select aq.id
          from public.accepted_quotes aq
          left join public.appointment_completions ac on ac.accepted_quote_id = aq.id
         where aq.status = 'accepted'
           and aq.appointment_date is not null and aq.appointment_time is not null
           and (aq.appointment_date + aq.appointment_time) at time zone 'America/Los_Angeles' < now()
           and ac.completed_at is null
           and not coalesce(ac.auto_completion_paused, false)
         for update of aq skip locked
    )
    insert into public.appointment_completions as completion (accepted_quote_id, completed_at)
        select id, now() from due
    on conflict (accepted_quote_id) do update
        set completed_at = excluded.completed_at
        where completion.completed_at is null and not completion.auto_completion_paused;
    get diagnostics changed = row_count;
    return changed;
end;
$$;

create or replace function public.scrum215_update_completion(
    p_action text,
    p_appointment_id uuid default null,
    p_note text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    appointment public.accepted_quotes%rowtype;
    completion public.appointment_completions%rowtype;
begin
    if not exists (
        select 1 from public.profiles where id = auth.uid() and is_admin = true
    ) then
        raise exception 'Administrator access required.' using errcode = '42501';
    end if;
    if p_action not in ('complete', 'restore', 'note') or p_action is null then
        raise exception 'Unknown completion action.';
    end if;
    if p_note is not null and length(p_note) > 4000 then
        raise exception 'Completion notes must be 4000 characters or fewer.';
    end if;

    -- Always lock the accepted appointment first, using the same order as Cron.
    select * into appointment from public.accepted_quotes
     where id = p_appointment_id and status = 'accepted' for update;
    if not found then
        raise exception 'Appointment no longer exists or is not accepted.';
    end if;
    select * into completion from public.appointment_completions
     where accepted_quote_id = p_appointment_id for update;

    if p_action = 'complete' then
        if completion.completed_at is not null then
            raise exception 'This appointment is already completed. Refresh the dashboard.';
        end if;
        if appointment.appointment_date is null or appointment.appointment_time is null then
            raise exception 'Set an appointment date and time before completing.';
        end if;
        insert into public.appointment_completions (accepted_quote_id, completed_at, completion_note)
            values (p_appointment_id, now(), coalesce(p_note, completion.completion_note, ''))
        on conflict (accepted_quote_id) do update
            set completed_at = excluded.completed_at, completion_note = excluded.completion_note,
                auto_completion_paused = false;
    elsif p_action = 'restore' then
        if completion.completed_at is null then
            raise exception 'This appointment is already active. Refresh the dashboard.';
        end if;
        update public.appointment_completions
           set completed_at = null, auto_completion_paused = true
         where accepted_quote_id = p_appointment_id;
    else
        if completion.completed_at is null then
            raise exception 'This appointment is no longer completed. Refresh the dashboard.';
        end if;
        update public.appointment_completions
           set completion_note = coalesce(p_note, '')
         where accepted_quote_id = p_appointment_id;
    end if;
end;
$$;

-- No anonymous callers, no browser access to the background completion function.
revoke all on function public.scrum215_reset_completion_on_reschedule() from public, anon, authenticated;
revoke all on function public.scrum215_complete_due_appointments() from public, anon, authenticated;
revoke all on function public.scrum215_update_completion(text, uuid, text) from public, anon, authenticated;
grant execute on function public.scrum215_complete_due_appointments() to service_role;
grant execute on function public.scrum215_update_completion(text, uuid, text) to authenticated;

commit;
