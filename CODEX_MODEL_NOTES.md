# Codex model notes

Datum: 2026-07-20

Za buduci rad na Apartmani Balent projektu:

- Zadani model/effort: koristiti `5.5` + `medium` za obicne dorade, male bugove, vodjenje kroz deploy, Supabase korake i tekstualne izmjene.
- Traziti bolji model ili veci effort kad radimo vecu arhitekturnu odluku, slozeniji dashboard workflow, integracije tipa iCal/sinkronizacija, SEO strategiju, ozbiljan UX/marketing pregled ili kad postoji rizik da jedna greska pokvari podatke/rezervacije.
- Traziti manji model ili nizi effort kad je zadatak jednostavan: kratko objasnjenje, provjera jednog gumba/teksta, copy-paste upute, jednostavan terminal korak, preimenovanje ili sitna CSS korekcija bez rizika.
- Na pocetku svake vece nove faze reci korisniku koji model i effort preporucujem za taj konkretan posao, ukljucujuci kad je dovoljno ostati na jeftinijem/slabijem izboru.
- Za produkcijske zahvate prvo napraviti backup zadnje lokalne verzije u `backups/`.
- Kod Supabase/terminal uputa za korisnika voditi korak po korak, bez dugih lista.
- Na Windows PowerShell koristiti `npm.cmd` i `npx.cmd`, jer su `npm`/`npx` blokirani execution policyjem.
- Za sigurnost baze, migracije, integracije rezervacija i vece arhitekturne promjene koristiti `Sol` uz `high` ili `extra high`.
- Za obican deploy, provjeru teksta, jednu CSS doradu ili vodjenje kroz sucelje smanjiti na jeftiniji model uz `low` ili `medium`.
- Na pocetku svake sljedece faze uvijek izricito reci korisniku preporuceni model i effort, ukljucujuci kada treba smanjiti postavku.
