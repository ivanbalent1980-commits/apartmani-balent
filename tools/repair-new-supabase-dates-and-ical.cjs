const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');
const backupPath = path.resolve(
  __dirname,
  '..',
  'backups',
  'supabase-migration-2026-07-27',
  'public-data.json'
);

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const restoredAgencyIds = new Set([
  '1304fdf4-4ee2-4966-a323-b4629879102c',
  'b2da4c4e-226c-4183-843e-a84d1925fca0',
  '85129960-618e-4695-91af-fbf00530c9a9',
]);
const duplicateIds = new Set([
  '066be197-faf6-4c4c-b9b6-37b8b6856876',
  '71a6b306-bbe4-4efc-b751-b421224541a7',
  '5c3c97e2-0b9b-4829-bf87-10940e6ca525',
  '70944ba5-4518-4766-8a77-a76adb143c54',
]);
const invalidReservationId = '68f908b1-71d8-4598-8d72-6a15c5a38630';
const keptReservationUpdates = new Map([
  ['d2d20c43-c3c8-4409-a9b2-93ea1ab1488b', {
    broj_osoba: 2,
    broj_djece: 3,
    odrasli: null,
    djeca: null,
    akontacija: 252,
    pomocni_lezaj: true,
  }],
  ['86b0a16b-06c3-4cdc-a154-89962eca44a3', {
    broj_osoba: 3,
    broj_djece: 0,
    odrasli: null,
    djeca: null,
  }],
  ['a05cd23c-fe86-4947-90fb-2c1833b4496b', {
    broj_osoba: 4,
    broj_djece: 0,
    odrasli: null,
    djeca: null,
  }],
  ['2dc76a2c-d3af-4733-84ef-3620266bd124', {
    broj_osoba: 2,
    broj_djece: 3,
    odrasli: null,
    djeca: null,
    pomocni_lezaj: true,
  }],
]);

function originalLocalDate(value) {
  const text = String(value || '');
  if (!text.includes('T')) return text.slice(0, 10);
  const date = new Date(text);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function rest(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `REST ${response.status}`);
  }
  return data;
}

async function patchById(table, id, payload) {
  if (!apply) return;
  await rest(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function run() {
  const priceFixes = backup.cjenik.map((row) => ({
    id: row.id,
    datum_od: originalLocalDate(row.datum_od),
    datum_do: originalLocalDate(row.datum_do),
  })).sort((a, b) => b.datum_od.localeCompare(a.datum_od));

  const reservationFixes = backup.rezervacije
    .filter((row) =>
      !row.external_source &&
      !duplicateIds.has(row.id) &&
      row.id !== invalidReservationId
    )
    .map((row) => ({
      id: row.id,
      apartman: row.apartman,
      datum_dolaska: originalLocalDate(row.datum_dolaska),
      datum_odlaska: originalLocalDate(row.datum_odlaska),
    }))
    .sort((a, b) =>
      a.apartman - b.apartman ||
      b.datum_dolaska.localeCompare(a.datum_dolaska)
    );

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    priceDateFixes: priceFixes.length,
    reservationDateFixes: reservationFixes.length,
    agencyReservationsToRestore: [...restoredAgencyIds],
    duplicateReservationsToDelete: [...duplicateIds],
    invalidReservationToDelete: invalidReservationId,
    unavailableImportsToDelete: 'apartments 3 and 4',
  }, null, 2));

  for (const row of priceFixes) {
    await patchById('cjenik', row.id, {
      datum_od: row.datum_od,
      datum_do: row.datum_do,
    });
  }

  if (apply) {
    const deleted = await rest(
      'rezervacije?apartman=in.(3,4)&external_source=eq.airbnb_ical&ime=ilike.*Not%20available*',
      { method: 'DELETE' }
    );
    console.log(`Deleted unavailable imports: ${deleted.length}`);

    const deletedDuplicates = await rest(
      `rezervacije?id=in.(${[...duplicateIds].join(',')})`,
      { method: 'DELETE' }
    );
    console.log(`Deleted duplicate reservations: ${deletedDuplicates.length}`);

    const deletedInvalid = await rest(
      `rezervacije?id=eq.${invalidReservationId}`,
      { method: 'DELETE' }
    );
    console.log(`Deleted invalid reservation: ${deletedInvalid.length}`);
  }

  for (const row of reservationFixes) {
    const payload = {
      datum_dolaska: row.datum_dolaska,
      datum_odlaska: row.datum_odlaska,
    };
    if (restoredAgencyIds.has(row.id)) {
      payload.status = 'potvrdjeno';
      payload.komentar = null;
      payload.synced_at = null;
      payload.blokiraj_termin = true;
    }
    Object.assign(payload, keptReservationUpdates.get(row.id) || {});
    await patchById('rezervacije', row.id, payload);
  }

}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
