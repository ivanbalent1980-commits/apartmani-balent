-- Apartmani Balent: uređivi cjenik i javni banner
-- Pokrenuti jednom u Supabase SQL Editoru prije deploya ove verzije.

create extension if not exists pgcrypto;

create table if not exists public.cjenik (
  id uuid primary key default gen_random_uuid(),
  godina integer not null check (godina between 2020 and 2100),
  naziv text not null,
  datum_od date not null,
  datum_do date not null,
  cijena numeric(10,2) not null check (cijena > 0),
  apartman smallint null check (apartman between 1 and 4),
  aktivan boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cjenik_ispravan_raspon check (datum_do >= datum_od),
  constraint cjenik_godina_odgovara check (
    extract(year from datum_od)::integer = godina
    and extract(year from datum_do)::integer = godina
  )
);

create unique index if not exists cjenik_exact_range_unique
  on public.cjenik (godina, datum_od, datum_do, coalesce(apartman, 0));

create or replace function public.prevent_cjenik_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.aktivan then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('cjenik:' || new.godina::text || ':' || coalesce(new.apartman::text, 'svi'))
  );

  if exists (
    select 1
    from public.cjenik c
    where c.id <> new.id
      and c.aktivan
      and c.godina = new.godina
      and coalesce(c.apartman, 0) = coalesce(new.apartman, 0)
      and not (
        c.datum_od = new.datum_od
        and c.datum_do = new.datum_do
        and c.cijena = new.cijena
      )
      and daterange(c.datum_od, c.datum_do, '[]') && daterange(new.datum_od, new.datum_do, '[]')
  ) then
    raise exception 'Cjenovno razdoblje se preklapa s postojećim aktivnim razdobljem za isti apartman.'
      using errcode = '23P01';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cjenik_no_overlap on public.cjenik;
create trigger cjenik_no_overlap
before insert or update on public.cjenik
for each row execute function public.prevent_cjenik_overlap();

alter table public.cjenik enable row level security;

drop policy if exists "balent_public_read_active_cjenik" on public.cjenik;
create policy "balent_public_read_active_cjenik"
on public.cjenik for select
to anon
using (aktivan = true);

drop policy if exists "balent_authenticated_read_cjenik" on public.cjenik;
create policy "balent_authenticated_read_cjenik"
on public.cjenik for select
to authenticated
using (true);

drop policy if exists "balent_authenticated_write_cjenik" on public.cjenik;
create policy "balent_authenticated_write_cjenik"
on public.cjenik for all
to authenticated
using (true)
with check (true);

insert into public.cjenik (godina, naziv, datum_od, datum_do, cijena, apartman, aktivan)
values
  (2026, '01.06. - 10.06.', '2026-06-01', '2026-06-10', 70, null, true),
  (2026, '11.06. - 19.06.', '2026-06-11', '2026-06-19', 85, null, true),
  (2026, '20.06. - 30.06.', '2026-06-20', '2026-06-30', 95, null, true),
  (2026, '01.07. - 05.07.', '2026-07-01', '2026-07-05', 115, null, true),
  (2026, '06.07. - 12.07.', '2026-07-06', '2026-07-12', 119, null, true),
  (2026, '13.07. - 24.07.', '2026-07-13', '2026-07-24', 130, null, true),
  (2026, '25.07. - 15.08.', '2026-07-25', '2026-08-15', 150, null, true),
  (2026, '16.08. - 30.08.', '2026-08-16', '2026-08-30', 130, null, true),
  (2026, '31.08. - 06.09.', '2026-08-31', '2026-09-06', 100, null, true),
  (2026, '07.09. - 13.09.', '2026-09-07', '2026-09-13', 90, null, true),
  (2026, '14.09. - 30.09.', '2026-09-14', '2026-09-30', 85, null, true)
on conflict do nothing;

-- Tablica sadrzaj već postoji u projektu. Ove politike javnoj stranici daju
-- pristup samo vrijednostima bannera, dok prijavljeni korisnici mogu uređivati sadržaj.
alter table public.sadrzaj enable row level security;

drop policy if exists "balent_public_read_banner" on public.sadrzaj;
create policy "balent_public_read_banner"
on public.sadrzaj for select
to anon
using (kljuc like 'baner\_%' escape '\');

drop policy if exists "balent_authenticated_manage_content" on public.sadrzaj;
create policy "balent_authenticated_manage_content"
on public.sadrzaj for all
to authenticated
using (true)
with check (true);

select 'Cjenik i banner su spremni.' as rezultat;
