const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const baseUrl = 'http://127.0.0.1:8765';
const priceRows = [{
  id: '22222222-2222-2222-2222-222222222222', godina: 2026, naziv: 'Testna sezona',
  datum_od: '2026-06-01', datum_do: '2026-09-30', cijena: 222, apartman: null, aktivan: true
}];

(async () => {
  const python = 'C:\\Users\\Korisnik\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
  const server = spawn(python, ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {
    cwd: path.join(__dirname, '..', 'deploy'),
    stdio: 'ignore',
    windowsHide: true
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/rest/v1/cjenik**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(priceRows) }));
  await page.route('**/rest/v1/sadrzaj**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([
      { kljuc: 'baner_vidljiv', vrijednost: 'true' },
      { kljuc: 'baner_tekst_hr', vrijednost: 'Testna obavijest za goste' },
      { kljuc: 'baner_boja_pozadine', vrijednost: '#123456' },
      { kljuc: 'baner_boja_teksta', vrijednost: '#ffffff' }
    ])
  }));
  await page.route('**/functions/v1/public-site-api', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.action === 'availability') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, records: [] }) });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'unexpected_test_request' }) });
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      (() => {
        class Query {
          select(){ return this; } eq(){ return this; } or(){ return this; } order(){ return this; }
          then(resolve){ return Promise.resolve({ data: [], error: null }).then(resolve); }
        }
        const client = { from(){ return new Query(); } };
        window.supabase = { createClient(){ return client; } };
      })();
    `
  }));

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#balent-announcement');
  await page.waitForFunction(() => document.querySelector('#cjenik .price-table tbody')?.innerText.includes('222'));

  const initial = await page.evaluate(() => ({
    banner: document.getElementById('balent-announcement')?.innerText || '',
    background: getComputedStyle(document.getElementById('balent-announcement')).backgroundColor,
    bannerHeight: Math.round(document.getElementById('balent-announcement')?.getBoundingClientRect().height || 0),
    navTop: Math.round(document.querySelector('nav')?.getBoundingClientRect().top || 0),
    reviewLinkColor: getComputedStyle(document.querySelector('.review-source-links a')).color,
    publicPrice: document.querySelector('#cjenik .price-table tbody')?.innerText || '',
    directPrice: window.BalentPricing.stayPrice('2026-09-01', '2026-09-03', 1)
  }));

  await page.locator('#unified-checkin').evaluate(el => el._flatpickr.setDate('2026-09-01', true, 'Y-m-d'));
  await page.locator('#unified-checkout').evaluate(el => el._flatpickr.setDate('2026-09-03', true, 'Y-m-d'));
  await page.selectOption('#unified-guests', '5');
  await page.click('#unified-search');
  await page.waitForSelector('.unified-result-card');

  const search = await page.evaluate(() => ({
    cards: document.querySelectorAll('.unified-result-card').length,
    names: [...document.querySelectorAll('.unified-result-card h3')].map(el => el.textContent.trim()),
    prices: [...document.querySelectorAll('.unified-price strong')].map(el => el.textContent.trim()),
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));

  const failures = [];
  if (!initial.banner.includes('Testna obavijest')) failures.push('public banner did not render');
  if (initial.background !== 'rgb(18, 52, 86)') failures.push(`banner color mismatch: ${initial.background}`);
  if (initial.bannerHeight < 40 || Math.abs(initial.navTop - initial.bannerHeight) > 1) failures.push(`banner overlaps navigation: ${JSON.stringify({ bannerHeight: initial.bannerHeight, navTop: initial.navTop })}`);
  if (initial.reviewLinkColor === 'rgb(26, 38, 54)') failures.push('review apartment labels are invisible');
  if (!initial.publicPrice.includes('222')) failures.push('public price table was not refreshed');
  if (initial.directPrice !== 444) failures.push(`shared stay price mismatch: ${initial.directPrice}`);
  if (search.cards !== 3 || search.names.some(name => name.includes('4'))) failures.push(`five-guest availability mismatch: ${JSON.stringify(search.names)}`);
  if (search.prices.some(price => price !== '464 €')) failures.push(`extra-bed total mismatch: ${JSON.stringify(search.prices)}`);
  if (search.overflow > 2) failures.push(`mobile overflow: ${search.overflow}px`);
  if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);

  await browser.close();
  server.kill();
  if (failures.length) {
    console.error(`FAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log(`PASS: dashboard phase 2 (${JSON.stringify({ initial, search })})`);
})();
