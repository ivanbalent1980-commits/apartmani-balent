-- Sigurno ciscenje duplih rezervacija pronadjenih 14.07.2026.
-- Pokrenuti u Supabase SQL editoru tek nakon provjere popisa ispod.
--
-- Ostaju:
-- - d2d20c43-c3c8-4409-a9b2-93ea1ab1488b  JANA KORNHAUSEROVA, Apt 1, 12.07.-18.07.
-- - 86b0a16b-06c3-4cdc-a154-89962eca44a3  ALEX RUTKOVSKI, Apt 2, 04.07.-14.07.
-- - a05cd23c-fe86-4947-90fb-2c1833b4496b  PETRA JAKAB, Apt 2, 24.06.-30.06.
-- - 2dc76a2c-d3af-4733-84ef-3620266bd124  MARIJA PANOV, Apt 2, 27.07.-10.08.
--
-- Micu se u backup tablicu pa brisu:
-- - 066be197-faf6-4c4c-b9b6-37b8b6856876  JANA, stari duplikat
-- - 71a6b306-bbe4-4efc-b751-b421224541a7  ALEX RUTKOWSKI, stari duplikat
-- - 5c3c97e2-0b9b-4829-bf87-10940e6ca525  ag, dupli termin s PETRA JAKAB
-- - 70944ba5-4518-4766-8a77-a76adb143c54  MARIA PANOV, stari duplikat

begin;

create table if not exists public.rezervacije_duplicate_backup (
  backup_id uuid primary key default gen_random_uuid(),
  backed_up_at timestamptz not null default now(),
  reason text not null,
  original_id uuid not null,
  row_data jsonb not null
);

with to_backup as (
  select *
  from public.rezervacije
  where id in (
    '066be197-faf6-4c4c-b9b6-37b8b6856876',
    '71a6b306-bbe4-4efc-b751-b421224541a7',
    '5c3c97e2-0b9b-4829-bf87-10940e6ca525',
    '70944ba5-4518-4766-8a77-a76adb143c54'
  )
)
insert into public.rezervacije_duplicate_backup (reason, original_id, row_data)
select
  'cleanup_duplicate_reservations_2026-07-14',
  id,
  to_jsonb(to_backup)
from to_backup
where not exists (
  select 1
  from public.rezervacije_duplicate_backup b
  where b.original_id = to_backup.id
    and b.reason = 'cleanup_duplicate_reservations_2026-07-14'
);

-- Prebaci korisne stare podatke u zapise koji ostaju.
update public.rezervacije
set
  broj_osoba = 2,
  broj_djece = 3,
  odrasli = null,
  djeca = null,
  akontacija = coalesce(akontacija, 252),
  pomocni_lezaj = true,
  updated_at = now()
where id = 'd2d20c43-c3c8-4409-a9b2-93ea1ab1488b';

update public.rezervacije
set
  broj_osoba = 3,
  broj_djece = 0,
  odrasli = null,
  djeca = null,
  updated_at = now()
where id = '86b0a16b-06c3-4cdc-a154-89962eca44a3';

update public.rezervacije
set
  broj_osoba = 4,
  broj_djece = 0,
  odrasli = null,
  djeca = null,
  updated_at = now()
where id = 'a05cd23c-fe86-4947-90fb-2c1833b4496b';

update public.rezervacije
set
  broj_osoba = 2,
  broj_djece = 3,
  odrasli = null,
  djeca = null,
  pomocni_lezaj = true,
  updated_at = now()
where id = '2dc76a2c-d3af-4733-84ef-3620266bd124';

delete from public.rezervacije
where id in (
  '066be197-faf6-4c4c-b9b6-37b8b6856876',
  '71a6b306-bbe4-4efc-b751-b421224541a7',
  '5c3c97e2-0b9b-4829-bf87-10940e6ca525',
  '70944ba5-4518-4766-8a77-a76adb143c54'
);

commit;

-- Kontrola nakon pokretanja: ovo treba vratiti 0 redova.
select apartman, datum_dolaska, datum_odlaska, count(*) as broj_zapisa
from public.rezervacije
where status in ('potvrdjeno', 'blokirano', 'ceka_akontaciju')
group by apartman, datum_dolaska, datum_odlaska
having count(*) > 1;
