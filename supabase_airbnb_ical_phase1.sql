-- Airbnb iCal sync - phase 1
-- Run once in Supabase SQL editor.

create table if not exists public.airbnb_ical_sources (
  id uuid primary key default gen_random_uuid(),
  apartman integer not null check (apartman between 1 and 4),
  naziv text not null default 'Airbnb',
  ical_url text not null,
  aktivan boolean not null default true,
  last_synced_at timestamptz,
  last_status text,
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartman)
);

alter table public.rezervacije
  add column if not exists external_source text,
  add column if not exists external_uid text,
  add column if not exists ical_source_id uuid references public.airbnb_ical_sources(id) on delete set null,
  add column if not exists synced_at timestamptz;

create unique index if not exists rezervacije_external_uid_idx
  on public.rezervacije (external_source, external_uid)
  where external_source is not null and external_uid is not null;

create index if not exists rezervacije_ical_source_id_idx
  on public.rezervacije (ical_source_id);

alter table public.airbnb_ical_sources enable row level security;

grant select, insert, update, delete on public.airbnb_ical_sources to authenticated;

drop policy if exists "Authenticated read airbnb ical sources" on public.airbnb_ical_sources;
create policy "Authenticated read airbnb ical sources"
  on public.airbnb_ical_sources
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert airbnb ical sources" on public.airbnb_ical_sources;
create policy "Authenticated insert airbnb ical sources"
  on public.airbnb_ical_sources
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update airbnb ical sources" on public.airbnb_ical_sources;
create policy "Authenticated update airbnb ical sources"
  on public.airbnb_ical_sources
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete airbnb ical sources" on public.airbnb_ical_sources;
create policy "Authenticated delete airbnb ical sources"
  on public.airbnb_ical_sources
  for delete
  to authenticated
  using (true);
