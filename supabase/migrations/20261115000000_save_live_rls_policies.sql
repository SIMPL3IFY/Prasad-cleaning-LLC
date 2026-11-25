-- Security fix: record the live project's Row Level Security setup in the repo.
--
-- These rules were made in the Supabase dashboard, so until now no migration created them.
-- Exported from the live project on 2026-11-15 (pg_policies, information_schema grants).
-- Running this on the live project changes nothing: every statement matches what is there.
--
-- Needs the tables to exist already. quotes, accepted_quotes, declined_quotes, profiles,
-- settings and customer_reviews were also created in the dashboard and are not in any migration.
--
-- Not included: public.rls_auto_enable(), Supabase's own "auto-enable RLS on new tables"
-- event trigger, managed from the dashboard setting, not by us.
begin;

-- Creates each new user's profile row; is_admin always starts false.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    false
  );

  return new;
end;
$function$;

-- Same name as the live trigger, so this replaces it instead of adding a second one
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 1. RLS on every public table
alter table public.accepted_quotes enable row level security;
alter table public.appointment_completions enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.declined_quotes enable row level security;
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.services enable row level security;
alter table public.settings enable row level security;

-- 2. Table privileges: start from nothing, then grant exactly what the live project grants
revoke all on table public.accepted_quotes from anon, authenticated;
revoke all on table public.appointment_completions from anon, authenticated;
revoke all on table public.customer_reviews from anon, authenticated;
revoke all on table public.declined_quotes from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.quotes from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.settings from anon, authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.accepted_quotes to authenticated;
grant select on table public.appointment_completions to authenticated;
grant delete, insert, references, trigger, truncate, update on table public.customer_reviews to anon;
grant delete, insert, references, trigger, truncate, update on table public.customer_reviews to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.declined_quotes to authenticated;
grant select on table public.profiles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.quotes to authenticated;
grant insert on table public.quotes to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.services to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.services to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.settings to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.settings to authenticated;

-- Reviews: user_id is never readable through the API
grant select (approved, created_at, customer_name, id, rating, review) on table public.customer_reviews to anon;
grant select (approved, created_at, customer_name, id, rating, review) on table public.customer_reviews to authenticated;

-- 3. Policies
drop policy if exists "Admins manage accepted quotes" on public.accepted_quotes;
create policy "Admins manage accepted quotes" on public.accepted_quotes
  as permissive for all to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))))
  with check ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Admins can read appointment completions" on public.appointment_completions;
create policy "Admins can read appointment completions" on public.appointment_completions
  as permissive for select to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Admins can read all reviews" on public.customer_reviews;
create policy "Admins can read all reviews" on public.customer_reviews
  as permissive for select to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Admins can update reviews" on public.customer_reviews;
create policy "Admins can update reviews" on public.customer_reviews
  as permissive for update to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))))
  with check ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Anyone can read approved reviews" on public.customer_reviews;
create policy "Anyone can read approved reviews" on public.customer_reviews
  as permissive for select to anon, authenticated
  using ((approved = true));

drop policy if exists "Customers can submit their own review" on public.customer_reviews;
create policy "Customers can submit their own review" on public.customer_reviews
  as permissive for insert to authenticated
  with check (((user_id = auth.uid()) and (approved = false)));

drop policy if exists "Admins manage declined quotes" on public.declined_quotes;
create policy "Admins manage declined quotes" on public.declined_quotes
  as permissive for all to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))))
  with check ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
  as permissive for select to authenticated
  using ((( select auth.uid() as uid) = id));

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  as permissive for select to authenticated
  using ((auth.uid() = id));

drop policy if exists "Admins manage quotes" on public.quotes;
create policy "Admins manage quotes" on public.quotes
  as permissive for all to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))))
  with check ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Anyone can submit a pending quote" on public.quotes;
create policy "Anyone can submit a pending quote" on public.quotes
  as permissive for insert to anon, authenticated
  with check (((status = 'pending'::text) and (appointment_date is null) and (appointment_time is null)));

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services" on public.services
  as permissive for all to authenticated
  using ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))))
  with check ((exists ( select 1
   from profiles
  where ((profiles.id = auth.uid()) and (profiles.is_admin = true)))));

drop policy if exists "Services are viewable by everyone" on public.services;
create policy "Services are viewable by everyone" on public.services
  as permissive for select to public
  using (true);

drop policy if exists "Users can insert their own settings" on public.settings;
create policy "Users can insert their own settings" on public.settings
  as permissive for insert to public
  with check ((auth.uid() = user_id));

drop policy if exists "Users can update their own settings" on public.settings;
create policy "Users can update their own settings" on public.settings
  as permissive for update to public
  using ((auth.uid() = user_id));

drop policy if exists "Users can view their own settings" on public.settings;
create policy "Users can view their own settings" on public.settings
  as permissive for select to public
  using ((auth.uid() = user_id));

commit;
