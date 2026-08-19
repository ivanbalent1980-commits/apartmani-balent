const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const baseUrl = 'http://127.0.0.1:8765';

(async () => {
  const python = 'C:\\Users\\Korisnik\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
  const server = spawn(python, ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {
    cwd: path.join(__dirname, '..', 'deploy'), stdio: 'ignore', windowsHide: true
  });
  await new Promise(resolve => setTimeout(resolve, 800));

  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/rest/v1/cjenik**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      (() => {
        const isoOffset = days => {
          const date = new Date();
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() + days);
          return date.toISOString().slice(0, 10);
        };
        const reservations = [
          { id:'r1', ime:'Dolazak Danas', apartman:1, datum_dolaska:isoOffset(0), datum_odlaska:isoOffset(4), broj_osoba:2, broj_djece:1, status:'potvrdjeno', zarada_auto:500, akontacija:150 },
          { id:'r2', ime:'Odlazak Danas', apartman:2, datum_dolaska:isoOffset(-4), datum_odlaska:isoOffset(0), broj_osoba:2, broj_djece:0, status:'potvrdjeno', zarada_auto:400, akontacija:400 },
          { id:'r3', ime:'Čeka Uplatu', apartman:3, datum_dolaska:isoOffset(6), datum_odlaska:isoOffset(11), broj_osoba:2, broj_djece:2, status:'ceka_akontaciju', blokiraj_termin:true, zarada_auto:600 },
          { id:'r4', ime:'Novi Upit', apartman:4, datum_dolaska:isoOffset(10), datum_odlaska:isoOffset(14), broj_osoba:2, broj_djece:0, status:'upit', zarada_auto:500 }
        ];
        const payments = [{ rezervacija_id:'r1', iznos:150 }];
        const rows = table => table === 'rezervacije' ? reservations : table === 'uplate' ? payments : [];
        class Query {
          constructor(table){ this.table=table; }
          select(){ return this; } eq(){ return this; } neq(){ return this; } in(){ return this; }
          gte(){ return this; } lte(){ return this; } order(){ return this; } or(){ return this; }
          update(){ return this; } insert(){ return this; } delete(){ return this; } upsert(){ return this; }
          single(){ return Promise.resolve({data:rows(this.table)[0]||null,error:null}); }
          then(resolve){ return Promise.resolve({data:rows(this.table),error:null}).then(resolve); }
        }
        const client = {
          auth:{ onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}, getSession(){return Promise.resolve({data:{session:{user:{id:'admin-1',email:'admin@example.com'}}}})}, signOut(){return Promise.resolve({error:null})} },
          from(table){return new Query(table)}, channel(){return {on(){return this},subscribe(){return this}}},
          storage:{from(){return {createSignedUrl(){return Promise.resolve({data:{signedUrl:'#'},error:null})}}}}, functions:{invoke(){return Promise.resolve({data:{ok:true},error:null})}}
        };
        window.supabase={createClient(){return client}};
      })();
    `
  }));

  await page.goto(`${baseUrl}/dashboard.html?v=20260714-7`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.today-tile');
  const result = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.today-tile-label')].map(el => el.textContent.trim()),
    values: [...document.querySelectorAll('.today-tile-value')].map(el => el.textContent.trim()),
    text: document.getElementById('todaySummary')?.innerText || '',
    overflow: document.documentElement.scrollWidth - innerWidth,
    quickActions: document.querySelectorAll('.today-quick-actions button').length
  }));
  const exports = await page.evaluate(async () => {
    const files = [];
    window.downloadDashboardFile = (filename, content, mimeType) => files.push({ filename, content, mimeType });
    await exportReservationsCsv();
    await exportDashboardBackup();
    const csv = files.find(file => file.filename.endsWith('.csv'));
    const json = files.find(file => file.filename.endsWith('.json'));
    const parsed = json ? JSON.parse(json.content) : null;
    return {
      filenames: files.map(file => file.filename),
      csvHasGuest: Boolean(csv?.content.includes('Dolazak Danas')),
      backupReservationCount: parsed?.data?.rezervacije?.length,
      backupFormat: parsed?.format
    };
  });

  const failures = [];
  if (result.labels.length !== 5) failures.push(`expected 5 tiles, got ${result.labels.length}`);
  if (!result.text.includes('Dolazak Danas') || !result.text.includes('Odlazak Danas')) failures.push('today arrivals/departures missing');
  if (!result.text.includes('Čeka Uplatu') || !result.text.includes('Novi Upit')) failures.push('pending actions missing');
  if (!result.text.includes('350,00 €')) failures.push(`outstanding balance mismatch: ${result.text}`);
  if (result.quickActions !== 2) failures.push('quick actions missing');
  if (!exports.csvHasGuest || exports.backupReservationCount !== 4 || exports.backupFormat !== 'apartmani-balent-dashboard-backup') failures.push(`exports failed: ${JSON.stringify(exports)}`);
  if (result.overflow > 2) failures.push(`mobile overflow ${result.overflow}px`);
  if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);

  await browser.close();
  server.kill();
  if (failures.length) { console.error(`FAIL: ${failures.join('; ')}`); process.exit(1); }
  console.log(`PASS: dashboard today (${JSON.stringify({ result, exports })})`);
})();
