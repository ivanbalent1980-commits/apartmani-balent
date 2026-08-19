const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      (() => {
        const reservations = [{
          id: '11111111-1111-1111-1111-111111111111', ime: 'Postojeci gost', apartman: 1,
          datum_dolaska: '2026-08-10', datum_odlaska: '2026-08-15', broj_osoba: 2,
          broj_djece: 1, status: 'potvrdjeno', blokiraj_termin: true, izvor: 'vlastiti'
        }];
        const rows = table => table === 'rezervacije' ? reservations : [];
        class Query {
          constructor(table) { this.table = table; }
          select(){ return this; } eq(){ return this; } neq(){ return this; } in(){ return this; }
          gte(){ return this; } lte(){ return this; } order(){ return this; } or(){ return this; }
          update(){ return this; } insert(){ return this; } delete(){ return this; } upsert(){ return this; }
          single(){ return Promise.resolve({ data: rows(this.table)[0] || null, error: null }); }
          then(resolve){ return Promise.resolve({ data: rows(this.table), error: null }).then(resolve); }
        }
        const client = {
          auth: {
            onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } }; },
            getSession(){ return Promise.resolve({ data: { session: { user: { id: 'admin-1', email: 'admin@example.com' } } } }); },
            signOut(){ return Promise.resolve({ error: null }); }
          },
          from(table){ return new Query(table); },
          channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
          storage: { from(){ return { createSignedUrl(){ return Promise.resolve({ data: { signedUrl: '#' }, error: null }); }, upload(){ return Promise.resolve({ data: {}, error: null }); } }; } },
          functions: { invoke(){ return Promise.resolve({ data: { ok: true }, error: null }); } }
        };
        window.supabase = { createClient(){ return client; } };
      })();
    `
  }));

  await page.goto(`${baseUrl}/dashboard.html?v=20260714-5`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page-kalendar.active');

  const assertions = await page.evaluate(async () => {
    const invalidDates = validateReservationDraft({
      ime: 'Gost', apartman: 1, dolazak: '2026-08-15', odlazak: '2026-08-15', brojOdraslih: 2, brojDjece: 0
    });
    const overCapacity = validateReservationDraft({
      ime: 'Gost', apartman: 4, dolazak: '2026-08-16', odlazak: '2026-08-20', brojOdraslih: 4, brojDjece: 1
    });
    const conflict = await findBlockingConflict({
      apartman: 1, datum_dolaska: '2026-08-12', datum_odlaska: '2026-08-18', status: 'potvrdjeno', blokiraj_termin: true
    });
    const nonBlockingInquiry = await findBlockingConflict({
      apartman: 1, datum_dolaska: '2026-08-12', datum_odlaska: '2026-08-18', status: 'upit', blokiraj_termin: false
    });
    openRezModal();
    document.getElementById('rStatus').value = 'ceka_akontaciju';
    syncDepositBlockUi();
    document.getElementById('rApt').value = '1';
    document.getElementById('rBrojOsoba').value = '4';
    document.getElementById('rBrojDjece').value = '1';
    syncExtraBedUi();
    const depositControlVisible = getComputedStyle(document.getElementById('rBlokirajTerminWrap')).display !== 'none';
    const extraBedVisible = getComputedStyle(document.getElementById('rPomocniLezajInfo')).display !== 'none';
    const airbnbOptionDisabled = document.querySelector('#rIzvor option[value="airbnb"]')?.disabled === true;
    openRezModal({
      id: 'airbnb-import-1', ime: 'Airbnb gost', apartman: 2, izvor: 'airbnb', status: 'potvrdjeno',
      datum_dolaska: '2026-08-20', datum_odlaska: '2026-08-24', broj_osoba: 2, broj_djece: 0
    });
    return {
      invalidDates,
      overCapacity,
      conflictName: conflict.conflict?.ime || '',
      inquiryConflict: Boolean(nonBlockingInquiry.conflict),
      depositControlVisible,
      extraBedVisible,
      waitingOption: Boolean(document.querySelector('#rStatus option[value="ceka_akontaciju"]')),
      airbnbOptionDisabled,
      importedAirbnbLocked: document.getElementById('rIzvor').disabled && document.getElementById('rIzvor').value === 'airbnb',
      currentGuests: document.getElementById('kTrenutno')?.textContent
    };
  });

  const failures = [];
  if (!assertions.invalidDates.includes('nakon')) failures.push('invalid date range was accepted');
  if (!assertions.overCapacity.includes('najviše 4')) failures.push('apartment 4 capacity was not enforced');
  if (assertions.conflictName !== 'Postojeci gost') failures.push('blocking overlap was not detected');
  if (assertions.inquiryConflict) failures.push('plain inquiry incorrectly blocked availability');
  if (!assertions.depositControlVisible) failures.push('deposit blocking control is hidden');
  if (!assertions.extraBedVisible) failures.push('extra bed notice is hidden for fifth guest');
  if (!assertions.waitingOption) failures.push('waiting-for-deposit status is missing');
  if (!assertions.airbnbOptionDisabled || !assertions.importedAirbnbLocked) failures.push('manual Airbnb source is not blocked');
  if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);

  await browser.close();
  if (failures.length) {
    console.error(`FAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log(`PASS: dashboard phase 1 (${JSON.stringify(assertions)})`);
})();
