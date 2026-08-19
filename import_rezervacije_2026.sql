-- Import rezervacija iz Book1.xlsx (Sheet1)
-- Preskoceni su redovi SLOBODNO, UKUPNO i otvoreni termin "23.8.-"
-- Izvori: AIR -> airbnb, VL -> vlastiti, AG -> estee
-- Status svih uvezenih rezervacija: potvrdjeno

insert into public.rezervacije (
  apartman,
  ime,
  datum_dolaska,
  datum_odlaska,
  broj_osoba,
  odrasli,
  djeca,
  izvor,
  status,
  akontacija,
  broj_racuna
) values
  (1, 'MARTIN ŠIŠKA', '2026-07-04', '2026-07-12', 4, 4, 0, 'airbnb', 'potvrdjeno', null, null),
  (1, 'JANA', '2026-07-12', '2026-07-18', 5, 2, 3, 'vlastiti', 'potvrdjeno', 252, null),
  (1, 'PETER MORLEY', '2026-07-18', '2026-08-01', 4, 2, 2, 'estee', 'potvrdjeno', null, null),
  (1, 'AG', '2026-08-10', '2026-08-20', 0, null, null, 'estee', 'potvrdjeno', null, null),
  (2, 'ALEX RUTKOWSKI', '2026-07-04', '2026-07-14', 3, 3, 0, 'vlastiti', 'potvrdjeno', null, null),
  (2, 'JAKUB JAMRICH', '2026-07-14', '2026-07-25', 3, 3, 0, 'vlastiti', 'potvrdjeno', 450, null),
  (2, 'MARIA PANOV', '2026-07-27', '2026-08-10', 5, 2, 3, 'estee', 'potvrdjeno', null, null),
  (2, 'STEFAN BOHM', '2026-08-16', '2026-08-23', 5, 2, 3, 'vlastiti', 'potvrdjeno', 315, null),
  (3, 'JANA', '2026-07-12', '2026-07-18', 6, 2, 4, 'vlastiti', 'potvrdjeno', 252, null),
  (3, 'AG', '2026-07-19', '2026-08-02', 0, null, null, 'estee', 'potvrdjeno', null, null),
  (4, 'JANA', '2026-07-12', '2026-07-18', 2, 2, 0, 'vlastiti', 'potvrdjeno', 234, null),
  (4, 'AG', '2026-07-18', '2026-07-25', 0, null, null, 'estee', 'potvrdjeno', null, null);
