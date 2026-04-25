window.BALENT_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://xtvgkraqccsuonqhaeab.supabase.co',
  SUPABASE_KEY: 'sb_publishable_SL6TVK5N_mR9-aP2gPXYFw_jC3K1rOZ'
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
