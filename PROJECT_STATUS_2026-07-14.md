# Apartmani Balent - status projekta 14.07.2026.

## Trenutno stanje

- Produkcija: https://apartmanibalent.hr/
- Hosting: Netlify, projekt `vocal-scone-24cfc5`
- Baza i fotografije: Supabase
- Aktualni deploy je objavljen i provjeren.
- Javni banner radi i uređuje se iz dashboarda.
- Cjenik za 2026. ima 11 aktivnih razdoblja i uređuje se iz dashboarda.
- Javni kalkulator i cjenik čitaju cijene iz Supabasea, uz rezervne cijene ako veza nije dostupna.
- Pretraga podržava 5 gostiju za apartmane 1-3 uz pomoćni ležaj od 10 EUR/noć.
- Apartman 4 prima najviše 4 gosta.

## Završeno u dashboardu

- Statusi: upit, čeka akontaciju, potvrđeno, blokirano i otkazano.
- Kod statusa "čeka akontaciju" moguće je odabrati blokira li termin; zadano je uključeno.
- Provjera preklapanja rezervacija postoji u dashboardu i bazi.
- Djeca se vode odvojeno.
- Evidencija pomoćnog ležaja.
- Ispravljena osnovna financijska računica i prikaz dolazaka/odlazaka.
- Uređivanje i arhiviranje cjenovnih razdoblja.
- Kopiranje cjenika u sljedeću godinu.
- Uređivanje višejezičnog bannera, boja i vidljivosti bez Netlify deploya.
- Postojeće rezervacije zadržavaju spremljenu cijenu nakon promjene cjenika.
- Početni pregled "Danas" prikazuje dolaske, odlaske, otvorene upite, rezervacije koje čekaju akontaciju i preostalu naplatu za skore boravke.
- Dodane su brze akcije za novu rezervaciju i poruke.
- Dodan je kompletan JSON backup podataka iz dashboarda.
- Dodan je CSV izvoz rezervacija za Excel.
- Dashboard jasno upozorava kada nema internetske veze i promjene se ne mogu spremiti.
- Ispravljen je rezervni izračun cijene starih rezervacija tako da uvijek koristi njihov apartman.
- Ručni unos izvora Airbnb je onemogućen kako se rezervacije ne bi duplicirale nakon iCal sinkronizacije.
- Uvezene Airbnb rezervacije ostaju vidljive, ali im je izvor zaključan.

## Pokrenute Supabase migracije

- `supabase_dashboard_reliability_phase1.sql`
- `supabase_dashboard_cjenik_banner_phase2.sql`

## Zadnji backupi

- `backups/deploy-2026-07-14_181315-prije-cjenika-i-bannera.zip`
- `backups/deploy-2026-07-14_185733-prije-popravka-bannera.zip`
- `backups/deploy-2026-07-14_190423-prije-drugog-popravka-bannera.zip`
- `backups/deploy-2026-07-14_191338-prije-dashboard-danas.zip`
- `backups/deploy-2026-07-14_195400-prije-airbnb-zastite.zip`

## Provjere

- 18 HTML datoteka: 0 grešaka, 0 upozorenja.
- 15 javnih ruta na desktopu i mobitelu: 30 provjera, 0 grešaka.
- Provjeren banner, dinamički cjenik, pet gostiju i pomoćni ležaj.
- Uživo potvrđeno 11 cjenovnih razdoblja i 8 postavki bannera.
- Testiran pregled "Danas" s dolaskom, odlaskom, upitom, akontacijom i ostatkom za naplatu.
- Testirani JSON i CSV izvoz podataka.
- Brojevi A1-A4 ispod sažetka recenzija sada su vidljivi na tamnoj pozadini.

## Čeka sljedeći deploy

- Dashboard verzija `20260714-8` s pregledom "Danas", backupom, Excel izvozom i zaštitom od ručnog Airbnb unosa.
- CSS javne stranice `20260714-5` s vidljivim oznakama A1-A4 u sekciji recenzija.
- Za objavu prenijeti cijeli aktualni `deploy` folder na Netlify.

## Sljedeći prioriteti

1. Arhiva rezervacija umjesto običnog trajnog brisanja.
2. Dvosmjerni Airbnb iCal za sva četiri apartmana.
3. Predlošci poruka i izravno slanje e-pošte uz Gmail rezervnu opciju.
4. Vlasnici, pripadnost apartmana i različiti bankovni računi.
5. Rashodi: zajednički, Gaga, Ivan ili određeni apartman.
6. Mobilni PWA bez offline spremanja podataka.
7. Automatski tjedni backup i dodatna audit povijest.

## Pravilo nastavka

Prije svake nove iteracije napraviti ZIP backup aktualnog `deploy` foldera. Ne mijenjati stabilnu produkciju bez testiranja desktopa i mobitela.

## Dodatak - duple rezervacije

- Napravljen backup: `backups/deploy-2026-07-14_200440-prije-ispravka-duplikata.zip`.
- Dashboard je dignut na verziju `20260714-9`.
- Operativni prikazi sada privremeno broje isti apartman + isti termin samo jednom, dok se baza ne ocisti.
- Stari format `odrasli`/`djeca` vise se ne pribraja dvaput u broj gostiju.
- Spremanje rezervacije koristi novi format `broj_osoba`/`broj_djece` i cisti stara polja.
- Pripremljena SQL skripta, ali nije pokrenuta: `supabase_cleanup_duplicate_reservations_2026-07-14.sql`.
- Provjere: `node --check`, `tools/audit-site.py`, `dashboard-phase1-test`, `dashboard-phase2-test`, `dashboard-today-test`.

## Dodatak - Airbnb iCal

- Napravljen backup: `backups/deploy-2026-07-14_204519-prije-ical-airbnb.zip`.
- Dashboard je dignut na verziju `20260714-10`.
- Dodana kartica Postavke > Airbnb iCal za unos Airbnb export iCal linkova po apartmanu.
- Dodan gumb "Sinkroniziraj sada" koji poziva Supabase funkciju `sync-airbnb-ical`.
- Dodana SQL priprema: `supabase_airbnb_ical_phase1.sql`.
- Dodana Supabase Edge Function: `supabase/functions/sync-airbnb-ical/index.ts`.
- Funkcija uvozi buduce Airbnb zauzete termine kao `izvor = airbnb`, preskace termine koji se preklapaju s rucnim/agencijskim rezervacijama i otkazuje buduce iCal zapise koji vise nisu u Airbnb feedu.
- Prije stvarnog koristenja treba pokrenuti SQL u Supabaseu i deployati Edge Function.
- Provjere: `node --check`, `tools/audit-site.py`, `dashboard-phase1-test`, `dashboard-phase2-test`, `dashboard-today-test`, ciljani iCal UI test.

## Dodatak - sigurnost javnog weba 18.08.2026.

- Backup prije izmjena: `backups/before-security-phase_2026-08-18_172746/`.
- Uoceno je da je anonimni Supabase pristup mogao citati privatne tablice, ukljucujuci rezervacije.
- Napravljen je Edge Function `public-site-api` koji javnosti vraca samo broj apartmana, datume i status zauzetosti.
- Upiti i pitanja sada prolaze serversku provjeru, provjeru preklapanja termina i ogranicenje ucestalosti slanja.
- Uklonjen je aktivni oslonac na Web3Forms i njegov javno vidljiv kljuc.
- Objavljena je pripremna migracija `20260818173000_prepare_public_api.sql` i Edge Function.
- Lokalno provjereni desktop, mobilni prikaz i pretraga dostupnosti; JavaScript provjere prolaze.
- Automatizirane provjere: audit 18 HTML datoteka bez gresaka, 15 ruta na desktopu i mobitelu bez gresaka, dashboard faze 1 i 2, pregled Danas, UX putanja i javni API prolaze.
- Cijeli `deploy` folder objavljen je na Netlifyju 18.08.2026.
- Aktivirana je migracija `20260818174000_lock_down_public_data.sql`.
- Anonimni pristup privatnim tablicama je blokiran, a javni cjenik i servis dostupnosti ostali su dostupni.
- Nakon osvjezavanja verzije `booking-flow.js` live provjera za 01.09.-05.09.2026. prikazala je sva cetiri slobodna apartmana i ukupnu cijenu od 400 EUR za cetiri nocenja.
- Aktivacija i provjere zapisane su u `SECURITY_ACTIVATION_2026-08-18.md`.

## Dodatak - Google Business i kampanje 18.08.2026.

- Backup prije izmjena: `backups/deploy-before-marketing-2026-08-18_224836/`.
- Provjerom javnog kalendara potvrdeno je da sva cetiri apartmana trenutačno nemaju blokirane termine u rujnu 2026.
- Upiti s oznacenih promotivnih linkova sada uz rezervaciju ili poruku spremaju UTM izvor kampanje.
- Nova verzija Edge Function `public-site-api` objavljena je na Supabaseu.
- Pojedinacne stranice Apartmana 1-4 prebacene su sa starih izravnih poziva privatnim tablicama na sigurni javni servis.
- Pripremljeni su Google Business tekstovi, mjerljivi linkovi i fotografija u `marketing/` folderu.
- Politika privatnosti dopunjena je kratkim objasnjenjem oznake izvora kampanje.
- Provjere: audit 18 HTML datoteka bez gresaka, 15 ruta na desktopu i mobitelu bez gresaka, dashboard faze 1 i 2, pregled Danas, javni API i rujanski korisnicki tok na Apartmanu 1 prolaze.
- Za objavu promjena treba prenijeti cijeli aktualni `deploy` folder na Netlify.
- Google Business objava nije javno objavljena jer in-app preglednik nije prijavljen na Google racun.
