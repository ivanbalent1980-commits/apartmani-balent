const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const base = 'http://127.0.0.1:8765';
const routes = [
  '/',
  '/apartman-1/', '/apartman-2/', '/apartman-3/', '/apartman-4/',
  '/apartmani-silo-krk/', '/apartmani-silo-blizu-plaze/', '/silo-otok-krk/',
  '/plaze-silo-krk/', '/restorani-silo-krk/', '/izleti-otok-krk/',
  '/obiteljski-odmor-krk/', '/apartments-silo-krk/',
  '/ferienwohnungen-silo-krk/', '/appartamenti-silo-krk/'
];

async function inspect(page, route, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() >= 400) throw new Error(`${route}: HTTP ${response && response.status()}`);
  await page.waitForTimeout(route === '/' || route.startsWith('/apartman-') ? 900 : 150);

  const result = await page.evaluate(() => ({
    title: document.title.trim(),
    h1: document.querySelectorAll('h1').length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    brokenLocalImages: [...document.images].filter(img => {
      if (!img.src.startsWith(location.origin)) return false;
      return img.complete && img.naturalWidth === 0;
    }).map(img => img.src),
    scrollY: window.scrollY,
    mojibake: document.body.innerText.includes('Ã')
  }));
  if (!result.title) throw new Error(`${route}: missing title`);
  if (result.h1 !== 1) throw new Error(`${route}: expected one H1, got ${result.h1}`);
  if (result.overflow > 2) throw new Error(`${route}: horizontal overflow ${result.overflow}px at ${viewport.width}px`);
  if (result.brokenLocalImages.length) throw new Error(`${route}: broken local images: ${result.brokenLocalImages.join(', ')}`);
  if (result.mojibake) throw new Error(`${route}: visible broken text encoding`);

  const aptMatch = route.match(/^\/apartman-([1-4])\/$/);
  if (aptMatch) {
    const apt = Number(aptMatch[1]);
    const focus = await page.evaluate((apt) => {
      const visible = (selector) => [...document.querySelectorAll(selector)].filter(el => getComputedStyle(el).display !== 'none');
      return {
        cards: visible('.apt-card').length,
        galleries: visible('.gal-panel').length,
        calendars: visible('#availMultiWrap .avail-card').length,
        calc: document.getElementById('calc-apt')?.value,
        detail: document.getElementById('detail-apt')?.value,
        modal: document.getElementById('m-apt')?.value,
        scrollY: window.scrollY,
        selectedCard: document.getElementById(`card${apt}-wrap`)?.closest('.apt-card')?.style.display !== 'none'
      };
    }, apt);
    if (focus.cards !== 1 || focus.galleries !== 1 || focus.calendars !== 1 || !focus.selectedCard) {
      throw new Error(`${route}: apartment focus failed ${JSON.stringify(focus)}`);
    }
    if ([focus.calc, focus.detail, focus.modal].some(value => value !== String(apt))) {
      throw new Error(`${route}: booking selectors do not preselect apartment ${apt}: ${JSON.stringify(focus)}`);
    }
    if (focus.scrollY > 100) throw new Error(`${route}: page auto-scrolled to ${focus.scrollY}px`);
    await page.evaluate(() => window.setLang && window.setLang('de'));
    await page.waitForTimeout(150);
    const localized = await page.locator('#apartmani .sec-title').innerText();
    if (!localized.includes(`Ferienwohnung ${apt}`)) throw new Error(`${route}: localized apartment title was lost`);
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  for (const route of routes) await inspect(page, route, { width: 1440, height: 1000 });
  for (const route of routes) await inspect(page, route, { width: 390, height: 844 });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(os.tmpdir(), 'balent-home-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(os.tmpdir(), 'balent-home-mobile.png'), fullPage: true });
  await page.goto(base + '/apartman-1/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(os.tmpdir(), 'balent-apartment-mobile.png'), fullPage: true });

  await browser.close();
  const uniqueErrors = [...new Set(pageErrors)].filter(message => !/Failed to fetch|Load failed|fetch/i.test(message));
  console.log(`PASS: ${routes.length} routes x desktop/mobile (${routes.length * 2} checks)`);
  console.log(`Unexpected page errors: ${uniqueErrors.length}`);
  uniqueErrors.slice(0, 10).forEach(message => console.log(`PAGE ERROR: ${message}`));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
