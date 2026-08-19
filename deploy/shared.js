window.BALENT_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://dbgsdwmmomgnjhoywgjr.supabase.co',
  SUPABASE_KEY: 'sb_publishable_uioC9IaDgyWB4xQNIPPwdg_d5tLFvxJ'
});

window.BalentShared = Object.freeze({
  toIsoDateLocal,
  normalizeDateInputToIso,
  parseDateInput,
  formatDisplayDate,
  compareDateRangesOverlap,
  dateRangeNights,
  parseMoneyInputValue,
  formatMoneyInputValue,
  bindMoneyInput
});

const BALENT_DEFAULT_PRICE_RULES = Object.freeze([
  { godina: 2026, naziv: '01.06. - 10.06.', datum_od: '2026-06-01', datum_do: '2026-06-10', cijena: 70, apartman: null, aktivan: true },
  { godina: 2026, naziv: '11.06. - 19.06.', datum_od: '2026-06-11', datum_do: '2026-06-19', cijena: 85, apartman: null, aktivan: true },
  { godina: 2026, naziv: '20.06. - 30.06.', datum_od: '2026-06-20', datum_do: '2026-06-30', cijena: 95, apartman: null, aktivan: true },
  { godina: 2026, naziv: '01.07. - 05.07.', datum_od: '2026-07-01', datum_do: '2026-07-05', cijena: 115, apartman: null, aktivan: true },
  { godina: 2026, naziv: '06.07. - 12.07.', datum_od: '2026-07-06', datum_do: '2026-07-12', cijena: 119, apartman: null, aktivan: true },
  { godina: 2026, naziv: '13.07. - 24.07.', datum_od: '2026-07-13', datum_do: '2026-07-24', cijena: 130, apartman: null, aktivan: true },
  { godina: 2026, naziv: '25.07. - 15.08.', datum_od: '2026-07-25', datum_do: '2026-08-15', cijena: 150, apartman: null, aktivan: true },
  { godina: 2026, naziv: '16.08. - 30.08.', datum_od: '2026-08-16', datum_do: '2026-08-30', cijena: 130, apartman: null, aktivan: true },
  { godina: 2026, naziv: '31.08. - 06.09.', datum_od: '2026-08-31', datum_do: '2026-09-06', cijena: 100, apartman: null, aktivan: true },
  { godina: 2026, naziv: '07.09. - 13.09.', datum_od: '2026-09-07', datum_do: '2026-09-13', cijena: 90, apartman: null, aktivan: true },
  { godina: 2026, naziv: '14.09. - 30.09.', datum_od: '2026-09-14', datum_do: '2026-09-30', cijena: 85, apartman: null, aktivan: true }
]);

window.BalentPricing = (() => {
  let rules = [...BALENT_DEFAULT_PRICE_RULES];
  let loaded = false;
  let loadPromise = null;

  const normalizeRule = rule => ({
    ...rule,
    godina: Number(rule.godina),
    cijena: Number(rule.cijena),
    apartman: rule.apartman == null ? null : Number(rule.apartman),
    aktivan: rule.aktivan !== false
  });

  function setRules(nextRules) {
    const normalized = (nextRules || []).map(normalizeRule).filter(rule => rule.aktivan && rule.datum_od && rule.datum_do && Number.isFinite(rule.cijena));
    if (normalized.length) rules = normalized;
    loaded = true;
    refreshPublicPriceDisplay();
    window.dispatchEvent(new CustomEvent('balent:prices-updated', { detail: { rules: getRules() } }));
  }

  async function load(force = false) {
    if (loaded && !force) return getRules();
    if (loadPromise && !force) return loadPromise;
    const config = window.BALENT_CONFIG;
    if (!config?.SUPABASE_URL || !config?.SUPABASE_KEY) return getRules();
    loadPromise = fetch(`${config.SUPABASE_URL}/rest/v1/cjenik?select=id,godina,naziv,datum_od,datum_do,cijena,apartman,aktivan&aktivan=eq.true&order=datum_od.asc`, {
      headers: { apikey: config.SUPABASE_KEY, Authorization: `Bearer ${config.SUPABASE_KEY}` }
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Cjenik HTTP ${response.status}`)))
      .then(data => setRules(data))
      .catch(error => {
        console.warn('Cjenik nije dostupan; koriste se rezervne cijene.', error);
        loaded = true;
        refreshPublicPriceDisplay();
      })
      .finally(() => { loadPromise = null; });
    await loadPromise;
    return getRules();
  }

  function getRules() {
    return rules.map(rule => ({ ...rule }));
  }

  function toIso(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return toIsoDateLocal(value instanceof Date ? value : new Date(value));
  }

  function ruleForDate(value, apartment = null) {
    const date = toIso(value);
    if (!date) return null;
    const apt = Number(apartment) || null;
    const matching = rules.filter(rule => rule.aktivan !== false && rule.datum_od <= date && rule.datum_do >= date);
    return matching.find(rule => apt && Number(rule.apartman) === apt) || matching.find(rule => rule.apartman == null) || null;
  }

  function nightlyPrice(value, apartment = null) {
    return ruleForDate(value, apartment)?.cijena ?? null;
  }

  function stayPrice(dateIn, dateOut, apartment = null) {
    const start = parseDateInput(dateIn);
    const end = parseDateInput(dateOut);
    if (!start || !end || end <= start) return null;
    let total = 0;
    for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
      const price = nightlyPrice(cursor, apartment);
      if (!Number.isFinite(price)) return null;
      total += price;
    }
    return total;
  }

  function publicYear() {
    const years = [...new Set(rules.filter(rule => rule.apartman == null).map(rule => Number(rule.godina)))].sort((a, b) => a - b);
    const current = new Date().getFullYear();
    return years.includes(current) ? current : years.at(-1);
  }

  function refreshPublicPriceDisplay() {
    if (document.body?.classList.contains('dashboard-body') || /dashboard|admin-login/.test(location.pathname)) return;
    const year = publicYear();
    const common = rules.filter(rule => Number(rule.godina) === year && rule.apartman == null).sort((a, b) => a.datum_od.localeCompare(b.datum_od));
    if (!common.length) return;
    const tbody = document.querySelector('#cjenik .price-table tbody');
    if (tbody) {
      const maxPrice = Math.max(...common.map(rule => Number(rule.cijena)));
      tbody.innerHTML = common.map(rule => {
        const from = formatDisplayDate(rule.datum_od).replace(/\.$/, '');
        const to = formatDisplayDate(rule.datum_do);
        const highlight = Number(rule.cijena) === maxPrice ? ' class="highlight"' : '';
        return `<tr${highlight}><td>${from} - ${to}</td><td style="text-align:right;font-family:var(--serif);font-size:1.05rem;color:${highlight ? 'var(--accent)' : 'var(--navy)'}">${Number(rule.cijena).toLocaleString('hr-HR')} €</td></tr>`;
      }).join('');
    }
    const minimum = Math.min(...common.map(rule => Number(rule.cijena)));
    document.querySelectorAll('.apt-from-price strong').forEach(element => { element.textContent = `${minimum.toLocaleString('hr-HR')} €`; });
    document.querySelectorAll('#cjenik .sec-label [data-lang]').forEach(element => {
      const labels = { hr: `Cjenik ${year}`, en: `Price list ${year}`, de: `Preisliste ${year}`, it: `Listino prezzi ${year}`, ru: `Прайс-лист ${year}` };
      element.textContent = labels[element.dataset.lang] || labels.hr;
    });
  }

  return Object.freeze({ load, setRules, getRules, ruleForDate, nightlyPrice, stayPrice, refreshPublicPriceDisplay });
})();

window.BalentAnnouncement = (() => {
  let settings = null;
  let bannerObserver = null;
  let activeBar = null;
  let scrollFrame = null;

  function clearLayout() {
    bannerObserver?.disconnect();
    bannerObserver = null;
    activeBar = null;
    if (scrollFrame) {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
    }
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleScroll);
    document.body?.classList.remove('balent-announcement-visible');
    document.documentElement.style.removeProperty('--balent-announcement-height');
  }

  function syncLayout(bar) {
    if (!bar?.isConnected) return;
    const rect = bar.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(bar.offsetHeight, rect.bottom));
    document.body.classList.add('balent-announcement-visible');
    document.documentElement.style.setProperty('--balent-announcement-height', `${visibleHeight}px`);
  }

  function handleScroll() {
    if (!activeBar?.isConnected) return;
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      syncLayout(activeBar);
    });
  }

  function currentLanguage() {
    const lang = (localStorage.getItem('balent_lang') || document.documentElement.lang || 'hr').toLowerCase();
    return ['hr', 'en', 'de', 'it', 'ru'].includes(lang) ? lang : 'hr';
  }

  function render() {
    document.getElementById('balent-announcement')?.remove();
    clearLayout();
    if (!settings || settings.baner_vidljiv !== 'true' || sessionStorage.getItem('balent_banner_closed') === '1') return;
    const lang = currentLanguage();
    const text = settings[`baner_tekst_${lang}`] || settings.baner_tekst_hr;
    if (!text) return;
    const bar = document.createElement('div');
    bar.id = 'balent-announcement';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span></span><button type="button" aria-label="Zatvori obavijest">&times;</button>`;
    bar.querySelector('span').textContent = text;
    bar.style.setProperty('--announcement-bg', settings.baner_boja_pozadine || '#1a2636');
    bar.style.setProperty('--announcement-fg', settings.baner_boja_teksta || '#ffffff');
    bar.querySelector('button').addEventListener('click', () => {
      sessionStorage.setItem('balent_banner_closed', '1');
      bar.remove();
      clearLayout();
    });
    document.body.prepend(bar);
    activeBar = bar;
    syncLayout(bar);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    if ('ResizeObserver' in window) {
      bannerObserver = new ResizeObserver(() => syncLayout(bar));
      bannerObserver.observe(bar);
    }
  }

  async function load() {
    if (/dashboard|admin-login/.test(location.pathname)) return;
    const config = window.BALENT_CONFIG;
    if (!config?.SUPABASE_URL || !config?.SUPABASE_KEY) return;
    const keys = ['baner_tekst_hr','baner_tekst_en','baner_tekst_de','baner_tekst_it','baner_tekst_ru','baner_vidljiv','baner_boja_pozadine','baner_boja_teksta'];
    try {
      const response = await fetch(`${config.SUPABASE_URL}/rest/v1/sadrzaj?select=kljuc,vrijednost&kljuc=in.(${keys.join(',')})`, {
        headers: { apikey: config.SUPABASE_KEY, Authorization: `Bearer ${config.SUPABASE_KEY}` }
      });
      if (!response.ok) throw new Error(`Baner HTTP ${response.status}`);
      const rows = await response.json();
      settings = Object.fromEntries(rows.map(row => [row.kljuc, row.vrijednost]));
      render();
    } catch (error) {
      console.warn('Baner nije dostupan.', error);
    }
  }

  return Object.freeze({ load, render });
})();

if (!/dashboard|admin-login/.test(location.pathname)) {
  const style = document.createElement('style');
  style.textContent = '#balent-announcement{display:flex;align-items:center;justify-content:center;gap:1rem;min-height:42px;padding:.55rem 3rem;background:var(--announcement-bg);color:var(--announcement-fg);font-family:DM Sans,sans-serif;font-size:.9rem;line-height:1.35;text-align:center;position:relative;z-index:1200}#balent-announcement button{position:absolute;right:1rem;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:transparent;color:inherit;font-size:1.45rem;line-height:1;cursor:pointer}.balent-announcement-visible nav{top:var(--balent-announcement-height,42px)}.balent-announcement-visible .nav-links{top:var(--balent-announcement-height,42px)}@media(max-width:600px){#balent-announcement{padding:.6rem 3rem .6rem 1rem;font-size:.82rem;text-align:left;justify-content:flex-start}}';
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    window.BalentPricing.load();
    window.BalentAnnouncement.load();
    window.setTimeout(() => {
      if (typeof window.setLang !== 'function' || window.setLang.__balentWrapped) return;
      const original = window.setLang;
      const wrapped = function(...args) {
        const result = original.apply(this, args);
        window.BalentAnnouncement.render();
        return result;
      };
      wrapped.__balentWrapped = true;
      window.setLang = wrapped;
    }, 0);
  });
}

function toIsoDateLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateInputToIso(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const isoLike = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const displayLike = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
  if (!displayLike) return '';
  const [, d, m, y] = displayLike;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateInput(value) {
  const iso = normalizeDateInputToIso(value);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value, fallback = '–') {
  const iso = normalizeDateInputToIso(value);
  if (!iso) return fallback;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return fallback;
  return `${d}.${m}.${y}.`;
}

function compareDateRangesOverlap(startA, endA, startB, endB) {
  const aStart = normalizeDateInputToIso(startA);
  const aEnd = normalizeDateInputToIso(endA);
  const bStart = normalizeDateInputToIso(startB);
  const bEnd = normalizeDateInputToIso(endB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && aEnd > bStart;
}

function dateRangeNights(dateIn, dateOut) {
  const start = parseDateInput(dateIn);
  const end = parseDateInput(dateOut);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function parseMoneyInputValue(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyInputValue(value) {
  const parsed = typeof value === 'number' ? value : parseMoneyInputValue(value);
  if (parsed === null || !Number.isFinite(parsed)) return '';
  return String(parsed).replace('.', ',');
}

function bindMoneyInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.moneyBound === '1') return;
  el.dataset.moneyBound = '1';
  el.addEventListener('blur', () => {
    const formatted = formatMoneyInputValue(el.value);
    if (formatted) el.value = formatted;
  });
}
