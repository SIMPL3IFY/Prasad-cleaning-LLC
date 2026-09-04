-- supabase/init.sql
-- Run this in Supabase SQL Editor to create a test `services` table and a permissive RLS policy for quick testing.
-- WARNING: The policy below allows public (anon) SELECT. Tighten policies before production.

create table if not exists public.services (
  id bigserial primary key,
  name text not null,
  description text,
  created_at timestamptz default now()
);

insert into public.services (name, description) values
('Residential Cleaning', 'Sample row for testing'),
('Commercial Cleaning', 'Sample row for testing'),
('Special Offers', 'Sample row for testing');

-- Enable Row Level Security (RLS)
alter table public.services enable row level security;

-- Allow anonymous users to SELECT for quick testing (replace with stricter policies later)
create policy "Allow select for anon" on public.services
  for select
  using (true);

-- Example: to allow authenticated users to insert their own rows, use:
-- create policy "Allow insert for authenticated" on public.services
--   for insert
--   with check (auth.role() = 'authenticated');
