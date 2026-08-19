const { chromium } = require('playwright');

const base = 'http://127.0.0.1:8765';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopContext.newPage();
  const errors = [];
  desktop.on('pageerror', error => errors.push(error.message));
  await desktop.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await desktop.waitForTimeout(900);

  const initial = await desktop.evaluate(() => ({
    language: document.documentElement.lang,
    heroTitle: document.querySelector('.hero-title')?.innerText.trim(),
    primaryCta: document.querySelector('.hero-btns .btn-primary')?.innerText.trim(),
    sections: document.querySelectorAll('section').length,
    scrollScreens: Math.round(document.documentElement.scrollHeight / innerHeight),
    directApartmentLinks: [...document.querySelectorAll('a[href]')].filter(a => /apartman-[1-4]\/$/.test(a.getAttribute('href') || '')).length,
    visibleDirectApartmentLinks: [...document.querySelectorAll('a[href]')].filter(a => /apartman-[1-4]\/$/.test(a.getAttribute('href') || '') && getComputedStyle(a).display !== 'none').length,
    firstViewportButtons: [...document.querySelectorAll('a,button')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden';
    }).length
  }));
  console.log('INITIAL', JSON.stringify(initial));
  check(initial.language === 'hr', 'Fresh visitor did not start in Croatian');
  check(initial.primaryCta?.toLowerCase().includes('pogledaj apartmane'), 'Primary action is unclear or missing');

  await desktop.locator('.hero-btns .btn-primary').click();
  await desktop.waitForTimeout(1200);
  check(await desktop.evaluate(() => Math.abs(document.getElementById('apartmani').getBoundingClientRect().top) < 300), 'Apartment CTA did not reach the apartment section');

  const oldCounter = await desktop.locator('#card1-counter').innerText();
  await desktop.locator('#card1-wrap .apt-nav button').nth(1).click();
  const newCounter = await desktop.locator('#card1-counter').innerText();
  check(oldCounter !== newCounter, 'Apartment photo arrows did not change the photo');

  await desktop.locator('#card1-wrap').click({ position: { x: 180, y: 120 } });
  check(await desktop.locator('#lb').evaluate(el => getComputedStyle(el).display !== 'none'), 'Photo did not open in the lightbox');
  await desktop.locator('.lb-x').click();

  await desktop.locator('.apt-card').nth(1).locator('.btn-sm').click();
  await desktop.waitForTimeout(250);
  check(await desktop.locator('#contactModal').evaluate(el => getComputedStyle(el).display !== 'none'), 'Apartment enquiry did not open');
  check(await desktop.locator('#m-apt').inputValue() === '2', 'Apartment 2 was not preselected in enquiry');
  await desktop.locator('#contactModal .modal-close').click();

  await desktop.locator('.lang-btn', { hasText: 'EN' }).click();
  await desktop.waitForTimeout(200);
  check((await desktop.locator('.hero-btns .btn-primary').innerText()).toLowerCase().includes('view apartments'), 'English switch did not update the main action');
  await desktop.locator('.lang-btn', { hasText: 'IT' }).click();
  await desktop.waitForTimeout(150);
  const italianBody = await desktop.locator('body').innerText();
  check(!italianBody.includes('avviser?'), 'Italian calendar message still contains broken text');

  const hello = await desktop.locator('.hello-krk-link').getAttribute('href');
  check(hello === 'https://app.hellokrk.com/', 'Hello KRK action points to the wrong location');

  const desktopTapTargets = await desktop.evaluate(() => [...document.querySelectorAll('button,a')].filter(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32);
  }).map(el => ({ text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })));

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(900);
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Homepage overflows horizontally on mobile');

  await mobile.locator('#hamburger').click();
  const menu = await mobile.evaluate(() => ({
    hamburgerActive: document.getElementById('hamburger').classList.contains('active'),
    menuActive: document.getElementById('navLinks').classList.contains('active'),
    menuVisible: getComputedStyle(document.getElementById('navLinks')).display !== 'none'
  }));
  check(menu.menuActive || menu.menuVisible, 'Mobile menu did not open');
  await mobile.locator('#navLinks a[href="#apartmani"]').click();
  await mobile.waitForTimeout(350);

  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.locator('.hero-btns .btn-outline').click();
  await mobile.waitForTimeout(200);
  const modalFit = await mobile.locator('#contactModal .modal-box').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, viewport: innerWidth, overflow: el.scrollHeight > el.clientHeight };
  });
  check(modalFit.left >= -1 && modalFit.right <= modalFit.viewport + 1, 'Booking modal does not fit mobile width');
  await mobile.locator('#contactModal .modal-close').click();

  await mobile.goto(base + '/apartman-1/', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(1700);
  const apartmentMobile = await mobile.evaluate(() => ({
    scrollY: window.scrollY,
    visibleCards: [...document.querySelectorAll('.apt-card')].filter(el => getComputedStyle(el).display !== 'none').length,
    visibleCalendars: [...document.querySelectorAll('#availMultiWrap .avail-card')].filter(el => getComputedStyle(el).display !== 'none').length,
    scrollScreens: Math.round(document.documentElement.scrollHeight / innerHeight),
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
  check(apartmentMobile.scrollY < 100, 'Apartment page auto-scrolled');
  check(apartmentMobile.visibleCards === 1 && apartmentMobile.visibleCalendars === 1, 'Apartment page mixes content from other apartments');
  check(apartmentMobile.overflow <= 2, 'Apartment page overflows horizontally');

  const mobileTapTargets = await mobile.evaluate(() => [...document.querySelectorAll('button,a')].filter(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40);
  }).map(el => ({ text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })).slice(0, 30));

  await browser.close();
  console.log(JSON.stringify({ initial, menu, modalFit, apartmentMobile, desktopSmallTargets: desktopTapTargets.slice(0, 20), mobileSmallTargets: mobileTapTargets, pageErrors: [...new Set(errors)] }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
