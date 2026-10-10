-- SCRUM-204: Admin-managed service images

-- 1. Table holding each service card's name and the path to its photo
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  image_path  text not null,
  sort_order  int not null default 0,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keeps updated_at current whenever a row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- 2. Row Level Security: anyone can read, only admins can change rows
alter table public.services enable row level security;

drop policy if exists "Services are viewable by everyone" on public.services;
create policy "Services are viewable by everyone"
  on public.services for select
  using (true);

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services"
  on public.services for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 3. Public storage bucket for the photos (5 MB limit, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 4. Storage policies: photos are served through public URLs, so only admins
--    need to list files (deleting a file also requires select permission)
drop policy if exists "Service images are publicly viewable" on storage.objects;
drop policy if exists "Admins can list service images" on storage.objects;
create policy "Admins can list service images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'service-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can upload service images" on storage.objects;
create policy "Admins can upload service images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'service-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can update service images" on storage.objects;
create policy "Admins can update service images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'service-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can delete service images" on storage.objects;
create policy "Admins can delete service images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'service-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
