# Gmail slanje iz dashboarda

Ovo daje 2 opcije u dashboardu:

- `Otvori email` ostaje kao fallback
- `Pošalji iz dashboarda` šalje direktno preko Gmail API-ja kroz Supabase Edge Function

## 1. Google Cloud

1. Otvori [Google Cloud Console](https://console.cloud.google.com/).
2. Kreiraj novi projekt ili koristi postojeći.
3. Uključi `Gmail API`.
4. Otvori `APIs & Services -> OAuth consent screen` i dovrši osnovni setup.
5. Otvori `APIs & Services -> Credentials`.
6. Kreiraj `OAuth client ID`.
7. Kao tip odaberi `Web application`.

Spremi:

- `Client ID`
- `Client secret`

## 2. Refresh token

Najjednostavnije:

1. Otvori [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Klikni zupčanik gore desno.
3. Uključi `Use your own OAuth credentials`.
4. Zalijepi svoj `Client ID` i `Client secret`.
5. U scope upiši:

`https://www.googleapis.com/auth/gmail.send`

6. Klikni `Authorize APIs`.
7. Prijavi se s Gmail računom s kojeg želiš slati.
8. Klikni `Exchange authorization code for tokens`.
9. Spremi `Refresh token`.

## 3. Supabase secrets

U Supabase projektu postavi ove secrets:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`
- `ALLOWED_ORIGINS`

Primjer `ALLOWED_ORIGINS`:

```text
https://ivanbalent1980-commits.github.io
```

Ako dashboard koristiš i lokalno kao `file:///...`, preglednik često šalje `Origin: null`, pa će funkcija to dopustiti dok `origin` nije postavljen.

## 4. Deploy function

U Supabase CLI:

```bash
supabase functions deploy send-gmail
```

Ako još nisi prijavljen:

```bash
supabase login
supabase link --project-ref xtvgkraqccsuonqhaeab
```

## 5. Test

U dashboardu:

1. Otvori poruku ili upit
2. Klikni `Odgovori`
3. Upiši odgovor
4. Klikni `Pošalji iz dashboarda`

Ako Gmail setup nije gotov, i dalje ostaje `Otvori email`.

## Napomena

Ovo nije puna sinkronizacija Gmail inboxa.

Trenutno znači samo:

- dashboard može slati kroz Gmail
- Gmail ostaje glavno mjesto za pregled poslanih mailova
- odgovor iz Gmaila natrag u dashboard se ne sinkronizira automatski
