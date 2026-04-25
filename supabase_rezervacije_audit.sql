-- Audit trail for reservation writes.
-- Run this once in Supabase SQL editor before relying on audit data.

create table if not exists public.rezervacije_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rezervacija_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  source text not null,
  actor_type text not null check (actor_type in ('public_guest', 'admin_user', 'system')),
  actor_email text,
  actor_id uuid,
  session_id text,
  duplicate_key text,
  page_url text,
  user_agent text,
  old_data jsonb,
  new_data jsonb,
  notes text
);

create index if not exists rezervacije_audit_rezervacija_id_idx
  on public.rezervacije_audit (rezervacija_id);

create index if not exists rezervacije_audit_created_at_idx
  on public.rezervacije_audit (created_at desc);

create index if not exists rezervacije_audit_duplicate_key_idx
  on public.rezervacije_audit (duplicate_key);

alter table public.rezervacije_audit enable row level security;

grant insert on table public.rezervacije_audit to anon;
grant insert, select on table public.rezervacije_audit to authenticated;

drop policy if exists "Public reservation audit insert" on public.rezervacije_audit;
create policy "Public reservation audit insert"
  on public.rezervacije_audit
  for insert
  to anon
  with check (actor_type = 'public_guest' and source like 'public_%');

drop policy if exists "Authenticated reservation audit insert" on public.rezervacije_audit;
create policy "Authenticated reservation audit insert"
  on public.rezervacije_audit
  for insert
  to authenticated
  with check (actor_type in ('admin_user', 'system'));

drop policy if exists "Authenticated reservation audit read" on public.rezervacije_audit;
create policy "Authenticated reservation audit read"
  on public.rezervacije_audit
  for select
  to authenticated
  using (true);
