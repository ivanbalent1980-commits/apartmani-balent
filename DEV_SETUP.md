# Apartmani Balent - razvojno okruzenje

Ova biljeska sluzi za ponovno postavljanje racunala i ne utjece na web-stranicu.

## Instalirano 19.08.2026.

- Node.js 26.5.0 i npm 11.17.0
- Git for Windows (MinGit) 2.55.0.4
- GitHub CLI 2.97.0
- Docker Desktop 4.87.0, instaliran samo za trenutnog Windows korisnika
- Playwright 1.62.1 i Chromium za automatske testove stranice i dashboarda
- Supabase CLI koristi se kroz `npx.cmd supabase`

## Docker i WSL

Docker Desktop i WSL 2 ukljuceni su i provjereni 19.08.2026. Docker engine radi s Linux spremnicima.
Ako se racunalo ponovno postavlja, WSL se ukljucuje jednokratnom Windows promjenom koja zahtijeva administratorsku potvrdu i ponovno pokretanje racunala.

1. Otvori PowerShell kao administrator.
2. Pokreni:

```powershell
wsl --install --no-distribution
```

3. Ponovno pokreni racunalo.
4. Pokreni Docker Desktop iz Start izbornika.
5. Provjeri:

```powershell
wsl --version
docker version
docker compose version
```

## Prijave

Supabase CLI je povezan s projektom. GitHub repozitorij je postavljen kao `origin`,
a GitHub CLI je prijavljen kao `ivanbalent1980-commits`. Nakon nove instalacije racunala po potrebi trazi novu prijavu:

```powershell
gh auth login
```

## Sigurnosne kopije

Prije svake izmjene aplikacije kopirati trenutni `deploy` u mapu `backups`.
Ta mapa je namjerno izostavljena iz Gita jer je lokalno velika.

Nakon sto Docker i WSL rade, potpuna kopija podataka iz povezane Supabase baze moze se napraviti ovako:

```powershell
npx.cmd supabase db dump --linked --data-only --file "backups\supabase-data-backup.sql"
```

Kopija strukture baze:

```powershell
npx.cmd supabase db dump --linked --file "backups\supabase-schema-backup.sql"
```

## Provjera aplikacije

Svi automatizirani testovi, ukljucujuci privremeni lokalni web-server, pokrecu se jednom naredbom:

```powershell
npm.cmd test
```

## Sto nam zasad ne treba

- Netlify CLI: rucni deploy trenutno je dovoljan i lakse kontrolira potrosnju kredita.
- Dodatni framework ili paketni sustav: javna stranica je staticka i postojece rjesenje radi.
- Globalna instalacija Supabase CLI-ja: `npx.cmd` je dovoljan i vec radi.
