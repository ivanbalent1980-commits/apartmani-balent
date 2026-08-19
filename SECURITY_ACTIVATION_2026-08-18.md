# Aktivacija sigurnog javnog pristupa

Datum: 2026-08-18

## Vec objavljeno na Supabaseu

- Edge Function `public-site-api`.
- Migracija `20260818173000_prepare_public_api.sql`.
- Javni servis vraca samo apartman, datume i status zauzetosti.
- Neispravni upiti i pozivi s nedozvoljenih domena se odbijaju.

## Aktivirano u produkciji

- `deploy/assets/js/public-site-api.js`
- izmjene u `deploy/index.html`
- izmjene u `deploy/assets/js/booking-flow.js`
- Netlify deploy objavljen 18.08.2026.
- Migracija `20260818174000_lock_down_public_data.sql` aktivirana.
- Anonimni REST pristup privatnim tablicama vraca 401.
- Javni cjenik i javni servis dostupnosti rade.
- Live provjera za 01.09.-05.09.2026. prikazala je sva cetiri slobodna apartmana i ispravnu cijenu od 400 EUR za cetiri nocenja.
