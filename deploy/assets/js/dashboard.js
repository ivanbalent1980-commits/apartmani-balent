// Extracted from dashboard.html on 2026-04-26.
// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
const { SUPABASE_URL, SUPABASE_KEY } = window.BALENT_CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'balent_admin_session' } });

sb.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    window.location.href = 'admin-login.html';
  }
});

let currentUser = null;
let allRezervacije = [];
let currentRezId = null;
let currentRezStatus = null;
let racunClearedInModal = false;
let rezDolazakPicker = null;
let rezOdlazakPicker = null;
let filterDatumOdPicker = null;
let filterDatumDoPicker = null;

function getReservationAuditSessionId() {
  try {
    const key = 'balent_admin_audit_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch (_) {
    return '';
  }
}

function reservationDuplicateKey(payload) {
  const emailOrName = String(payload?.email || payload?.ime || '').trim().toLowerCase();
  return [
    emailOrName,
    payload?.apartman || '',
    payload?.datum_dolaska || '',
    payload?.datum_odlaska || ''
  ].join('|');
}

function findReservationSnapshot(id) {
  if (!id || !Array.isArray(allRezervacije)) return null;
  return allRezervacije.find(r => String(r.id) === String(id)) || null;
}

async function logReservationAudit(entry) {
  try {
    const newData = entry.newData || null;
    const oldData = entry.oldData || null;
    await sb.from('rezervacije_audit').insert([{
      rezervacija_id: entry.reservationId ? String(entry.reservationId) : null,
      action: entry.action,
      source: entry.source || 'dashboard',
      actor_type: 'admin_user',
      actor_email: currentUser?.email || null,
      actor_id: currentUser?.id || null,
      session_id: getReservationAuditSessionId(),
      duplicate_key: reservationDuplicateKey(newData || oldData),
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      old_data: oldData,
      new_data: newData,
      notes: entry.notes || null
    }]);
  } catch (err) {
    console.warn('Reservation audit insert failed:', err);
  }
}

function initRezDatePickers() {
  if (!window.flatpickr) return;
  const dolazakEl = document.getElementById('rDolazak');
  const odlazakEl = document.getElementById('rOdlazak');
  if (!dolazakEl || !odlazakEl) return;
  if (window.flatpickr.l10ns && window.flatpickr.l10ns.hr) {
    window.flatpickr.localize(window.flatpickr.l10ns.hr);
  }

  const baseOpts = {
    locale: 'hr',
    allowInput: false,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd.m.Y.',
    disableMobile: true
  };

  if (rezDolazakPicker) rezDolazakPicker.destroy();
  if (rezOdlazakPicker) rezOdlazakPicker.destroy();

  rezDolazakPicker = window.flatpickr(dolazakEl, {
    ...baseOpts,
    onChange: function(selectedDates, dateStr) {
      calcRezZarada();
      if (!rezOdlazakPicker) return;
      const selected = selectedDates[0] || null;
      rezOdlazakPicker.set('minDate', selected);
      if (selected) {
        rezOdlazakPicker.jumpToDate(selected);
        const currentCheckout = rezOdlazakPicker.selectedDates[0];
        if (!currentCheckout || currentCheckout < selected) {
          rezOdlazakPicker.setDate(selected, true);
        }
      }
    }
  });

  rezOdlazakPicker = window.flatpickr(odlazakEl, {
    ...baseOpts,
    onOpen: function(selectedDates, dateStr, instance) {
      const arrival = rezDolazakPicker?.selectedDates?.[0] || null;
      if (arrival) {
        instance.set('minDate', arrival);
        instance.jumpToDate(selectedDates[0] || arrival);
      }
    },
    onChange: function() {
      calcRezZarada();
    }
  });
}
initRezDatePickers();

function initGostiFilterDatePickers() {
  if (!window.flatpickr) return;
  const odEl = document.getElementById('filterDatumOd');
  const doEl = document.getElementById('filterDatumDo');
  if (!odEl || !doEl) return;

  const baseOpts = {
    locale: 'hr',
    allowInput: false,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd.m.Y.',
    disableMobile: true
  };

  if (filterDatumOdPicker) filterDatumOdPicker.destroy();
  if (filterDatumDoPicker) filterDatumDoPicker.destroy();

  filterDatumOdPicker = window.flatpickr(odEl, {
    ...baseOpts,
    onChange: function(selectedDates) {
      const selected = selectedDates[0] || null;
      if (filterDatumDoPicker) {
        filterDatumDoPicker.set('minDate', selected);
        if (selected) filterDatumDoPicker.jumpToDate(selected);
      }
      filterGosti();
    }
  });

  filterDatumDoPicker = window.flatpickr(doEl, {
    ...baseOpts,
    onOpen: function(selectedDates, dateStr, instance) {
      const fromDate = filterDatumOdPicker?.selectedDates?.[0] || null;
      if (fromDate) {
        instance.set('minDate', fromDate);
        instance.jumpToDate(selectedDates[0] || fromDate);
      }
    },
    onChange: function() {
      filterGosti();
    }
  });
}
initGostiFilterDatePickers();

function rezPickerValue(elId, pickerRef) {
  const el = document.getElementById(elId);
  if (el && el.value) return normalizeDateInputToIso(el.value);
  const date = pickerRef?.selectedDates?.[0];
  return toIsoDateLocal(date);
}

let currentRezUplate = [];
let currentRashodKat = 'rezije';
let currentFinTab = 'sve';
let confirmCallback = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let currentPraviloTip = 'min_boravak';
let rezervacijeChannel = null;
let porukeChannel = null;
let currentPageName = 'kalendar';
let currentPorukeTab = 'rezervacije';

// Auth check
async function initApp() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'admin-login.html';
    return;
  }
  currentUser = session.user;
  document.getElementById('userEmail').textContent = currentUser.email;

  // Set today
  const now = new Date();
  document.getElementById('todayDate').textContent = now.toLocaleDateString('hr-HR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Fill year selects
  const curY = now.getFullYear();
  [document.getElementById('finGodina'), document.getElementById('filterGodina')].forEach(sel => {
    if (!sel) return;
    for (let y = curY; y >= curY - 5; y--) {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === curY) o.selected = true;
      sel.appendChild(o);
    }
  });

  await refreshUpitIndicators();
  setupRezervacijeSubscription();
  setupPorukeSubscription();
  loadPage('kalendar');
}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
const pageTitles = {
  kalendar:'Kalendar i rezervacije', poruke:'Poruke', gosti:'Gosti', financije:'Financije',
  sadrzaj:'Upravljanje sadržajem', postavke:'Postavke'
};

function showPage(name) {
  currentPageName = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'"+name+"'")) n.classList.add('active');
  });
  document.getElementById('pageTitle').textContent = pageTitles[name] || name;
  loadPage(name);
  document.getElementById('sidebar').classList.remove('open');
}

function loadPage(name) {
  if (name === 'kalendar') { loadKalendar(); loadKalendarStats(); }
  else if (name === 'gosti') loadGosti();
  else if (name === 'financije') { loadFinancije(); loadRashodi(); }
  else if (name === 'poruke') {
    const rezTabBtn = document.querySelector('#porukeTabs .tab:first-child');
    setPorukeTab('rezervacije', rezTabBtn);
    loadPoruke();
  }
  else if (name === 'sadrzaj') loadBaner();
  else if (name === 'postavke') loadPravila();
}

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function addDaysToIso(value, days) {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setDate(date.getDate() + (Number(days) || 0));
  return toIsoDateLocal(date);
}

function dayOfMonthFromIso(value) {
  return parseDateInput(value)?.getDate() || 0;
}

function todayIsoDate() {
  return toIsoDateLocal(new Date());
}

['rZarada', 'uIznos', 'rashodIznos'].forEach(bindMoneyInput);

function fmtDate(d) {
  return formatDisplayDate(d);
}
function fmtEur(n) { return (parseFloat(n)||0).toFixed(2).replace('.',',') + ' €'; }
function aptLabel(n) { return ['','Apt 1','Apt 2','Apt 3','Apt 4'][n] || 'Apt '+n; }
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function rezSourceLabel(s) {
  return {vlastiti:'Vlastiti', airbnb:'Airbnb', estee:'AG', ostalo:'Ostalo'}[s] || (s || 'â€“');
}
function getRacunUrl(rez) {
  return rez?.racun_dokument_url || rez?.racun_url || null;
}
function getRacunName(rez) {
  return rez?.racun_dokument_naziv || (getRacunUrl(rez) ? decodeURIComponent(String(getRacunUrl(rez)).split('/').pop() || 'Dokument') : '');
}
function getModalRacunUrl() {
  const link = document.getElementById('rRacunLink');
  if (!link) return null;
  const raw = link.dataset.ref || link.getAttribute('href');
  if (!raw || raw === '#') return null;
  return raw;
}
function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}
async function openStoredDocument(ref, fileName = 'Dokument') {
  if (!ref) return;
  const cleanRef = String(ref).trim();
  if (isAbsoluteUrl(cleanRef)) {
    window.open(cleanRef, '_blank', 'noopener');
    return;
  }
  const { data, error } = await sb.storage.from('dokumenti').createSignedUrl(cleanRef, 60);
  if (error || !data?.signedUrl) {
    alert('Dokument trenutno nije dostupan. Pokušajte ponovno.');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}
function racunCell(rez) {
  const broj = escapeHtml(rez?.broj_racuna || '');
  return broj || '–';
}
function dokumentCell(rez) {
  const url = getRacunUrl(rez);
  const name = escapeHtml(getRacunName(rez) || 'Dokument');
  if (!url) return '–';
  return `<button type="button" class="btn btn-secondary btn-sm btn-icon" title="${name}" onclick='openStoredDocument(${JSON.stringify(url)}, ${JSON.stringify(getRacunName(rez) || 'Dokument')})'>📄</button>`;
}
function rezZarada(rez) {
  if (!rez) return 0;
  const rucna = parseFloat(rez.zarada_rucna);
  const auto = parseFloat(rez.zarada_auto);
  if (rez.zarada_je_rucna && Number.isFinite(rucna) && rucna > 0) return rucna;
  if (Number.isFinite(auto) && auto > 0) return auto;
  if (rez.datum_dolaska && rez.datum_odlaska) return calcPrice(rez.datum_dolaska, rez.datum_odlaska);
  if (Number.isFinite(rucna) && rucna !== 0) return rucna;
  if (Number.isFinite(auto)) return auto;
  return 0;
}
function rezAkontacija(rez) {
  const a = parseFloat(rez?.akontacija);
  return Number.isFinite(a) && a > 0 ? a : 0;
}
function rezNaplaceno(rez, uplateZbroj) {
  const upl = parseFloat(uplateZbroj);
  if (Number.isFinite(upl) && upl > 0) return upl;
  return rezAkontacija(rez);
}
function rezTooltip(rez) {
  return [
    rez?.ime || 'Gost',
    `${fmtDate(rez?.datum_dolaska)} - ${fmtDate(rez?.datum_odlaska)}`,
    `Izvor: ${rezSourceLabel(rez?.izvor)}`,
    `Ukupno: ${fmtEur(rezZarada(rez))}`
  ].join('\n');
}
function normalizeRezStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'potvrdjeno' || s === 'potvrđeno') return 'potvrdjeno';
  if (s === 'upit') return 'upit';
  if (s === 'blokirano') return 'blokirano';
  if (s === 'otkazano') return 'otkazano';
  return s;
}
function statusBadge(s) {
  const map = {
    potvrdjeno: ['badge-green','Potvrđeno'],
    upit: ['badge-yellow','Upit'],
    blokirano: ['badge-red','Blokirano'],
    otkazano: ['badge-grey','Otkazano']
  };
  const [cls,lbl] = map[s] || ['badge-grey',s];
  return `<span class="badge ${cls}">${lbl}</span>`;
}
function izvorBadge(s) {
  const map = {vlastiti:['badge-blue','Vlastiti'],airbnb:['badge-green','Airbnb'],estee:['badge-yellow','AG'],ostalo:['badge-grey','Ostalo']};
  const [cls,lbl] = map[s] || ['badge-grey',s];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

function updateUpitIndicators(records) {
  const pending = (records || []).filter(r => normalizeRezStatus(r.status) === 'upit');
  const count = pending.length;
  const nav = document.getElementById('navUpitCount');
  const chip = document.getElementById('topbarUpitChip');
  const chipText = document.getElementById('topbarUpitText');
  const notice = document.getElementById('upitNotice');
  const noticeText = document.getElementById('upitNoticeText');
  const hasPending = count > 0;

  if (nav) {
    nav.textContent = count;
    nav.style.display = hasPending ? 'inline-flex' : 'none';
  }
  if (chip && chipText) {
    chip.classList.toggle('attention', hasPending);
    chipText.textContent = count === 1
      ? 'Imate 1 nepotvrđenu rezervaciju'
      : `Imate ${count} nepotvrđenih rezervacija`;
  }
  if (notice && noticeText) {
    notice.style.display = 'flex';
    notice.classList.toggle('notice-warn', hasPending);
    notice.classList.toggle('notice-info', !hasPending);
    notice.classList.toggle('attention', hasPending);
    noticeText.textContent = count === 1
      ? 'Imate 1 nepotvrđenu rezervaciju.'
      : `Imate ${count} nepotvrđenih rezervacija.`;
  }
  renderPendingList(pending);
}

function renderPendingList(pending) {
  const wrap = document.getElementById('pendingList');
  if (!wrap) return;
  const items = (pending || [])
    .slice()
    .sort((a, b) => new Date(a.datum_dolaska) - new Date(b.datum_dolaska));

  if (!items.length) {
    wrap.innerHTML = '<div class="pending-empty">Trenutno nema nepotvrđenih rezervacija.</div>';
    return;
  }

  wrap.innerHTML = items.map(r => {
    const nights = Math.max(1, Math.round((new Date(r.datum_odlaska) - new Date(r.datum_dolaska)) / 86400000));
    return `<div class="pending-card">
      <div class="pending-main">
        <strong>${escapeHtml(r.ime || 'Gost')}</strong>
        <div>${aptLabel(r.apartman)} • ${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
      </div>
      <div class="pending-meta">
        <div>${nights} noćenja</div>
        <div>Izvor: ${escapeHtml(rezSourceLabel(r.izvor))}</div>
      </div>
      <div class="pending-actions">
        <button class="btn btn-secondary btn-sm" onclick='editRezervacija(${JSON.stringify(r)})'>Otvori</button>
      </div>
    </div>`;
  }).join('');
}

async function refreshUpitIndicators() {
  const { data } = await sb.from('rezervacije').select('id, ime, apartman, status, created_at, datum_dolaska').eq('status','upit');
  updateUpitIndicators(data || []);
}

async function refreshAfterRezervacijeChange() {
  await refreshUpitIndicators();
  if (currentPageName === 'kalendar') {
    await Promise.all([loadKalendar(), loadKalendarStats()]);
  } else if (currentPageName === 'gosti') {
    await loadGosti();
  } else if (currentPageName === 'poruke') {
    await loadPoruke();
  } else if (currentPageName === 'financije') {
    await loadFinancije();
  }
}

function setupRezervacijeSubscription() {
  if (rezervacijeChannel) return;
  rezervacijeChannel = sb.channel('dashboard-rezervacije-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rezervacije' }, async payload => {
      if (payload.eventType === 'INSERT' && payload.new?.status === 'upit') {
        const apt = payload.new.apartman ? `Apartman ${payload.new.apartman}` : 'apartman';
        const guest = payload.new.ime || 'Novi gost';
        showToast(`🔔 Stigao je novi upit: ${guest} (${apt})`);
      }
      await refreshAfterRezervacijeChange();
    })
    .subscribe();
}

async function refreshAfterPorukeChange() {
  await refreshUpitIndicators();
  if (currentPageName === 'poruke') {
    await loadPoruke();
  }
}

function setupPorukeSubscription() {
  if (porukeChannel) return;
  porukeChannel = sb.channel('dashboard-poruke-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poruke' }, async payload => {
      if (payload.eventType === 'INSERT') {
        const guest = payload.new?.ime || 'Nova poruka';
        showToast(`🔔 Stigla je nova poruka: ${guest}`);
      }
      await refreshAfterPorukeChange();
    })
    .subscribe();
}

// Price calculator
function calcPrice(dateIn, dateOut) {
  if (!dateIn || !dateOut) return 0;
  const d1 = parseDateInput(dateIn);
  const d2 = parseDateInput(dateOut);
  if (!d1 || !d2 || d2 <= d1) return 0;
  const nights = dateRangeNights(dateIn, dateOut);
  function getNightPrice(date) {
    const m=date.getMonth()+1, d=date.getDate(), md=m*100+d;
    if(md>=601&&md<=610) return 70;
    if(md>=611&&md<=619) return 85;
    if(md>=620&&md<=630) return 95;
    if(md>=701&&md<=705) return 115;
    if(md>=706&&md<=712) return 119;
    if(md>=713&&md<=724) return 130;
    if(md>=725||(m===8&&d<=15)) return 150;
    if(md>=816&&md<=830) return 130;
    if(md>=831||(m===9&&d<=6)) return 100;
    if(m===9&&d>=7&&d<=13) return 90;
    return 85;
  }
  let total=0, cur=new Date(d1);
  for(let i=0;i<nights;i++){total+=getNightPrice(cur);cur.setDate(cur.getDate()+1);}
  return total;
}

// ══════════════════════════════════════
// KALENDAR
// ══════════════════════════════════════
async function loadKalendarStats() {
  const { data } = await sb.from('rezervacije').select('*').in('status',['potvrdjeno','upit']);
  if (!data) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const now = new Date();
  const aktivnih = data.filter(r => {
    const d1=new Date(r.datum_dolaska);
    return d1 > today && d1.getFullYear() === 2026;
  }).length;
  const trenutno = data.filter(r => {
    const d1=new Date(r.datum_dolaska), d2=new Date(r.datum_odlaska);
    return d1<=today && d2>today && r.status==='potvrdjeno';
  });
  document.getElementById('kAktivnih').textContent = aktivnih;
  document.getElementById('kTrenutno').textContent = trenutno.length;
  // Popunjenost ovaj mjesec
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  let zauzetoDana = 0;
  data.filter(r=>r.status==='potvrdjeno').forEach(r => {
    const d1=new Date(r.datum_dolaska), d2=new Date(r.datum_odlaska);
    const mStart=new Date(today.getFullYear(),today.getMonth(),1);
    const mEnd=new Date(today.getFullYear(),today.getMonth()+1,0);
    const start=d1<mStart?mStart:d1, end=d2>mEnd?mEnd:d2;
    if(start<end) zauzetoDana+=Math.round((end-start)/86400000);
  });
  const popunjenost = Math.round(zauzetoDana/(daysInMonth*4)*100);
  document.getElementById('kPopunjenost').textContent = popunjenost + '%';

  const confirmed = data.filter(r => normalizeRezStatus(r.status) === 'potvrdjeno');
  const departures = confirmed
    .map(r => {
      const departureDate = new Date(r.datum_odlaska);
      departureDate.setHours(0,0,0,0);
      const cleaningDoneAt = new Date(r.datum_odlaska + 'T14:00:00');
      return {
        ...r,
        departureDate,
        cleaningDoneAt
      };
    })
    .sort((a,b) => a.departureDate - b.departureDate);

  const futureCleanings = departures.filter(r => r.cleaningDoneAt > now);
  const doneCleanings = departures.filter(r => r.cleaningDoneAt <= now);
  const next7Limit = new Date(today);
  next7Limit.setDate(next7Limit.getDate() + 7);
  const next7 = futureCleanings.filter(r => r.departureDate >= today && r.departureDate < next7Limit);

  const cleaningGuestsText = r => {
    const adults = parseInt(r.broj_osoba || 0, 10) || 0;
    const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
    return children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
  };

  const next7Wrap = document.getElementById('kCleaningNext7');
  if (next7Wrap) {
    next7Wrap.innerHTML = next7.length
      ? next7.map(r => `<div class="cleaning-item">${fmtDate(r.datum_odlaska)} • ${aptLabel(r.apartman)} • ${escapeHtml(r.ime || 'Gost')} • ${escapeHtml(cleaningGuestsText(r))}</div>`).join('')
      : '<div class="cleaning-empty">Nema čišćenja u idućih 7 dana.</div>';
  }
  const futureEl = document.getElementById('kCleaningFuture');
  if (futureEl) futureEl.textContent = futureCleanings.length;
  const doneEl = document.getElementById('kCleaningDone');
  if (doneEl) doneEl.textContent = doneCleanings.length;
}

async function loadKalendar() {
  const { data } = await sb.from('rezervacije').select('*').neq('status','otkazano');
  allRezervacije = (data || []).filter(r => ['potvrdjeno','upit','blokirano'].includes(normalizeRezStatus(r.status)));
  updateUpitIndicators(allRezervacije);
  renderKalendar();
}

function renderKalendar() {
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();
  const mNames = ['Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj','Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac'];
  const monthStart = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
  const nextMonthDate = new Date(calYear, calMonth + 1, 1);
  const monthEndExclusive = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth()+1).padStart(2,'0')}-${String(nextMonthDate.getDate()).padStart(2,'0')}`;
  document.getElementById('calMonthLabel').textContent = `${mNames[calMonth]} ${calYear}`;

  let html = '<div class="cal-header">';
  html += '<div>Apartman</div>';
  for (let d=1; d<=daysInMonth; d++) {
    const isTodayHeader = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    html += `<div class="${isTodayHeader ? 'today' : ''}">${d}</div>`;
  }
  html += '</div>';

  for (let apt=1; apt<=4; apt++) {
    html += `<div class="cal-row">`;
    html += `<div class="cal-apt-label">${aptLabel(apt)}</div>`;
    for (let d=1; d<=daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const nextDateStr = addDaysToIso(dateStr, 1);
      const rez = allRezervacije.find(r => r.apartman == apt && compareDateRangesOverlap(dateStr, nextDateStr, r.datum_dolaska, r.datum_odlaska));
      let cls = '';
      if (rez) {
        const status = normalizeRezStatus(rez.status);
        cls = status==='potvrdjeno' ? 'confirmed' : status==='upit' ? 'pending' : 'blocked';
      }
      const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
      if (isToday) cls += ' today';
      html += `<div class="cal-cell ${cls}" title="${rez ? escapeHtml(rezTooltip(rez)) : ''}" onclick="calCellClick(${apt},'${dateStr}')"></div>`;
    }
    html += `<div class="cal-overlays">`;
    allRezervacije
      .filter(r => r.apartman == apt && compareDateRangesOverlap(monthStart, monthEndExclusive, r.datum_dolaska, r.datum_odlaska))
      .sort((a,b) => a.datum_dolaska.localeCompare(b.datum_dolaska))
      .forEach(rez => {
        const visibleStart = rez.datum_dolaska > monthStart ? rez.datum_dolaska : monthStart;
        const visibleEnd = rez.datum_odlaska < monthEndExclusive ? rez.datum_odlaska : monthEndExclusive;
        const startDay = dayOfMonthFromIso(visibleStart);
        const endDay = visibleEnd === monthEndExclusive
          ? daysInMonth
          : dayOfMonthFromIso(visibleEnd) - 1;
        if (endDay < startDay) return;
        const startCol = startDay + 1;
        const endCol = endDay + 2;
        const spanDays = endDay - startDay + 1;
        const status = normalizeRezStatus(rez.status);
        const spanCls = status==='potvrdjeno' ? 'confirmed' : status==='upit' ? 'pending' : 'blocked';
        const halfStart = visibleStart === rez.datum_dolaska;
        const halfEnd = visibleEnd === rez.datum_odlaska;
        const edgeCls = `${halfStart ? ' half-start' : ''}${halfEnd ? ' half-end' : ''}`;
        const label = spanDays > 1 ? escapeHtml(rez.ime || '') : '';
        html += `<div class="cal-span ${spanCls}${edgeCls}" style="grid-column:${startCol} / ${endCol}" title="${escapeHtml(rezTooltip(rez))}" onclick='event.stopPropagation();openRezById("${escapeHtml(rez.id)}")'><span class="cal-span-label">${label}</span></div>`;
      });
    html += `</div>`;
    html += '</div>';
  }
  document.getElementById('calendarGrid').innerHTML = html;
}

function calPrev() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderKalendar(); }
function calNext() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderKalendar(); }
function calToday() { calYear=new Date().getFullYear(); calMonth=new Date().getMonth(); renderKalendar(); }
function openRezById(id) {
  const rez = allRezervacije.find(r => String(r.id) === String(id));
  if (rez) editRezervacija(rez);
}
function calCellClick(apt, date) {
  const nextDate = addDaysToIso(date, 1);
  const rez = allRezervacije.find(r => r.apartman == apt && compareDateRangesOverlap(date, nextDate, r.datum_dolaska, r.datum_odlaska));
  if (rez) editRezervacija(rez);
  else {
    openRezModal();
    document.getElementById('rApt').value = apt;
    if (rezDolazakPicker) {
      rezDolazakPicker.setDate(date, true);
      if (rezOdlazakPicker) {
        rezOdlazakPicker.set('minDate', date);
        rezOdlazakPicker.jumpToDate(date);
      }
    } else {
      document.getElementById('rDolazak').value = date;
    }
  }
}

// ══════════════════════════════════════
// REZERVACIJE / GOSTI
// ══════════════════════════════════════
async function loadGosti() {
  const { data } = await sb.from('rezervacije').select('*').order('datum_dolaska',{ascending:false});
  allRezervacije = data || [];
  updateUpitIndicators(allRezervacije);
  populateGodinaFilter(data);
  filterGosti();
}

function populateGodinaFilter(data) {
  const sel = document.getElementById('filterGodina');
  const years = [...new Set((data||[]).map(r=>new Date(r.datum_dolaska).getFullYear()))].sort((a,b)=>b-a);
  sel.innerHTML = '<option value="">Sve</option>';
  years.forEach(y => { const o=document.createElement('option'); o.value=y; o.textContent=y; sel.appendChild(o); });
}

function filterGosti() {
  const ime = document.getElementById('filterIme').value.toLowerCase();
  const apt = document.getElementById('filterApt').value;
  const izvor = document.getElementById('filterIzvor').value;
  const status = document.getElementById('filterStatus').value;
  const od = document.getElementById('filterDatumOd').value;
  const do_ = document.getElementById('filterDatumDo').value;
  const god = document.getElementById('filterGodina').value;

  let filtered = allRezervacije.filter(r => {
    if (ime && !r.ime.toLowerCase().includes(ime)) return false;
    if (apt && r.apartman != apt) return false;
    if (izvor && r.izvor !== izvor) return false;
    if (status && normalizeRezStatus(r.status) !== status) return false;
    if (od && r.datum_dolaska < od) return false;
    if (do_ && r.datum_dolaska > do_) return false;
    if (god && new Date(r.datum_dolaska).getFullYear() != god) return false;
    return true;
  });

  const tbody = document.getElementById('gostiBody');
  if (!filtered.length) { tbody.innerHTML='<tr><td colspan="11"><div class="empty"><div class="ico">👥</div><p>Nema gostiju koji odgovaraju filteru.</p></div></td></tr>'; return; }

  tbody.innerHTML = filtered.map(r => {
    const zarada = rezZarada(r);
    const zaradaCls = r.zarada_je_rucna ? 'zarada-rucna' : '';
    return `<tr>
      <td><strong>${r.ime}</strong></td>
      <td>${aptLabel(r.apartman)}</td>
      <td>${fmtDate(r.datum_dolaska)}</td>
      <td>${fmtDate(r.datum_odlaska)}</td>
      <td>${r.broj_osoba}</td>
      <td>${izvorBadge(r.izvor)}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="${zaradaCls}">${fmtEur(zarada)}</td>
      <td>${racunCell(r)}</td>
      <td>${dokumentCell(r)}</td>
      <td><button class="btn btn-secondary btn-sm btn-icon" onclick='editRezervacija(${JSON.stringify(r)})'>✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRez('${r.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
}

function openRezModal(rez=null) {
  currentRezId = rez ? rez.id : null;
  currentRezStatus = rez ? rez.status : null;
  racunClearedInModal = false;
  document.getElementById('rezModalTitle').textContent = rez ? 'Uredi rezervaciju' : 'Nova rezervacija';
  const deleteBtn = document.getElementById('rezDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = rez ? 'inline-flex' : 'none';
  document.getElementById('rIme').value = rez?.ime || '';
  const emailEl = document.getElementById('rEmail');
  if (emailEl) emailEl.value = rez?.email || '';
  document.getElementById('rApt').value = rez?.apartman || 1;
  document.getElementById('rIzvor').value = rez?.izvor || 'vlastiti';
  document.getElementById('rDolazak').value = rez?.datum_dolaska || '';
  document.getElementById('rOdlazak').value = rez?.datum_odlaska || '';
  document.getElementById('rBrojOsoba').value = rez?.broj_osoba || 2;
  document.getElementById('rStatus').value = rez?.status || 'upit';
  document.getElementById('rKomentar').value = rez?.komentar || '';
  document.getElementById('rRacunFile').value = '';
  if (getRacunUrl(rez)) {
    document.getElementById('rRacunExisting').style.display = 'block';
    document.getElementById('rRacunLink').dataset.ref = getRacunUrl(rez);
    document.getElementById('rRacunLink').href = '#';
    document.getElementById('rRacunLink').onclick = function(ev) {
      ev.preventDefault();
      openStoredDocument(getRacunUrl(rez), getRacunName(rez) || 'Dokument');
    };
  } else {
    document.getElementById('rRacunExisting').style.display = 'none';
    document.getElementById('rRacunLink').removeAttribute('data-ref');
    document.getElementById('rRacunLink').removeAttribute('href');
    document.getElementById('rRacunLink').onclick = null;
  }
  const zarada = rez ? rezZarada(rez) : '';
  document.getElementById('rZarada').value = zarada ? formatMoneyInputValue(zarada) : '';
  document.getElementById('rezZaradaInfo').style.display = 'none';
  currentRezUplate = [];
  renderUplateSection();
  resetUplataForm();
  openModal('rezModal');
}

function editRezervacija(rez) { openRezModal(rez); }

function deleteCurrentRezFromModal() {
  if (!currentRezId) return;
  showConfirm(
    '🗑️',
    'Obrisati rezervaciju?',
    'Rezervacija će biti trajno obrisana. Jeste li sigurni da želite nastaviti?',
    async () => {
      const id = currentRezId;
      closeModal('rezModal');
      await deleteRez(id);
    }
  );
}

function calcRezZarada(force=false) {
  const d1 = rezPickerValue('rDolazak', rezDolazakPicker);
  const d2 = rezPickerValue('rOdlazak', rezOdlazakPicker);
  const zEl = document.getElementById('rZarada');
  const info = document.getElementById('rezZaradaInfo');
  if (!d1 || !d2) return;
  const total = calcPrice(d1, d2);
  if (force || !zEl.value) {
    zEl.value = formatMoneyInputValue(total);
    if (total > 0) {
      const nights = dateRangeNights(d1, d2);
      info.textContent = `Auto izračun: ${nights} noćenja × prosječno ${(total/nights).toFixed(0)} €/noć = ${total} €`;
      info.style.display = 'block';
    }
  }
}

async function saveRezervacija() {
  const ime = document.getElementById('rIme').value.trim();
  const dolazak = rezPickerValue('rDolazak', rezDolazakPicker);
  const odlazak = rezPickerValue('rOdlazak', rezOdlazakPicker);
  if (!ime || !dolazak || !odlazak) { alert('Unesite ime, datum dolaska i odlaska.'); return; }

  const zaradaAuto = calcPrice(dolazak, odlazak);
  const zaradaRucnaVal = parseMoneyInputValue(document.getElementById('rZarada').value);
  const zaradaJeRucna = zaradaRucnaVal !== null && zaradaRucnaVal !== zaradaAuto;

  // Handle file upload
  let racunUrl = currentRezId ? getModalRacunUrl() : null;
  const fileInput = document.getElementById('rRacunFile');
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const fileName = `racuni/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { data: uploadData, error: uploadErr } = await sb.storage.from('dokumenti').upload(fileName, file);
    if (uploadErr) { alert('Greška pri uploadu: '+uploadErr.message); return; }
    racunUrl = fileName;
  }

  const payload = {
    ime, apartman: parseInt(document.getElementById('rApt').value),
    datum_dolaska: dolazak, datum_odlaska: odlazak,
    broj_osoba: parseInt(document.getElementById('rBrojOsoba').value)||1,
    izvor: document.getElementById('rIzvor').value,
    status: document.getElementById('rStatus').value,
    komentar: document.getElementById('rKomentar').value||null,
    racun_url: racunUrl,
    zarada_auto: zaradaAuto, zarada_rucna: zaradaJeRucna ? zaradaRucnaVal : null,
    zarada_je_rucna: zaradaJeRucna, updated_at: new Date().toISOString()
  };

  let err;
  const previousReservation = findReservationSnapshot(currentRezId);
  if (currentRezId) ({ error: err } = await sb.from('rezervacije').update(payload).eq('id',currentRezId));
  else ({ error: err } = await sb.from('rezervacije').insert([payload]));

  if (err) { alert('Greška: '+err.message); return; }
  await logReservationAudit({
    action: currentRezId ? 'update' : 'insert',
    source: currentRezId ? 'dashboard_reservation_edit_legacy' : 'dashboard_reservation_create_legacy',
    reservationId: currentRezId,
    oldData: previousReservation,
    newData: payload,
    notes: 'legacy saveRezervacija flow'
  });
  closeModal('rezModal');
  loadGosti(); loadKalendar(); loadKalendarStats();
}

const _origSaveRezervacija = saveRezervacija;
saveRezervacija = async function() {
  const nextStatus = document.getElementById('rStatus').value;
  if (currentRezId && currentRezStatus === 'upit' && nextStatus === 'otkazano') {
    showConfirm('⚠️','Otkaži upit?','Upit će biti označen kao otkazan. Jeste li sigurni da želite nastaviti?', async () => {
      currentRezStatus = nextStatus;
      await _origSaveRezervacija();
    });
    return;
  }
  currentRezStatus = nextStatus;
  await _origSaveRezervacija();
};

function clearRacun() {
  racunClearedInModal = true;
  document.getElementById('rRacunFile').value = '';
  document.getElementById('rRacunExisting').style.display = 'none';
  document.getElementById('rRacunLink').removeAttribute('data-ref');
  document.getElementById('rRacunLink').removeAttribute('href');
  document.getElementById('rRacunLink').onclick = null;
}

async function deleteRez(id) {
  showConfirm('🗑️','Brisanje rezervacije','Ova rezervacija će biti trajno obrisana.', async () => {
    const previousReservation = findReservationSnapshot(id);
    const { error } = await sb.from('rezervacije').delete().eq('id',id);
    if (error) {
      alert('Greška pri brisanju rezervacije: ' + error.message);
      return;
    }
    await logReservationAudit({
      action: 'delete',
      source: 'dashboard_reservation_delete',
      reservationId: id,
      oldData: previousReservation,
      notes: 'deleteRez'
    });
    if (Array.isArray(allRezervacije)) {
      allRezervacije = allRezervacije.filter(r => String(r.id) !== String(id));
    }
    loadGosti(); loadKalendar(); loadKalendarStats(); loadFinancije();
  });
}

function renderUplateSection() {
  const list = document.getElementById('uplateList');
  const total = document.getElementById('uplateTotal');
  const note = document.getElementById('uplateNote');
  const form = document.getElementById('uplateForm');
  if (!list || !total || !note || !form) return;

  if (!currentRezId) {
    note.textContent = 'Spremite rezervaciju kako biste mogli dodavati uplate.';
    total.textContent = 'Naplaćeno: 0,00 €';
    list.innerHTML = '<div class="uplata-empty">Uplate se mogu dodavati nakon što rezervacija bude spremljena.</div>';
    form.style.display = 'none';
    return;
  }

  note.textContent = 'Evidentirajte akontacije, gotovinu, AG i Airbnb uplate za ovu rezervaciju.';
  form.style.display = 'grid';
  const naplacenoIzUplata = currentRezUplate.reduce((sum, u) => sum + (parseFloat(u.iznos) || 0), 0);
  const naplaceno = rezNaplaceno(allRezervacije.find(r => String(r.id) === String(currentRezId)), naplacenoIzUplata);
  total.textContent = `Naplaćeno: ${fmtEur(naplaceno)}`;

  if (!currentRezUplate.length) {
    const rez = allRezervacije.find(r => String(r.id) === String(currentRezId));
    const akontacija = rezAkontacija(rez);
    list.innerHTML = akontacija > 0
      ? `<div class="uplata-item">
          <div class="uplata-main">
            <strong>Akontacija (uvezeno iz rezervacije)</strong>
            <div>Ovaj iznos je preuzet iz polja akontacije i još nije razbijen na pojedinačne uplate.</div>
          </div>
          <div class="uplata-iznos">${fmtEur(akontacija)}</div>
          <div style="width:32px"></div>
        </div>`
      : '<div class="uplata-empty">Još nema uplata za ovu rezervaciju.</div>';
    return;
  }

  list.innerHTML = currentRezUplate.map(u => {
    const meta = [fmtDate(u.datum_uplate), uplataVrstaLabel(u.vrsta), uplataNacinLabel(u.nacin)].filter(Boolean).join(' • ');
    const extra = [u.broj_racuna ? `Račun: ${escapeHtml(u.broj_racuna)}` : '', u.opis ? escapeHtml(u.opis) : ''].filter(Boolean).join(' • ');
    const doc = u.dokument_url ? `<button type="button" class="btn btn-secondary btn-sm btn-icon" title="${escapeHtml(u.dokument_naziv || 'Dokument')}" onclick='openStoredDocument(${JSON.stringify(u.dokument_url)}, ${JSON.stringify(u.dokument_naziv || 'Dokument')})'>📄</button>` : '<span style="width:32px"></span>';
    return `<div class="uplata-item">
      <div class="uplata-main">
        <strong>${escapeHtml(meta || 'Uplata')}</strong>
        <div>${extra || 'Bez dodatne napomene.'}</div>
      </div>
      <div class="uplata-iznos">${fmtEur(u.iznos || 0)}</div>
      <div style="display:flex;align-items:center;gap:.4rem;justify-content:flex-end">
        ${doc}
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteUplata('${u.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function uplataVrstaLabel(vrsta) {
  const map = { akontacija: 'Akontacija', doplata: 'Doplata', airbnb: 'Airbnb', agencija: 'AG', gotovina: 'Gotovina' };
  return map[vrsta] || vrsta || '';
}

function uplataNacinLabel(nacin) {
  const map = { racun: 'Račun', gotovina: 'Gotovina' };
  return map[nacin] || nacin || '';
}

function resetUplataForm() {
  const today = todayIsoDate();
  if (document.getElementById('uDatum')) document.getElementById('uDatum').value = today;
  if (document.getElementById('uIznos')) document.getElementById('uIznos').value = '';
  if (document.getElementById('uVrsta')) document.getElementById('uVrsta').value = 'akontacija';
  if (document.getElementById('uNacin')) document.getElementById('uNacin').value = 'racun';
  if (document.getElementById('uOpis')) document.getElementById('uOpis').value = '';
  if (document.getElementById('uBrojRacuna')) document.getElementById('uBrojRacuna').value = '';
  if (document.getElementById('uDokument')) document.getElementById('uDokument').value = '';
}

async function loadUplateForCurrentRez() {
  if (!currentRezId) {
    currentRezUplate = [];
    resetUplataForm();
    renderUplateSection();
    return;
  }
  const { data, error } = await sb.from('uplate').select('*').eq('rezervacija_id', currentRezId).order('datum_uplate', { ascending: false }).order('created_at', { ascending: false });
  if (error) {
    currentRezUplate = [];
    renderUplateSection();
    return;
  }
  currentRezUplate = data || [];
  resetUplataForm();
  renderUplateSection();
}

async function saveUplata() {
  if (!currentRezId) {
    alert('Prvo spremite rezervaciju, pa zatim dodajte uplatu.');
    return;
  }
  const datum_uplate = document.getElementById('uDatum')?.value;
  const iznos = parseMoneyInputValue(document.getElementById('uIznos')?.value || '');
  const vrsta = document.getElementById('uVrsta')?.value || 'akontacija';
  const nacin = document.getElementById('uNacin')?.value || 'racun';
  const opis = document.getElementById('uOpis')?.value.trim() || null;
  const broj_racuna = document.getElementById('uBrojRacuna')?.value.trim() || null;
  const fileInput = document.getElementById('uDokument');

  if (!datum_uplate || !(iznos > 0)) {
    alert('Unesite datum uplate i iznos veći od 0.');
    return;
  }

  let dokument_url = null;
  let dokument_naziv = null;
  if (fileInput?.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const fileName = `uplate/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error: uploadErr } = await sb.storage.from('dokumenti').upload(fileName, file);
    if (uploadErr) {
      alert('Greška pri uploadu dokumenta: ' + uploadErr.message);
      return;
    }
    dokument_url = fileName;
    dokument_naziv = file.name;
  }

  const payload = { rezervacija_id: currentRezId, datum_uplate, iznos, vrsta, nacin, opis, broj_racuna, dokument_url, dokument_naziv };
  const { error } = await sb.from('uplate').insert([payload]);
  if (error) {
    alert('Greška pri spremanju uplate: ' + error.message);
    return;
  }

  await loadUplateForCurrentRez();
  await loadFinancije();
}

async function deleteUplata(id) {
  showConfirm('🗑️','Brisanje uplate','Ova uplata bit će trajno obrisana.', async () => {
    const { error } = await sb.from('uplate').delete().eq('id', id);
    if (error) {
      alert('Greška pri brisanju uplate: ' + error.message);
      return;
    }
    await loadUplateForCurrentRez();
    await loadFinancije();
  });
}

// ══════════════════════════════════════
// FINANCIJE
// ══════════════════════════════════════
function setFinMainTab(tab, el) {
  document.querySelectorAll('#finMainTabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('fin-prihodi').style.display = tab==='prihodi' ? 'block' : 'none';
  document.getElementById('fin-rashodi').style.display = tab==='rashodi' ? 'block' : 'none';
  if (tab==='rashodi') loadRashodi();
}

function setFinTab(tab, el) {
  currentFinTab = tab;
  document.querySelectorAll('.fin-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  loadFinancije();
}

async function loadFinancije() {
  const god = parseInt(document.getElementById('finGodina').value);
  let q = sb.from('rezervacije').select('*').neq('status','otkazano')
    .gte('datum_dolaska', god+'-01-01').lte('datum_dolaska', god+'-12-31');

  // Filter by tab
  if (currentFinTab === 'gaga') q = q.in('apartman', [1,2]);
  else if (currentFinTab === 'ivan') q = q.in('apartman', [3,4]);
  else if (currentFinTab !== 'sve') q = q.eq('apartman', parseInt(currentFinTab));

  const { data } = await q;
  const all = data || [];
  const rezIds = all.map(r => r.id).filter(Boolean);
  let naplacenoMap = new Map();
  if (rezIds.length) {
    const { data: uplateData } = await sb.from('uplate').select('rezervacija_id, iznos').in('rezervacija_id', rezIds);
    (uplateData || []).forEach(u => {
      const iznos = parseFloat(u.iznos) || 0;
      const key = String(u.rezervacija_id);
      naplacenoMap.set(key, (naplacenoMap.get(key) || 0) + iznos);
    });
  }
  let naplacenoUkupno = 0;
  all.forEach(r => {
    const naplaceno = rezNaplaceno(r, naplacenoMap.get(String(r.id)) || 0);
    naplacenoUkupno += naplaceno;
  });

  const today = new Date(); today.setHours(0,0,0,0);
  let realizirana = 0, buduca = 0;

  all.forEach(r => {
    const zarada = rezZarada(r) || 0;
    const dolazak = new Date(r.datum_dolaska);
    const odlazak = new Date(r.datum_odlaska);
    if (odlazak <= today || (dolazak <= today && odlazak > today)) realizirana += zarada;
    else if (dolazak > today) buduca += zarada;
  });

  // Calculate rashodi for neto (all categories, current year)
  let rashodiFilter = sb.from('rashodi').select('iznos,ucestalost');
  if (currentFinTab === 'gaga' || currentFinTab === 'ivan') {
    // Rashodi are shared - show full amount for 'sve', half for gaga/ivan
  }
  const { data: rashodiData } = await rashodiFilter;
  let ukupnoRashodi = 0;
  (rashodiData||[]).forEach(r => {
    const iznos = parseFloat(r.iznos)||0;
    if (r.ucestalost === 'godisnji') ukupnoRashodi += iznos;
    else if (r.ucestalost === 'polugodisnji') ukupnoRashodi += iznos * 2;
    else if (r.ucestalost === 'kvartalni') ukupnoRashodi += iznos * 4;
    else if (r.ucestalost === 'mjesecni') ukupnoRashodi += iznos * 12;
    else ukupnoRashodi += iznos; // jednokratni
  });
  // For gaga/ivan split rashodi 50/50
  if (currentFinTab === 'gaga' || currentFinTab === 'ivan') ukupnoRashodi = ukupnoRashodi / 2;

  const ukupnoP = realizirana + buduca;
  const netoEl = document.getElementById('finNeto');
  const netoCard = netoEl ? netoEl.closest('.fin-sum-card') : null;

  document.getElementById('finRealizirana').textContent = fmtEur(naplacenoUkupno);
  document.getElementById('finBuduca').textContent = fmtEur(buduca);
  document.getElementById('finUkupna').textContent = fmtEur(ukupnoP);

  // Neto samo za "sve zajedno"
  if (currentFinTab === 'sve') {
    if (netoCard) netoCard.style.display = 'block';
    const neto = ukupnoP - ukupnoRashodi;
    netoEl.textContent = fmtEur(neto);
    netoEl.style.color = neto >= 0 ? '#27ae60' : '#c0392b';
  } else {
    if (netoCard) netoCard.style.display = 'none';
  }

  const tbody = document.getElementById('finBody');
  if (!all.length) { tbody.innerHTML='<tr><td colspan="11"><div class="empty"><div class="ico">💰</div><p>Nema podataka za odabrano razdoblje.</p></div></td></tr>'; return; }

  tbody.innerHTML = all.map(r => {
    const zarada = rezZarada(r);
    const zaradaCls = r.zarada_je_rucna ? 'zarada-rucna' : '';
    const nights = dateRangeNights(r.datum_dolaska, r.datum_odlaska);
    const naplaceno = rezNaplaceno(r, naplacenoMap.get(String(r.id)) || 0);
    return `<tr>
      <td><strong>${r.ime}</strong></td>
      <td>${aptLabel(r.apartman)}</td>
      <td>${fmtDate(r.datum_dolaska)}</td>
      <td>${fmtDate(r.datum_odlaska)}</td>
      <td>${nights}</td>
      <td>${statusBadge(r.status)}</td>
      <td><strong>${fmtEur(naplaceno)}</strong></td>
      <td class="${zaradaCls}"><strong>${fmtEur(zarada)}</strong>${r.zarada_je_rucna?' 🖊️':''}</td>
      <td>${escapeHtml(r.broj_racuna || '–')}</td>
      <td>${getRacunUrl(r) ? `<button type="button" class="btn btn-secondary btn-sm btn-icon" title="${escapeHtml(getRacunName(r) || 'Dokument')}" onclick='openStoredDocument(${JSON.stringify(getRacunUrl(r))}, ${JSON.stringify(getRacunName(r) || 'Dokument')})'>📄</button>` : '–'}</td>
      <td>
        <button class="btn btn-secondary btn-sm btn-icon" onclick='editRezervacija(${JSON.stringify(r)})'>✏️</button>
        ${r.zarada_je_rucna ? `<button class="btn btn-secondary btn-sm btn-icon" title="Vrati auto izračun" onclick="resetZarada('${r.id}')">🔄</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function resetZarada(id) {
  showConfirm('🔄','Vrati izračun iz kalendara?','Ručno unesena zarada bit će obrisana i zamijenjena automatskim izračunom po cjeniku. Ova radnja se ne može poništiti.', async () => {
    const { data } = await sb.from('rezervacije').select('datum_dolaska,datum_odlaska').eq('id',id).single();
    const auto = calcPrice(data.datum_dolaska, data.datum_odlaska);
    await sb.from('rezervacije').update({zarada_auto:auto, zarada_rucna:null, zarada_je_rucna:false}).eq('id',id);
    loadFinancije();
  });
}

// ══════════════════════════════════════
// RASHODI
// ══════════════════════════════════════
async function loadRashodi() {
  const { data } = await sb.from('rashodi').select('*').order('created_at',{ascending:false});
  const all = data || [];
  ['rezije','porezi_clanarine','ostalo'].forEach(kat => {
    const items = all.filter(r=>r.kategorija===kat);
    const el = document.getElementById('rashodi'+kat.charAt(0).toUpperCase()+kat.slice(1).replace('_clanarine','Porezi').replace('rezije','Rezije').replace('ostalo','Ostalo'));
    const elId = {rezije:'rashodiRezije',porezi_clanarine:'rashodiPorezi',ostalo:'rashodiOstalo'}[kat];
    document.getElementById(elId).innerHTML = items.length ? items.map(r=>`
      <div class="rashod-item">
        <div class="rashod-info">
          <div class="rashod-naziv">${r.vrsta}</div>
          <div class="rashod-meta">${r.ucestalost}${r.komentar?' · '+r.komentar:''}</div>
        </div>
        <div class="rashod-iznos">${fmtEur(r.iznos)}</div>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRashod('${r.id}')">🗑️</button>
      </div>`).join('') : '<div style="padding:1rem 1.2rem;font-size:.82rem;color:var(--muted)">Nema unesenih rashoda.</div>';
  });
}

function openRashodModal(kat) {
  currentRashodKat = kat;
  // Load vrsta za tu kategoriju
  sb.from('vrste_rashoda').select('*').eq('kategorija',kat).then(({data}) => {
    const sel = document.getElementById('rashodVrsta');
    sel.innerHTML = (data||[]).map(v=>`<option value="${v.naziv}">${v.naziv}</option>`).join('');
  });
  document.getElementById('rashodIznos').value='';
  document.getElementById('rashodKomentar').value='';
  document.getElementById('rashodDatum').value=todayIsoDate();
  openModal('rashodModal');
}

async function saveRashod() {
  const novaVrsta = document.getElementById('rashodNovaVrsta').value.trim();
  const vrsta = novaVrsta || document.getElementById('rashodVrsta').value;
  const iznos = parseMoneyInputValue(document.getElementById('rashodIznos').value);
  if (!vrsta || !iznos) { alert('Unesite vrstu i iznos.'); return; }

  // Spremi novu vrstu ako je unesena
  if (novaVrsta) {
    await sb.from('vrste_rashoda').insert([{kategorija:currentRashodKat, naziv:novaVrsta}]);
    document.getElementById('rashodNovaVrsta').value='';
  }

  const { error } = await sb.from('rashodi').insert([{
    kategorija: currentRashodKat, vrsta, iznos,
    ucestalost: document.getElementById('rashodUcestalost').value,
    datum: document.getElementById('rashodDatum').value||null,
    komentar: document.getElementById('rashodKomentar').value||null
  }]);
  if (error) { alert('Greška: '+error.message); return; }
  closeModal('rashodModal');
  loadRashodi();
}

async function deleteRashod(id) {
  showConfirm('🗑️','Brisanje rashoda','Ovaj rashod bit će trajno obrisan.', async ()=>{
    await sb.from('rashodi').delete().eq('id',id);
    loadRashodi();
  });
}

// ══════════════════════════════════════
// SADRŽAJ – BANER
// ══════════════════════════════════════
async function loadBaner() {
  const { data } = await sb.from('sadrzaj').select('*').in('kljuc',['baner_tekst_hr','baner_tekst_en','baner_tekst_de','baner_tekst_it','baner_tekst_ru','baner_vidljiv','baner_boja_pozadine','baner_boja_teksta']);
  const map = {};
  (data||[]).forEach(r=>map[r.kljuc]=r.vrijednost);
  document.getElementById('banerTekstHr').value = map.baner_tekst_hr||'';
  document.getElementById('banerTekstEn').value = map.baner_tekst_en||'';
  document.getElementById('banerTekstDe').value = map.baner_tekst_de||'';
  document.getElementById('banerTekstIt').value = map.baner_tekst_it||'';
  document.getElementById('banerTekstRu').value = map.baner_tekst_ru||'';
  document.getElementById('banerVidljiv').checked = map.baner_vidljiv==='true';
  document.getElementById('banerBojaPozadine').value = map.baner_boja_pozadine||'#1a2636';
  document.getElementById('banerBojaTeksta').value = map.baner_boja_teksta||'#ffffff';
  updateBanerPreview();
}

function updateBanerPreview() {
  const preview = document.getElementById('banerPreview');
  const bg = document.getElementById('banerBojaPozadine').value;
  const fg = document.getElementById('banerBojaTeksta').value;
  const tekst = document.getElementById('banerTekstHr').value;
  const vidljiv = document.getElementById('banerVidljiv').checked;
  preview.style.background = bg;
  preview.style.color = fg;
  preview.querySelector('p').textContent = tekst || '(bez teksta)';
  preview.style.opacity = vidljiv ? '1' : '0.4';
}

async function saveBaner() {
  const updates = [
    {kljuc:'baner_tekst_hr', vrijednost:document.getElementById('banerTekstHr').value},
    {kljuc:'baner_tekst_en', vrijednost:document.getElementById('banerTekstEn').value},
    {kljuc:'baner_tekst_de', vrijednost:document.getElementById('banerTekstDe').value},
    {kljuc:'baner_tekst_it', vrijednost:document.getElementById('banerTekstIt').value},
    {kljuc:'baner_tekst_ru', vrijednost:document.getElementById('banerTekstRu').value},
    {kljuc:'baner_vidljiv', vrijednost:document.getElementById('banerVidljiv').checked?'true':'false'},
    {kljuc:'baner_boja_pozadine', vrijednost:document.getElementById('banerBojaPozadine').value},
    {kljuc:'baner_boja_teksta', vrijednost:document.getElementById('banerBojaTeksta').value},
  ];
  for (const u of updates) {
    await sb.from('sadrzaj').upsert({...u, updated_at:new Date().toISOString()},{onConflict:'kljuc'});
  }
  showToast('✅ Baner spremljen!');
}

// ══════════════════════════════════════
// POPUP AKCIJE
// ══════════════════════════════════════
async function loadPopup() {
  const { data } = await sb.from('popup_akcije').select('*').order('created_at',{ascending:false});
  const el = document.getElementById('popupList');
  el.innerHTML = (data||[]).length ? (data||[]).map(p=>`
    <div style="border:1px solid var(--sand-dark);border-radius:2px;padding:1rem;margin-bottom:.8rem;display:flex;align-items:center;gap:1rem">
      <div style="flex:1">
        <strong>${p.naslov}</strong>
        <div style="font-size:.8rem;color:var(--muted);margin-top:.2rem">${p.tekst}</div>
        <div style="margin-top:.4rem">${p.aktivan?'<span class="badge badge-green">Aktivno</span>':'<span class="badge badge-grey">Neaktivno</span>'}</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deletePopup('${p.id}')">🗑️</button>
    </div>`).join('') : '<div class="empty"><div class="ico">📢</div><p>Nema popup akcija.</p></div>';
}

function openPopupModal() {
  document.getElementById('popupNaslov').value='';
  document.getElementById('popupTekst').value='';
  document.getElementById('popupAktivan').checked=false;
  document.getElementById('popupOd').value='';
  document.getElementById('popupDo').value='';
  openModal('popupModal');
}

async function savePopup() {
  const naslov = document.getElementById('popupNaslov').value.trim();
  const tekst = document.getElementById('popupTekst').value.trim();
  if (!naslov||!tekst) { alert('Unesite naslov i tekst.'); return; }
  await sb.from('popup_akcije').insert([{
    naslov, tekst, aktivan:document.getElementById('popupAktivan').checked,
    stil:document.getElementById('popupStil').value,
    datum_od:document.getElementById('popupOd').value||null,
    datum_do:document.getElementById('popupDo').value||null
  }]);
  closeModal('popupModal');
  loadPopup();
}

async function deletePopup(id) {
  showConfirm('🗑️','Brisanje popup akcije','Ova akcija bit će trajno obrisana.', async ()=>{
    await sb.from('popup_akcije').delete().eq('id',id);
    loadPopup();
  });
}

// ══════════════════════════════════════
// PRAVILA KALENDARA
// ══════════════════════════════════════
async function loadPravila() {
  loadMinBoravak(); loadKorekcija(); loadBlokirano();
}

async function loadMinBoravak() {
  const { data } = await sb.from('pravila_kalendara').select('*').eq('tip','min_boravak').order('datum_od');
  document.getElementById('minBoravakBody').innerHTML = (data||[]).length ?
    (data||[]).map(p=>`<tr>
      <td>${p.naziv||'–'}</td><td>${fmtDate(p.datum_od)}</td><td>${fmtDate(p.datum_do)}</td>
      <td><strong>${p.vrijednost} noćenja</strong></td>
      <td>${p.apartman?aptLabel(p.apartman):'Svi'}</td>
      <td>${p.aktivan?'<span class="badge badge-green">Da</span>':'<span class="badge badge-grey">Ne</span>'}</td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deletePravilo('${p.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--muted)">Nema definiranih pravila.</td></tr>';
}

async function loadKorekcija() {
  const { data } = await sb.from('pravila_kalendara').select('*').eq('tip','cjenovna_korekcija');
  document.getElementById('korekcijaBody').innerHTML = (data||[]).length ?
    (data||[]).map(p=>`<tr>
      <td>Kraće od <strong>${p.vrijednost} noćenja</strong></td>
      <td>${p.korekcija_postotak?'+'+p.korekcija_postotak+'%':'+'+p.korekcija_eur+' €'}</td>
      <td>${p.apartman?aptLabel(p.apartman):'Svi'}</td>
      <td>${p.aktivan?'<span class="badge badge-green">Da</span>':'<span class="badge badge-grey">Ne</span>'}</td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deletePravilo('${p.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--muted)">Nema definiranih pravila.</td></tr>';
}

async function loadBlokirano() {
  const { data } = await sb.from('pravila_kalendara').select('*').eq('tip','blokirano').order('datum_od');
  document.getElementById('blokiranoBody').innerHTML = (data||[]).length ?
    (data||[]).map(p=>`<tr>
      <td>${p.naziv||'Blokada'}</td><td>${fmtDate(p.datum_od)}</td><td>${fmtDate(p.datum_do)}</td>
      <td>${p.apartman?aptLabel(p.apartman):'Svi'}</td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deletePravilo('${p.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--muted)">Nema blokiranih datuma.</td></tr>';
}

function openPraviloModal(tip) {
  currentPraviloTip = tip;
  const titles = {min_boravak:'Novo pravilo – minimalni boravak', cjenovna_korekcija:'Nova cjenovna korekcija', blokirano:'Blokada datuma'};
  document.getElementById('praviloModalTitle').textContent = titles[tip];
  const body = document.getElementById('praviloModalBody');
  if (tip === 'min_boravak') {
    body.innerHTML = `<div class="form-grid">
      <div class="fg full"><label>Naziv (npr. Glavna sezona)</label><input type="text" id="pNaziv"></div>
      <div class="fg"><label>Datum od</label><input type="date" id="pOd"></div>
      <div class="fg"><label>Datum do</label><input type="date" id="pDo"></div>
      <div class="fg"><label>Minimalno noćenja</label><input type="number" id="pVrijednost" value="7" min="1"></div>
      <div class="fg"><label>Apartman</label><select id="pApt"><option value="">Svi</option><option value="1">Apt 1</option><option value="2">Apt 2</option><option value="3">Apt 3</option><option value="4">Apt 4</option></select></div>
      <div class="fg"><label>Aktivno</label><div class="toggle-wrap" style="margin-top:.5rem"><label class="toggle"><input type="checkbox" id="pAktivan" checked><span class="toggle-slider"></span></label></div></div>
    </div>`;
  } else if (tip === 'cjenovna_korekcija') {
    body.innerHTML = `<div class="form-grid">
      <div class="fg"><label>Kraće od (noćenja)</label><input type="number" id="pVrijednost" value="2" min="1"></div>
      <div class="fg"><label>Korekcija (%)</label><input type="number" id="pPostotak" placeholder="npr. 30" step="0.1"></div>
      <div class="fg"><label>Ili fiksno (€)</label><input type="number" id="pEur" placeholder="npr. 20" step="0.01"></div>
      <div class="fg"><label>Apartman</label><select id="pApt"><option value="">Svi</option><option value="1">Apt 1</option><option value="2">Apt 2</option><option value="3">Apt 3</option><option value="4">Apt 4</option></select></div>
      <div class="fg"><label>Aktivno</label><div class="toggle-wrap" style="margin-top:.5rem"><label class="toggle"><input type="checkbox" id="pAktivan" checked><span class="toggle-slider"></span></label></div></div>
    </div>`;
  } else {
    body.innerHTML = `<div class="form-grid">
      <div class="fg full"><label>Naziv (npr. Čišćenje, Vlastito korištenje)</label><input type="text" id="pNaziv"></div>
      <div class="fg"><label>Datum od</label><input type="date" id="pOd"></div>
      <div class="fg"><label>Datum do</label><input type="date" id="pDo"></div>
      <div class="fg"><label>Apartman</label><select id="pApt"><option value="">Svi</option><option value="1">Apt 1</option><option value="2">Apt 2</option><option value="3">Apt 3</option><option value="4">Apt 4</option></select></div>
    </div>`;
  }
  openModal('praviloModal');
}

async function savePravilo() {
  const payload = { tip: currentPraviloTip };
  payload.naziv = document.getElementById('pNaziv')?.value||null;
  payload.datum_od = document.getElementById('pOd')?.value||null;
  payload.datum_do = document.getElementById('pDo')?.value||null;
  payload.vrijednost = parseInt(document.getElementById('pVrijednost')?.value)||null;
  payload.korekcija_postotak = parseFloat(document.getElementById('pPostotak')?.value)||null;
  payload.korekcija_eur = parseFloat(document.getElementById('pEur')?.value)||null;
  payload.apartman = parseInt(document.getElementById('pApt')?.value)||null;
  payload.aktivan = document.getElementById('pAktivan')?.checked ?? true;
  const { error } = await sb.from('pravila_kalendara').insert([payload]);
  if (error) { alert('Greška: '+error.message); return; }
  closeModal('praviloModal');
  loadPravila();
}

async function deletePravilo(id) {
  showConfirm('🗑️','Brisanje pravila','Ovo pravilo bit će trajno obrisano.', async ()=>{
    await sb.from('pravila_kalendara').delete().eq('id',id);
    loadPravila();
  });
}

// ══════════════════════════════════════
// ATRAKCIJE
// ══════════════════════════════════════
async function loadAtrakcije() {
  const { data } = await sb.from('atrakcije').select('*').order('redoslijed');
  const katLabels = {silo:'Šilo i okolica',kultura:'Krk i kultura',izleti:'Izleti',plaze:'Plaže'};
  document.getElementById('atrakBody').innerHTML = (data||[]).length ?
    (data||[]).map(a=>`<tr>
      <td>${a.ikonica||''} <strong>${a.naziv}</strong></td>
      <td>${katLabels[a.kategorija]||a.kategorija}</td>
      <td>${a.aktivan?'<span class="badge badge-green">Da</span>':'<span class="badge badge-grey">Ne</span>'}</td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deleteAtrak('${a.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="4" class="loading">Nema atrakcija.</td></tr>';
}

function openAtrakModal() { /* TODO */ }
async function deleteAtrak(id) {
  showConfirm('🗑️','Brisanje atrakcije','Ova atrakcija bit će trajno obrisana.', async ()=>{
    await sb.from('atrakcije').delete().eq('id',id);
    loadAtrakcije();
  });
}

// ══════════════════════════════════════
// RECENZIJE
// ══════════════════════════════════════
async function loadRecenzije() {
  const { data } = await sb.from('recenzije').select('*').order('created_at',{ascending:false});
  document.getElementById('recBody').innerHTML = (data||[]).length ?
    (data||[]).map(r=>`<tr>
      <td><strong>${r.ime}</strong></td>
      <td>${'★'.repeat(r.ocjena)}${'☆'.repeat(5-r.ocjena)}</td>
      <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.tekst}</td>
      <td>${r.aktivan?'<span class="badge badge-green">Da</span>':'<span class="badge badge-grey">Ne</span>'}</td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deleteRec('${r.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="loading">Nema recenzija.</td></tr>';
}
function openRecModal() { /* TODO */ }
async function deleteRec(id) {
  showConfirm('🗑️','Brisanje recenzije','Ova recenzija bit će trajno obrisana.', async ()=>{
    await sb.from('recenzije').delete().eq('id',id);
    loadRecenzije();
  });
}

// ══════════════════════════════════════
// OPĆI PODACI
// ══════════════════════════════════════
async function saveOpcenito() {
  await sb.from('sadrzaj').upsert([
    {kljuc:'checkin_vrijeme', vrijednost:document.getElementById('checkinVrijeme').value},
    {kljuc:'checkout_vrijeme', vrijednost:document.getElementById('checkoutVrijeme').value}
  ],{onConflict:'kljuc'});
  showToast('✅ Podaci spremljeni!');
}

// ══════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════
function setCntSection(sec, el) {
  document.querySelectorAll('.cnt-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  ['baner','popup','cijene','apartmani','istrazi','opcenito','recenzije'].forEach(s=>{
    const el2 = document.getElementById('cnt-'+s);
    if(el2) el2.style.display = s===sec?'block':'none';
  });
  if(sec==='popup') loadPopup();
  if(sec==='istrazi') loadAtrakcije();
  if(sec==='recenzije') loadRecenzije();
}

function setPostavkeTab(tab, el) {
  document.querySelectorAll('#page-postavke .cnt-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  ['minBoravak','korekcija','blokirano'].forEach(t=>{
    const e=document.getElementById('postavke-'+t);
    if(e) e.style.display=t===tab?'block':'none';
  });
}

function setAptTab(n, el) {
  document.querySelectorAll('#aptContentTabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('aptContentBody').innerHTML = `
    <div class="notice notice-info">✏️ Uređivanje sadržaja apartmana ${n} – uskoro dostupno.</div>`;
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showConfirm(ico, title, msg, cb) {
  confirmCallback = cb;
  document.getElementById('confirmIco').textContent = ico;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirm() { document.getElementById('confirmModal').classList.remove('open'); confirmCallback=null; }
async function confirmOk() {
  const cb = confirmCallback;
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
  if (cb) await cb();
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if(e.target===m) m.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if(e.key==='Escape') {
    document.querySelectorAll('.modal-overlay.open,.confirm-modal.open').forEach(m=>m.classList.remove('open'));
  }
});

// Toast notification
function showToast(msg) {
  let t = document.getElementById('toast');
  if(!t) { t=document.createElement('div'); t.id='toast'; t.style.cssText='position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:.7rem 1.4rem;border-radius:2px;font-size:.82rem;z-index:9999;opacity:0;transition:opacity .3s'; document.body.appendChild(t); }
  t.textContent=msg; t.style.opacity='1';
  setTimeout(()=>t.style.opacity='0', 3000);
}

// Hamburger menu
if (window.innerWidth <= 900) document.getElementById('hamburger').style.display='block';

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'admin-login.html';
}

let unreadMessagesCache = 0;

function buildAlertSummaryText(upitCount, unreadMessageCount) {
  const parts = [];
  if (upitCount > 0) parts.push(upitCount === 1 ? '1 nepotvrđenu rezervaciju' : `${upitCount} nepotvrđenih rezervacija`);
  if (unreadMessageCount > 0) parts.push(unreadMessageCount === 1 ? '1 nepročitanu poruku' : `${unreadMessageCount} nepročitanih poruka`);
  return parts.length ? `Imate ${parts.join(' i ')}` : '';
}

updateUpitIndicators = function(records, unreadMessageCount = unreadMessagesCache) {
  const pending = (records || []).filter(r => normalizeRezStatus(r.status) === 'upit');
  const count = pending.length;
  const summaryText = buildAlertSummaryText(count, unreadMessageCount);
  const nav = document.getElementById('navUpitCount');
  const porukeNavItem = document.querySelector('.nav-item[onclick="showPage(\'poruke\')"]');
  let navPoruke = document.getElementById('navPorukeCount');
  if (!navPoruke && porukeNavItem) {
    navPoruke = document.createElement('span');
    navPoruke.id = 'navPorukeCount';
    navPoruke.className = 'nav-pill';
    navPoruke.style.display = 'none';
    navPoruke.textContent = '0';
    porukeNavItem.insertBefore(navPoruke, porukeNavItem.firstChild);
  }
  const chip = document.getElementById('topbarUpitChip');
  const chipText = document.getElementById('topbarUpitText');
  const notice = document.getElementById('upitNotice');
  const noticeText = document.getElementById('upitNoticeText');
  const hasAnyAlerts = count > 0 || unreadMessageCount > 0;

  if (nav) {
    nav.textContent = count;
    nav.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (navPoruke) {
    navPoruke.textContent = unreadMessageCount;
    navPoruke.style.display = unreadMessageCount > 0 ? 'inline-flex' : 'none';
  }
  if (chip && chipText) {
    chip.style.display = hasAnyAlerts ? 'inline-flex' : 'none';
    chip.classList.toggle('attention', hasAnyAlerts);
    chipText.textContent = summaryText;
  }
  if (notice && noticeText) {
    notice.style.display = hasAnyAlerts ? 'flex' : 'none';
    notice.classList.toggle('notice-warn', hasAnyAlerts);
    notice.classList.toggle('notice-info', false);
    notice.classList.toggle('attention', hasAnyAlerts);
    noticeText.textContent = hasAnyAlerts ? `${summaryText}.` : '';
  }
  if (typeof renderPendingList === 'function') renderPendingList(pending);
};

refreshUpitIndicators = async function() {
  const { data } = await sb.from('rezervacije').select('id, ime, apartman, status, created_at, datum_dolaska').eq('status','upit');
  try {
    const { data: porukeData, error: porukeError } = await sb.from('poruke').select('*');
    if (!porukeError) {
      unreadMessagesCache = (porukeData || []).filter(p => {
        const status = String(p.status || '').trim().toLowerCase();
        return p.procitano === false || status === 'nova' || status === 'neprocitano';
      }).length;
    } else {
      unreadMessagesCache = 0;
    }
  } catch (err) {
    unreadMessagesCache = 0;
  }
  updateUpitIndicators(data || [], unreadMessagesCache);
};

async function loadPoruke() {
  const rezWrap = document.getElementById('porukeRezBody');
  const obicneWrap = document.getElementById('porukeObicneBody');
  if (rezWrap) {
    const rezervacije = (allRezervacije || []).filter(r => normalizeRezStatus(r.status) === 'upit');
    rezWrap.innerHTML = rezervacije.length ? rezervacije.map(r => `
      <div class="pending-card">
        <div class="pending-main">
          <strong>${escapeHtml(r.ime || 'Gost')}</strong>
          <div>${aptLabel(r.apartman)} • ${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
          <div>${escapeHtml(r.komentar || 'Bez dodatne poruke.')}</div>
        </div>
        <div class="pending-meta">
          <div>Status: Upit</div>
          <div>Original poruke je prikazan gore.</div>
        </div>
        <div class="pending-actions">
          <button class="btn btn-secondary btn-sm" onclick='editRezervacija(${JSON.stringify(r)})'>Otvori</button>
        </div>
      </div>
    `).join('') : '<div class="pending-empty">Trenutno nema rezervacijskih upita.</div>';
  }
  if (obicneWrap) {
    try {
      const { data, error } = await sb.from('poruke').select('*').order('created_at', { ascending: false });
      if (error) {
        obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
      } else {
        obicneWrap.innerHTML = (data || []).length ? (data || []).map(p => `
          <div class="pending-card">
            <div class="pending-main">
              <strong>${escapeHtml(p.ime || 'Gost')}</strong>
              <div>${escapeHtml(p.email || 'Bez emaila')}</div>
              <div>${escapeHtml(p.original_text || p.poruka || 'Bez poruke')}</div>
              <div style="margin-top:.35rem;color:var(--navy)"><strong>${escapeHtml(translatedFromSourceLabel(p.original_language || p.jezik || p.language || 'hr'))}</strong> ${escapeHtml(p.translated_text_hr || 'Prijevod će se prikazati nakon spajanja servisa za prijevod.')}</div>
            </div>
            <div class="pending-meta">
              <div>Jezik: ${escapeHtml((p.jezik || p.language || 'nepoznat').toUpperCase())}</div>
              <div>Status: ${escapeHtml(p.status || 'nova')}</div>
            </div>
            <div class="pending-actions"></div>
          </div>
        `).join('') : '<div class="pending-empty">Trenutno nema običnih poruka.</div>';
      }
    } catch (err) {
      obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
    }
  }
}

function setPorukeTab(tab, el) {
  currentPorukeTab = tab;
  document.querySelectorAll('#porukeTabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('poruke-rezervacije').style.display = tab === 'rezervacije' ? 'block' : 'none';
  document.getElementById('poruke-obicne').style.display = tab === 'obicne' ? 'block' : 'none';
}

filterGosti = function() {
  const ime = document.getElementById('filterIme').value.toLowerCase();
  const apt = document.getElementById('filterApt').value;
  const izvor = document.getElementById('filterIzvor').value;
  const status = document.getElementById('filterStatus').value;
  const od = document.getElementById('filterDatumOd').value;
  const do_ = document.getElementById('filterDatumDo').value;
  const god = document.getElementById('filterGodina').value;

  let filtered = allRezervacije.filter(r => {
    if (ime && !String(r.ime || '').toLowerCase().includes(ime)) return false;
    if (apt && r.apartman != apt) return false;
    if (izvor && r.izvor !== izvor) return false;
    if (status && normalizeRezStatus(r.status) !== status) return false;
    if (od && r.datum_dolaska < od) return false;
    if (do_ && r.datum_dolaska > do_) return false;
    if (god && new Date(r.datum_dolaska).getFullYear() != god) return false;
    return true;
  });

  const tbody = document.getElementById('gostiBody');
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty"><div class="ico">👥</div><p>Nema gostiju koji odgovaraju filteru.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const zarada = rezZarada(r);
    const zaradaCls = r.zarada_je_rucna ? 'zarada-rucna' : '';
    const statusNorm = normalizeRezStatus(r.status);
    const zaradaPrikaz = statusNorm === 'otkazano' ? '–' : fmtEur(zarada);
    return `<tr>
      <td><strong>${escapeHtml(r.ime || '')}</strong></td>
      <td>${aptLabel(r.apartman)}</td>
      <td>${fmtDate(r.datum_dolaska)}</td>
      <td>${fmtDate(r.datum_odlaska)}</td>
      <td>${r.broj_osoba || '–'}</td>
      <td>${izvorBadge(r.izvor)}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="${statusNorm === 'otkazano' ? '' : zaradaCls}">${zaradaPrikaz}</td>
      <td>${racunCell(r)}</td>
      <td>${dokumentCell(r)}</td>
      <td><button class="btn btn-secondary btn-sm btn-icon" onclick='editRezervacija(${JSON.stringify(r)})'>✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRez('${r.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
};

function syncArrivalAndPendingCards() {
  const statsGrid = document.getElementById('kalendarStats');
  if (!statsGrid) return;
  const cards = statsGrid.querySelectorAll('.stat-card');
  const arrivalsCard = cards[0];
  const pendingCard = cards[1];

  if (arrivalsCard) {
    const label = arrivalsCard.querySelector('.label');
    const sub = arrivalsCard.querySelector('.sub');
    const title = arrivalsCard.querySelector('.cleaning-box h4');
    if (label) label.textContent = 'Dolasci';
    if (sub) sub.textContent = 'pregled realiziranih, najavljenih i potencijalnih dolazaka';
    if (title) title.textContent = 'Dolasci u idućih 7 dana';

    const mini = arrivalsCard.querySelector('.cleaning-mini');
    if (mini) {
      if (!document.getElementById('kPotentialArrivals')) {
        mini.insertAdjacentHTML('beforeend', '<div class="cleaning-row"><span>Broj potencijalnih dolazaka</span><strong id="kPotentialArrivals">–</strong></div>');
      }
      const rows = mini.querySelectorAll('.cleaning-row span');
      if (rows[0]) rows[0].textContent = 'Realizirani dolasci';
      if (rows[1]) rows[1].textContent = 'Broj najavljenih dolazaka';
    }
  }

  if (pendingCard) {
    const label = pendingCard.querySelector('.label');
    const value = pendingCard.querySelector('.value');
    const sub = pendingCard.querySelector('.sub');
    if (label) label.textContent = 'Upiti';
    if (value) value.remove();
    if (sub) sub.textContent = 'nepotvrđene rezervacije';
    if (!document.getElementById('pendingList')) {
      pendingCard.insertAdjacentHTML('beforeend', '<div class="pending-list" id="pendingList"><div class="loading">Učitavanje...</div></div>');
    }
  }
}

renderPendingList = function(pending) {
  syncArrivalAndPendingCards();
  const wrap = document.getElementById('pendingList');
  if (!wrap) return;

  const items = (pending || [])
    .slice()
    .sort((a, b) => new Date(a.datum_dolaska) - new Date(b.datum_dolaska));

  if (!items.length) {
    wrap.innerHTML = '<div class="pending-empty">Trenutno nema nepotvrđenih upita.</div>';
    return;
  }

  wrap.innerHTML = items.map(r => {
    const adults = parseInt(r.broj_osoba || 0, 10) || 0;
    const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
    const guestsLabel = children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
    return `<div class="pending-card">
      <div class="pending-main">
        <strong>${escapeHtml(r.ime || 'Gost')}</strong>
        <div>${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
      </div>
      <div class="pending-meta">
        <div>${aptLabel(r.apartman)}</div>
        <div>${escapeHtml(guestsLabel)}</div>
      </div>
      <div class="pending-actions">
        <button class="btn btn-secondary btn-sm" onclick='openRezById("${escapeHtml(r.id)}")'>Otvori</button>
      </div>
    </div>`;
  }).join('');
};

loadKalendarStats = async function() {
  syncArrivalAndPendingCards();
  const { data } = await sb.from('rezervacije').select('*').in('status',['potvrdjeno','upit']);
  if (!data) return;

  const now = new Date();
  const today = new Date();
  today.setHours(0,0,0,0);

  const confirmed = data.filter(r => normalizeRezStatus(r.status) === 'potvrdjeno');
  const pending = data.filter(r => normalizeRezStatus(r.status) === 'upit');

  const arrivals = confirmed
    .map(r => {
      const arrivalMoment = new Date(`${r.datum_dolaska}T15:00:00`);
      return { ...r, arrivalMoment };
    })
    .sort((a, b) => a.arrivalMoment - b.arrivalMoment);

  const realizedArrivals = arrivals.filter(r => r.arrivalMoment <= now);
  const futureArrivals = arrivals.filter(r => r.arrivalMoment > now);
  const next7Limit = new Date(today);
  next7Limit.setDate(next7Limit.getDate() + 7);
  const next7Arrivals = futureArrivals.filter(r => {
    const arrivalDate = new Date(r.datum_dolaska);
    arrivalDate.setHours(0,0,0,0);
    return arrivalDate >= today && arrivalDate < next7Limit;
  });

  const trenutno = confirmed.filter(r => {
    const d1 = new Date(r.datum_dolaska);
    const d2 = new Date(r.datum_odlaska);
    return d1 <= today && d2 > today;
  });

  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  let zauzetoDana = 0;
  confirmed.forEach(r => {
    const d1 = new Date(r.datum_dolaska);
    const d2 = new Date(r.datum_odlaska);
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const start = d1 < mStart ? mStart : d1;
    const end = d2 > mEnd ? mEnd : d2;
    if (start < end) zauzetoDana += Math.round((end - start) / 86400000);
  });
  const popunjenost = Math.round(zauzetoDana / (daysInMonth * 4) * 100);

  const next7Wrap = document.getElementById('kCleaningNext7');
  if (next7Wrap) {
    next7Wrap.innerHTML = next7Arrivals.length
      ? next7Arrivals.map(r => {
          const adults = parseInt(r.broj_osoba || 0, 10) || 0;
          const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
          const guestsLabel = children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
          return `<div class="cleaning-item">${fmtDate(r.datum_dolaska)} • ${aptLabel(r.apartman)} • ${escapeHtml(r.ime || 'Gost')} • ${escapeHtml(guestsLabel)}</div>`;
        }).join('')
      : '<div class="cleaning-empty">Nema dolazaka u idućih 7 dana.</div>';
  }

  const realizedEl = document.getElementById('kCleaningDone');
  if (realizedEl) realizedEl.textContent = realizedArrivals.length;
  const futureEl = document.getElementById('kCleaningFuture');
  if (futureEl) futureEl.textContent = futureArrivals.length;
  const potentialEl = document.getElementById('kPotentialArrivals');
  if (potentialEl) potentialEl.textContent = pending.length;
  const trenutnoEl = document.getElementById('kTrenutno');
  if (trenutnoEl) trenutnoEl.textContent = trenutno.length;
  const popunjenostEl = document.getElementById('kPopunjenost');
  if (popunjenostEl) popunjenostEl.textContent = `${popunjenost}%`;
};

loadPoruke = async function() {
  const infoNotice = document.querySelector('#page-poruke .notice.notice-info');
  if (infoNotice) infoNotice.textContent = 'Original poruke se uvijek spremaju i šalju na mail. Prijevod se prikazuje kad je dostupan, a ako nije, original ostaje vidljiv.';
  const porukeTabs = document.querySelectorAll('#porukeTabs .tab');
  if (porukeTabs[0]) porukeTabs[0].textContent = 'Rezervacije';
  if (porukeTabs[1]) porukeTabs[1].textContent = 'Poruke';
  const rezWrap = document.getElementById('porukeRezBody');
  const obicneWrap = document.getElementById('porukeObicneBody');

  if (rezWrap) {
    const rezervacije = (allRezervacije || [])
      .filter(r => normalizeRezStatus(r.status) === 'upit')
      .sort((a, b) => new Date(a.datum_dolaska) - new Date(b.datum_dolaska));

    rezWrap.innerHTML = rezervacije.length ? rezervacije.map(r => {
      const adults = parseInt(r.broj_osoba || 0, 10) || 0;
      const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
      const guestsLabel = children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
      return `
        <div class="pending-card">
          <div class="pending-main">
            <strong>${escapeHtml(r.ime || 'Gost')}</strong>
            <div>${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
            <div>${escapeHtml(r.komentar || 'Bez dodatne poruke.')}</div>
          </div>
          <div class="pending-meta">
            <div>${aptLabel(r.apartman)}</div>
            <div>${escapeHtml(guestsLabel)}</div>
          </div>
          <div class="pending-actions">
            <button class="btn btn-secondary btn-sm" onclick='openRezById("${escapeHtml(r.id)}")'>Otvori</button>
          </div>
        </div>
      `;
    }).join('') : '<div class="pending-empty">Trenutno nema rezervacijskih upita.</div>';
  }

  if (obicneWrap) {
    try {
      const { data, error } = await sb.from('poruke').select('*').order('created_at', { ascending: false });
      if (error) {
        obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
      } else {
        obicneWrap.innerHTML = (data || []).length ? (data || []).map(p => `
          <div class="pending-card">
            <div class="pending-main">
              <strong>${escapeHtml(p.ime || 'Gost')}</strong>
              <div>${escapeHtml(p.email || 'Bez emaila')}</div>
              <div>${escapeHtml(p.original_text || p.poruka || 'Bez poruke')}</div>
              <div style="margin-top:.35rem;color:var(--navy)"><strong>${escapeHtml(translatedFromSourceLabel(p.original_language || p.jezik || p.language || 'hr'))}</strong> ${escapeHtml(p.translated_text_hr || 'Prijevod će se prikazati nakon spajanja servisa za prijevod.')}</div>
            </div>
            <div class="pending-meta">
              <div>Jezik: ${escapeHtml((p.jezik || p.language || p.original_language || 'nepoznat').toUpperCase())}</div>
              <div>Status: ${escapeHtml(p.status || 'nova')}</div>
            </div>
            <div class="pending-actions">
              <button class="btn btn-secondary btn-sm" onclick='togglePorukaRead("${escapeHtml(p.id)}", ${p.procitano === false ? "true" : "false"})'>${p.procitano === false ? 'Označi pročitano' : 'Označi nepročitano'}</button>
              <button class="btn btn-secondary btn-sm" onclick='replyToPoruka(${JSON.stringify({
                id: p.id,
                ime: p.ime || '',
                email: p.email || '',
                jezik: p.jezik || p.language || p.original_language || '',
                poruka: p.original_text || p.poruka || ''
              })})'>Odgovori</button>
            </div>
          </div>
        `).join('') : '<div class="pending-empty">Trenutno nema običnih poruka.</div>';
      }
    } catch (err) {
      obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
    }
  }
};

window.togglePorukaRead = async function(id, nextReadState) {
  try {
    await sb.from('poruke').update({
      procitano: nextReadState,
      status: nextReadState ? 'procitano' : 'neprocitano'
    }).eq('id', id);
    await refreshUpitIndicators();
    if (currentPageName === 'poruke') await loadPoruke();
  } catch (err) {
    alert('Promjena statusa poruke nije uspjela.');
  }
};

const selectedGuestEmails = new Set();

function setupGostiBulkEmailUi() {
  const gostiHead = document.querySelector('#page-gosti .card-head');
  if (gostiHead && !document.getElementById('bulkEmailBtn')) {
    const btn = document.createElement('button');
    btn.id = 'bulkEmailBtn';
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = 'Pošalji email označenima';
    btn.onclick = openBulkEmailModal;
    gostiHead.insertBefore(btn, gostiHead.querySelector('.btn-primary'));
  }

  const tableHeadRow = document.querySelector('#gostiTable thead tr');
  if (tableHeadRow && !document.getElementById('gostiSelectAllTh')) {
    const th = document.createElement('th');
    th.id = 'gostiSelectAllTh';
    th.innerHTML = '<input type="checkbox" id="gostiSelectAll" onchange="toggleSelectAllGuests(this.checked)">';
    tableHeadRow.insertBefore(th, tableHeadRow.firstElementChild);
  }

  if (!document.getElementById('bulkEmailModal')) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'bulkEmailModal';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head">
          <h3>Pošalji email označenima</h3>
          <button class="modal-close" onclick="closeModal('bulkEmailModal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="fg full">
              <label>Primatelji</label>
              <div id="bulkEmailRecipients" style="font-size:.82rem;color:var(--muted);line-height:1.6">Nema označenih gostiju.</div>
            </div>
            <div class="fg full">
              <label>Predmet</label>
              <input type="text" id="bulkEmailSubject" placeholder="Predmet emaila">
            </div>
            <div class="fg full">
              <label>Poruka</label>
              <textarea id="bulkEmailBody" placeholder="Upišite poruku..."></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkEmailModal')">Odustani</button>
          <button class="btn btn-primary" onclick="sendBulkEmailDraft()">Otvori email</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

window.toggleGuestEmailSelection = function(email, checked) {
  const clean = String(email || '').trim();
  if (!clean) return;
  if (checked) selectedGuestEmails.add(clean);
  else selectedGuestEmails.delete(clean);
  syncBulkEmailButton();
};

window.toggleSelectAllGuests = function(checked) {
  document.querySelectorAll('.gosti-email-select').forEach(cb => {
    cb.checked = checked;
    const email = cb.getAttribute('data-email');
    if (checked) selectedGuestEmails.add(email);
    else selectedGuestEmails.delete(email);
  });
  syncBulkEmailButton();
};

function syncBulkEmailButton() {
  const btn = document.getElementById('bulkEmailBtn');
  if (btn) btn.textContent = selectedGuestEmails.size ? `Pošalji email označenima (${selectedGuestEmails.size})` : 'Pošalji email označenima';
  const recipients = document.getElementById('bulkEmailRecipients');
  if (recipients) recipients.textContent = selectedGuestEmails.size ? Array.from(selectedGuestEmails).join(', ') : 'Nema označenih gostiju.';
}

window.openBulkEmailModal = function() {
  setupGostiBulkEmailUi();
  syncBulkEmailButton();
  if (!selectedGuestEmails.size) {
    alert('Označite barem jednog gosta s email adresom.');
    return;
  }
  openModal('bulkEmailModal');
};

window.sendBulkEmailDraft = function() {
  const recipients = Array.from(selectedGuestEmails);
  if (!recipients.length) {
    alert('Nema označenih gostiju s email adresom.');
    return;
  }
  const subject = encodeURIComponent(document.getElementById('bulkEmailSubject')?.value || '');
  const body = encodeURIComponent(document.getElementById('bulkEmailBody')?.value || '');
  window.location.href = `mailto:${recipients.map(encodeURIComponent).join(',')}?subject=${subject}&body=${body}`;
};

filterGosti = function() {
  const ime = document.getElementById('filterIme').value.toLowerCase();
  const apt = document.getElementById('filterApt').value;
  const izvor = document.getElementById('filterIzvor').value;
  const status = document.getElementById('filterStatus').value;
  const od = document.getElementById('filterDatumOd').value;
  const do_ = document.getElementById('filterDatumDo').value;
  const god = document.getElementById('filterGodina').value;

  const filtered = allRezervacije.filter(r => {
    if (ime && !String(r.ime || '').toLowerCase().includes(ime)) return false;
    if (apt && r.apartman != apt) return false;
    if (izvor && r.izvor !== izvor) return false;
    if (status && normalizeRezStatus(r.status) !== status) return false;
    if (od && r.datum_dolaska < od) return false;
    if (do_ && r.datum_dolaska > do_) return false;
    if (god && new Date(r.datum_dolaska).getFullYear() != god) return false;
    return true;
  });

  const tbody = document.getElementById('gostiBody');
  if (!tbody) return;
  setupGostiBulkEmailUi();

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty"><div class="ico">👥</div><p>Nema gostiju koji odgovaraju filteru.</p></div></td></tr>';
    syncBulkEmailButton();
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const zarada = rezZarada(r);
    const zaradaCls = r.zarada_je_rucna ? 'zarada-rucna' : '';
    const statusNorm = normalizeRezStatus(r.status);
    const zaradaPrikaz = statusNorm === 'otkazano' ? '–' : fmtEur(zarada);
    const email = String(r.email || '').trim();
    const checked = email && selectedGuestEmails.has(email) ? 'checked' : '';
    const checkbox = email ? `<input type="checkbox" class="gosti-email-select" data-email="${escapeHtml(email)}" ${checked} onchange='toggleGuestEmailSelection("${escapeHtml(email)}", this.checked)'>` : '–';
    return `<tr>
      <td>${checkbox}</td>
      <td><strong>${escapeHtml(r.ime || '')}</strong></td>
      <td>${aptLabel(r.apartman)}</td>
      <td>${fmtDate(r.datum_dolaska)}</td>
      <td>${fmtDate(r.datum_odlaska)}</td>
      <td>${r.broj_osoba || '–'}</td>
      <td>${izvorBadge(r.izvor)}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="${statusNorm === 'otkazano' ? '' : zaradaCls}">${zaradaPrikaz}</td>
      <td>${racunCell(r)}</td>
      <td>${dokumentCell(r)}</td>
      <td><button class="btn btn-secondary btn-sm btn-icon" onclick='editRezervacija(${JSON.stringify(r)})'>✎</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRez('${r.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
  syncBulkEmailButton();
};

setupGostiBulkEmailUi();
syncBulkEmailButton();

function ensurePorukeNavBadgeFinal() {
  let navPoruke = document.getElementById('navPorukeCount');
  if (navPoruke) return navPoruke;
  const porukeNavItem = Array.from(document.querySelectorAll('.sidebar-nav .nav-item'))
    .find(el => (el.textContent || '').includes('Poruke'));
  if (!porukeNavItem) return null;
  navPoruke = document.createElement('span');
  navPoruke.id = 'navPorukeCount';
  navPoruke.className = 'nav-pill';
  navPoruke.style.display = 'none';
  navPoruke.textContent = '0';
  porukeNavItem.insertBefore(navPoruke, porukeNavItem.firstChild);
  return navPoruke;
}

updateUpitIndicators = function(records, unreadMessageCount = unreadMessagesCache) {
  const pending = (records || []).filter(r => normalizeRezStatus(r.status) === 'upit');
  const upitCount = pending.length;
  const porukaCount = unreadMessageCount || 0;
  const summaryText = buildAlertSummaryText(upitCount, porukaCount);
  const navUpiti = document.getElementById('navUpitCount');
  const navPoruke = ensurePorukeNavBadgeFinal();
  const chip = document.getElementById('topbarUpitChip');
  const chipText = document.getElementById('topbarUpitText');
  const notice = document.getElementById('upitNotice');
  const noticeText = document.getElementById('upitNoticeText');
  const hasAnyAlerts = upitCount > 0 || porukaCount > 0;

  if (navUpiti) {
    navUpiti.textContent = upitCount;
    navUpiti.style.display = upitCount > 0 ? 'inline-flex' : 'none';
  }
  if (navPoruke) {
    navPoruke.textContent = porukaCount;
    navPoruke.style.display = porukaCount > 0 ? 'inline-flex' : 'none';
  }
  if (chip && chipText) {
    chip.style.display = hasAnyAlerts ? 'inline-flex' : 'none';
    chip.classList.toggle('attention', hasAnyAlerts);
    chipText.textContent = summaryText;
  }
  if (notice && noticeText) {
    notice.style.display = hasAnyAlerts ? 'flex' : 'none';
    notice.classList.toggle('notice-warn', hasAnyAlerts);
    notice.classList.toggle('notice-info', false);
    notice.classList.toggle('attention', hasAnyAlerts);
    noticeText.textContent = hasAnyAlerts ? `${summaryText}.` : '';
  }
  if (typeof renderPendingList === 'function') renderPendingList(pending);
};

async function balentTranslateViaGoogle(clean, source, target) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source || 'auto')}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
    return data[0].map(part => Array.isArray(part) ? (part[0] || '') : '').join('').trim();
  } catch (err) {
    console.warn('Google translation unavailable:', err);
    return '';
  }
}

const balentTranslate = async (text, fromLang, toLang = 'hr') => {
  const clean = String(text || '').trim();
  if (!clean) return '';
  const source = String(fromLang || 'hr').toLowerCase();
  const target = String(toLang || 'hr').toLowerCase();
  if (source === target) return clean;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    const translated = data?.responseData?.translatedText?.trim();
    if (translated) return translated;
  } catch (err) {
    console.warn('Translation unavailable:', err);
  }
  return await balentTranslateViaGoogle(clean, source, target);
};

async function balentTranslateWithDetection(text, fromLang, toLang = 'hr') {
  const clean = String(text || '').trim();
  if (!clean) return { translated: '', detectedLang: String(fromLang || 'hr').toLowerCase() };
  const source = String(fromLang || 'auto').toLowerCase();
  const target = String(toLang || 'hr').toLowerCase();
  if (source !== 'auto' && source === target) return { translated: clean, detectedLang: source };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source || 'auto')}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map(part => Array.isArray(part) ? (part[0] || '') : '').join('').trim();
      let detectedLang = String(data?.[2] || source || 'auto').toLowerCase();
      if (source === 'auto' && (!detectedLang || detectedLang === 'auto' || detectedLang === 'hr')) {
        detectedLang = detectLikelyLanguage(clean, detectedLang || 'hr');
      }
      if (translated) return { translated, detectedLang };
    }
  } catch (err) {
    console.warn('Google detection unavailable:', err);
  }
  const guessedLang = detectLikelyLanguage(clean, source === 'auto' ? 'hr' : source);
  let translated = await balentTranslate(clean, source, target);
  if ((!translated || translated === clean) && guessedLang && guessedLang !== 'hr' && guessedLang !== source) {
    translated = await balentTranslate(clean, guessedLang, target);
  }
  return { translated, detectedLang: guessedLang };
}

function detectLikelyLanguage(text, fallback = 'hr') {
  const clean = String(text || '').toLowerCase();
  if (!clean) return fallback;
  const score = (patterns) => patterns.reduce((sum, pattern) => sum + (pattern.test(clean) ? 1 : 0), 0);
  const scores = {
    en: score([/\bhello\b/, /\bnice to see you\b/, /\bthank you\b/, /\bplease\b/, /\bapartment\b/, /\bbooking\b/]),
    cs: score([/\bdobr(ý|y) den\b/, /\bpros[ií]m\b/, /\bděkuji\b/, /\bubytov[aá]n[ií]\b/, /\brezervace\b/, /[čřžěš]/]),
    de: score([/\bguten tag\b/, /\bdanke\b/, /\bbitte\b/, /\bwohnung\b/, /\bbuchung\b/, /[äöüß]/]),
    it: score([/\bciao\b/, /\bgrazie\b/, /\bprenotazione\b/, /\bappartamento\b/, /\bbuongiorno\b/])
  };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : fallback;
}

function langNameHr(code) {
  const key = String(code || '').toLowerCase();
  return ({
    hr: 'hrvatskog',
    en: 'engleskog',
    de: 'njemačkog',
    it: 'talijanskog',
    ru: 'ruskog',
    cs: 'češkog',
    sk: 'slovačkog',
    sl: 'slovenskog',
    pl: 'poljskog',
    hu: 'mađarskog',
    fr: 'francuskog',
    es: 'španjolskog',
    nl: 'nizozemskog',
    uk: 'ukrajinskog'
  })[key] || `jezika ${key.toUpperCase() || '??'}`;
}

function translatedFromSourceLabel(code) {
  return `Prevedeno s ${langNameHr(code)}:`;
}

async function translatedFromCroatianNote(code) {
  const key = String(code || 'hr').toLowerCase();
  if (key === 'hr') return '';
  const hardcoded = {
    en: 'Translated from Croatian.',
    de: 'Aus dem Kroatischen übersetzt.',
    it: 'Tradotto dal croato.',
    ru: 'Переведено с хорватского.',
    cs: 'Přeloženo z chorvatštiny.',
    sk: 'Preložené z chorvátčiny.',
    sl: 'Prevedeno iz hrvaščine.',
    pl: 'Przetłumaczono z chorwackiego.',
    hu: 'Horvátról fordítva.',
    fr: 'Traduit du croate.',
    es: 'Traducido del croata.',
    nl: 'Vertaald uit het Kroatisch.',
    uk: 'Перекладено з хорватської.'
  }[key];
  if (hardcoded) return hardcoded;
  return (await balentTranslate('Prevedeno s hrvatskog.', 'hr', key)) || 'Translated from Croatian.';
}

function parseRezKomentar(komentar) {
  const text = String(komentar || '').trim();
  const parsed = { email: '', phone: '', lang: '', original: '', translatedHr: '' };
  if (!text) return parsed;
  text.split('\n').forEach(line => {
    if (line.startsWith('Email: ')) parsed.email = line.slice(7).trim();
    else if (line.startsWith('Tel: ')) parsed.phone = line.slice(5).trim();
    else if (line.startsWith('Jezik: ')) parsed.lang = line.slice(7).trim().toLowerCase();
    else if (line.startsWith('Poruka: ')) parsed.original = line.slice(8).trim();
    else if (line.startsWith('Prijevod HR: ')) parsed.translatedHr = line.slice(13).trim();
  });
  if (!parsed.original && text) {
    parsed.original = text.replace(/^Email:.*$/m, '').replace(/^Tel:.*$/m, '').replace(/^Jezik:.*$/m, '').replace(/^Prijevod HR:.*$/m, '').trim();
  }
  return parsed;
}

function ensureReplyModal() {
  if (document.getElementById('replyModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'replyModal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h3>Odgovor na poruku</h3>
        <button class="modal-close" onclick="closeModal('replyModal')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="fg full">
            <label>Primatelj</label>
            <div id="replyRecipient" style="font-size:.82rem;color:var(--muted)"></div>
          </div>
          <div class="fg full">
            <label>Original poruke</label>
            <div id="replyOriginal" style="font-size:.82rem;color:var(--text);white-space:pre-wrap;line-height:1.6;background:var(--sand);padding:.8rem 1rem;border-radius:2px"></div>
          </div>
          <div class="fg full">
            <label>Odgovor na hrvatskom</label>
            <textarea id="replyBodyHr" placeholder="Upišite odgovor..."></textarea>
          </div>
          <div class="fg full">
            <label>Pregled prijevoda</label>
            <div id="replyTranslatedPreview" style="font-size:.82rem;color:var(--muted);white-space:pre-wrap;line-height:1.6;background:var(--sand);padding:.8rem 1rem;border-radius:2px">Prijevod će se prikazati prije otvaranja emaila.</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('replyModal')">Odustani</button>
        <button class="btn btn-secondary" onclick="sendReplyDraft()">Otvori email</button>
        <button class="btn btn-primary" id="replyDashboardSendBtn" onclick="sendReplyViaDashboard()">Pošalji iz dashboarda</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

let currentReplyPayload = null;

loadPoruke = async function() {
  const rezWrap = document.getElementById('porukeRezBody');
  const obicneWrap = document.getElementById('porukeObicneBody');

  if (rezWrap) {
    const rezervacije = (allRezervacije || [])
      .filter(r => normalizeRezStatus(r.status) === 'upit')
      .sort((a, b) => new Date(a.datum_dolaska) - new Date(b.datum_dolaska));

    const rezCards = await Promise.all(rezervacije.map(async r => {
      const meta = parseRezKomentar(r.komentar);
      const translatedInfo = meta.original ? await balentTranslateWithDetection(meta.original, (meta.lang && meta.lang !== 'hr') ? meta.lang : 'auto', 'hr') : { translated: '', detectedLang: meta.lang || 'hr' };
      const detectedLang = (meta.lang && meta.lang !== 'hr') ? meta.lang : (translatedInfo.detectedLang || meta.lang || 'hr');
      const translated = meta.translatedHr || translatedInfo.translated || '';
      const showTranslation = detectedLang && detectedLang !== 'hr' && translated && translated !== (meta.original || r.komentar || '');
      const adults = parseInt(r.broj_osoba || 0, 10) || 0;
      const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
      const guestsLabel = children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
      const replyBtn = meta.email ? `<button class="btn btn-secondary btn-sm" onclick='replyToPoruka(${JSON.stringify({ ime: r.ime || '', email: meta.email, jezik: detectedLang || 'hr', poruka: meta.original || r.komentar || '' })})'>Odgovori</button>` : '';
      return `
        <div class="pending-card">
          <div class="pending-main">
            <strong>${escapeHtml(r.ime || 'Gost')}</strong>
            <div>${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
            <div>${escapeHtml(meta.original || r.komentar || 'Bez dodatne poruke.')}</div>
            ${showTranslation ? `<div style="margin-top:.35rem;color:var(--navy)"><strong style="font-size:.82rem;font-weight:600">${escapeHtml(translatedFromSourceLabel(detectedLang || 'hr'))}</strong> <span style="font-size:.94rem">${escapeHtml(translated)}</span></div>` : ''}
          </div>
          <div class="pending-meta">
            <div>${aptLabel(r.apartman)}</div>
            <div>${escapeHtml(guestsLabel)}</div>
            <div>${meta.lang ? `Jezik: ${escapeHtml(meta.lang.toUpperCase())}` : 'Jezik: HR/—'}</div>
          </div>
          <div class="pending-actions">
            <button class="btn btn-secondary btn-sm" onclick='openRezById("${escapeHtml(r.id)}")'>Otvori</button>
            ${replyBtn}
          </div>
        </div>
      `;
    }));

    rezWrap.innerHTML = rezCards.length ? rezCards.join('') : '<div class="pending-empty">Trenutno nema rezervacijskih upita.</div>';
  }

  if (obicneWrap) {
    try {
      const { data, error } = await sb.from('poruke').select('*').order('created_at', { ascending: false });
      if (error) {
        obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
      } else {
        const rows = await Promise.all((data || []).map(async p => {
          const lang = String(p.jezik || p.language || p.original_language || 'hr').toLowerCase();
          let detectedLang = lang;
          let translatedHr = p.translated_text_hr || '';
          const originalMessage = String(p.original_text || p.poruka || '').trim();
          const hasFakeTranslation = !!translatedHr && !!originalMessage && translatedHr.trim() === originalMessage;
          if ((!translatedHr || hasFakeTranslation) && originalMessage) {
            const translatedInfo = await balentTranslateWithDetection(p.original_text || p.poruka, lang !== 'hr' ? lang : 'auto', 'hr');
            translatedHr = translatedInfo.translated || '';
            detectedLang = lang !== 'hr' ? lang : (translatedInfo.detectedLang || lang);
            if (translatedHr) {
              try {
                await sb.from('poruke').update({ translated_text_hr: translatedHr, original_language: detectedLang }).eq('id', p.id);
              } catch (err) {
                console.warn('Saving translation failed:', err);
              }
            }
          }
          const showTranslation = detectedLang && detectedLang !== 'hr' && translatedHr && translatedHr !== (p.original_text || p.poruka || '');
          return `
            <div class="pending-card">
              <div class="pending-main">
                <strong>${escapeHtml(p.ime || 'Gost')}</strong>
                <div>${escapeHtml(p.email || 'Bez emaila')}</div>
                <div>${escapeHtml(p.original_text || p.poruka || 'Bez poruke')}</div>
                ${showTranslation ? `<div style="margin-top:.35rem;color:var(--navy)"><strong style="font-size:.82rem;font-weight:600">${escapeHtml(translatedFromSourceLabel(detectedLang || 'hr'))}</strong> <span style="font-size:.94rem">${escapeHtml(translatedHr)}</span></div>` : ''}
              </div>
              <div class="pending-meta">
                <div>Jezik: ${escapeHtml(String(detectedLang || lang).toUpperCase())}</div>
                <div>Status: ${escapeHtml(p.status || 'nova')}</div>
              </div>
              <div class="pending-actions">
                <button class="btn btn-secondary btn-sm" onclick='togglePorukaRead("${escapeHtml(p.id)}", ${p.procitano === false ? "true" : "false"})'>${p.procitano === false ? 'Označi pročitano' : 'Označi nepročitano'}</button>
                <button class="btn btn-secondary btn-sm" onclick='replyToPoruka(${JSON.stringify({ ime: p.ime || '', email: p.email || '', jezik: detectedLang || lang, poruka: p.original_text || p.poruka || '' })})'>Odgovori</button>
              </div>
            </div>
          `;
        }));
        obicneWrap.innerHTML = rows.length ? rows.join('') : '<div class="pending-empty">Trenutno nema poruka.</div>';
      }
    } catch (err) {
      obicneWrap.innerHTML = '<div class="pending-empty">Obične poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
    }
  }
};

ensureReplyModal = function() {
  const existing = document.getElementById('replyModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'replyModal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h3>Odgovor na poruku</h3>
        <button class="modal-close" onclick="closeModal('replyModal')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="fg full">
            <label>Primatelj</label>
            <input type="email" id="replyRecipientEmail" placeholder="gost@email.com">
            <div id="replyRecipientMeta" style="font-size:.76rem;color:var(--muted);margin-top:.35rem"></div>
          </div>
          <div class="fg full">
            <label>Original poruke</label>
            <div id="replyOriginal" style="font-size:.82rem;color:var(--text);white-space:pre-wrap;line-height:1.6;background:var(--sand);padding:.8rem 1rem;border-radius:2px"></div>
          </div>
          <div class="fg full">
            <label>Odgovor na hrvatskom</label>
            <textarea id="replyBodyHr" placeholder="Upišite odgovor..."></textarea>
          </div>
          <div class="fg full">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap">
              <label id="replyPreviewLabel">Prijevod za slanje</label>
              <button type="button" class="btn btn-secondary btn-sm" id="replyTranslateBtn" onclick="previewReplyTranslation()">Prevedi odgovor</button>
            </div>
            <textarea id="replyTranslatedPreview" placeholder="Prijevod će se prikazati ovdje, a po potrebi ga možete ručno urediti."></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('replyModal')">Odustani</button>
        <button class="btn btn-primary" onclick="sendReplyDraft()">Otvori email</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.replyToPoruka = function(p) {
  const recipient = String(p?.email || '').trim();
  if (!recipient) {
    alert('Poruka nema email adresu za odgovor.');
    return;
  }
  ensureReplyModal();
  currentReplyPayload = {
    email: recipient,
    ime: p?.ime || 'Gost',
    jezik: String(p?.jezik || 'hr').toLowerCase(),
    poruka: p?.poruka || ''
  };
  document.getElementById('replyRecipientEmail').value = recipient;
  document.getElementById('replyRecipientMeta').textContent = `${currentReplyPayload.ime} • jezik: ${currentReplyPayload.jezik.toUpperCase()}`;
  document.getElementById('replyOriginal').textContent = currentReplyPayload.poruka || 'Bez originalne poruke.';
  document.getElementById('replyBodyHr').value = '';
  document.getElementById('replyTranslatedPreview').value = '';
  const previewLabel = document.getElementById('replyPreviewLabel');
  const translateBtn = document.getElementById('replyTranslateBtn');
  const previewField = document.getElementById('replyTranslatedPreview');
  if (currentReplyPayload.jezik === 'hr') {
    if (previewLabel) previewLabel.textContent = 'Poruka za slanje';
    if (translateBtn) translateBtn.style.display = 'none';
    if (previewField) previewField.placeholder = 'Poruka na hrvatskom bit će poslana bez prijevoda.';
  } else {
    if (previewLabel) previewLabel.textContent = 'Prijevod za slanje';
    if (translateBtn) translateBtn.style.display = '';
    if (previewField) previewField.placeholder = 'Prijevod će se prikazati ovdje, a po potrebi ga možete ručno urediti.';
  }
  openModal('replyModal');
};

window.previewReplyTranslation = async function() {
  const hrText = (document.getElementById('replyBodyHr')?.value || '').trim();
  if (!hrText) {
    alert('Upišite odgovor.');
    return;
  }
  const targetLang = currentReplyPayload?.jezik || 'hr';
  if (targetLang === 'hr') {
    document.getElementById('replyTranslatedPreview').value = hrText;
    return;
  }
  const translated = targetLang === 'hr' ? hrText : (await balentTranslate(hrText, 'hr', targetLang)) || hrText;
  const note = await translatedFromCroatianNote(targetLang);
  document.getElementById('replyTranslatedPreview').value = note ? `${note}\n\n${translated}` : translated;
};

window.sendReplyDraft = async function() {
  const recipient = (document.getElementById('replyRecipientEmail')?.value || '').trim();
  if (!recipient) {
    alert('Nema primatelja za odgovor.');
    return;
  }
  const hrText = (document.getElementById('replyBodyHr')?.value || '').trim();
  if (!hrText) {
    alert('Upišite odgovor.');
    return;
  }
  let translated = (document.getElementById('replyTranslatedPreview')?.value || '').trim();
  if (!translated) {
    const targetLang = currentReplyPayload?.jezik || 'hr';
    const translatedBody = targetLang === 'hr' ? hrText : (await balentTranslate(hrText, 'hr', targetLang)) || hrText;
    const note = await translatedFromCroatianNote(targetLang);
    translated = note ? `${note}\n\n${translatedBody}` : translatedBody;
    document.getElementById('replyTranslatedPreview').value = translated;
  }
  const subject = encodeURIComponent('Odgovor na vaš upit - Apartmani Balent');
  const body = encodeURIComponent(translated);
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
};

window.sendReplyViaDashboard = async function() {
  const recipient = (document.getElementById('replyRecipientEmail')?.value || '').trim();
  if (!recipient) {
    alert('Nema primatelja za odgovor.');
    return;
  }
  const hrText = (document.getElementById('replyBodyHr')?.value || '').trim();
  if (!hrText) {
    alert('Upišite odgovor.');
    return;
  }

  let translated = (document.getElementById('replyTranslatedPreview')?.value || '').trim();
  if (!translated) {
    const targetLang = currentReplyPayload?.jezik || 'hr';
    const translatedBody = targetLang === 'hr' ? hrText : (await balentTranslate(hrText, 'hr', targetLang)) || hrText;
    const note = await translatedFromCroatianNote(targetLang);
    translated = note ? `${note}\n\n${translatedBody}` : translatedBody;
    document.getElementById('replyTranslatedPreview').value = translated;
  }

  const btn = document.getElementById('replyDashboardSendBtn');
  const prevText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Slanje...';
  }

  try {
    const { data, error } = await sb.functions.invoke('send-gmail', {
      body: {
        to: recipient,
        subject: 'Odgovor na vaš upit - Apartmani Balent',
        text: translated,
        replyTo: 'ivana.balent1@gmail.com',
        meta: {
          guest_name: currentReplyPayload?.ime || '',
          language: currentReplyPayload?.jezik || 'hr',
          source: 'dashboard-reply'
        }
      }
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Slanje nije uspjelo.');

    alert('Email je poslan iz dashboarda.');
    closeModal('replyModal');
  } catch (err) {
    console.warn('Dashboard Gmail send failed:', err);
    alert('Slanje iz dashboarda trenutno nije dostupno. Otvorite email kao fallback dok ne završimo Gmail setup.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText || 'Pošalji iz dashboarda';
    }
  }
};

// Start
initApp();

(() => {
  const infoNotice = document.querySelector('#page-poruke .notice.notice-info');
  if (infoNotice) infoNotice.style.display = 'none';
})();

(() => {
  function renderInboxReservation(r, meta, detectedLang, translated, showTranslation, guestsLabel, replyBtn) {
    return `
      <div class="inbox-item unread">
        <div class="inbox-top">
          <div class="inbox-title">${escapeHtml(r.ime || 'Gost')}</div>
          <div class="inbox-date">${fmtDate(r.datum_dolaska)} - ${fmtDate(r.datum_odlaska)}</div>
        </div>
        <div class="inbox-meta">
          <span>${aptLabel(r.apartman)}</span>
          <span>${escapeHtml(guestsLabel)}</span>
          <span>${meta.lang ? `Jezik: ${escapeHtml((detectedLang || meta.lang).toUpperCase())}` : 'Jezik: HR/—'}</span>
        </div>
        <div class="inbox-body">${escapeHtml(meta.original || r.komentar || 'Bez dodatne poruke.')}</div>
        ${showTranslation ? `<div class="inbox-translation"><strong>${escapeHtml(translatedFromSourceLabel(detectedLang || 'hr'))}</strong><div>${escapeHtml(translated)}</div></div>` : ''}
        <div class="inbox-actions">
          <button class="btn btn-secondary btn-sm" onclick='openRezById("${escapeHtml(r.id)}")'>Otvori</button>
          ${replyBtn}
        </div>
      </div>
    `;
  }

  function renderInboxMessage(p, lang, detectedLang, translatedHr, showTranslation) {
    return `
      <div class="inbox-item ${p.procitano === false ? 'unread' : ''}">
        <div class="inbox-top">
          <div class="inbox-title">${escapeHtml(p.ime || 'Gost')}</div>
          <div class="inbox-date">${p.created_at ? escapeHtml(new Date(p.created_at).toLocaleDateString('hr-HR')) : ''}</div>
        </div>
        <div class="inbox-meta">
          <span>${escapeHtml(p.email || 'Bez emaila')}</span>
          <span>Jezik: ${escapeHtml(String(detectedLang || lang).toUpperCase())}</span>
          <span>Status: ${escapeHtml(p.status || 'nova')}</span>
        </div>
        <div class="inbox-body">${escapeHtml(p.original_text || p.poruka || 'Bez poruke')}</div>
        ${showTranslation ? `<div class="inbox-translation"><strong>${escapeHtml(translatedFromSourceLabel(detectedLang || 'hr'))}</strong><div>${escapeHtml(translatedHr)}</div></div>` : ''}
        <div class="inbox-actions">
          <button class="btn btn-secondary btn-sm" onclick='togglePorukaRead("${escapeHtml(p.id)}", ${p.procitano === false ? "true" : "false"})'>${p.procitano === false ? 'Označi pročitano' : 'Označi nepročitano'}</button>
          <button class="btn btn-secondary btn-sm" onclick='replyToPoruka(${JSON.stringify({ ime: p.ime || '', email: p.email || '', jezik: detectedLang || lang, poruka: p.original_text || p.poruka || '' })})'>Odgovori</button>
        </div>
      </div>
    `;
  }

  loadPoruke = async function() {
    const rezWrap = document.getElementById('porukeRezBody');
    const obicneWrap = document.getElementById('porukeObicneBody');

    if (rezWrap) {
      const rezervacije = (allRezervacije || [])
        .filter(r => normalizeRezStatus(r.status) === 'upit')
        .sort((a, b) => new Date(a.datum_dolaska) - new Date(b.datum_dolaska));

      const rezCards = await Promise.all(rezervacije.map(async r => {
        const meta = parseRezKomentar(r.komentar);
        const translatedInfo = meta.original ? await balentTranslateWithDetection(meta.original, (meta.lang && meta.lang !== 'hr') ? meta.lang : 'auto', 'hr') : { translated: '', detectedLang: meta.lang || 'hr' };
        const detectedLang = (meta.lang && meta.lang !== 'hr') ? meta.lang : (translatedInfo.detectedLang || meta.lang || 'hr');
        const translated = meta.translatedHr || translatedInfo.translated || '';
        const showTranslation = detectedLang && detectedLang !== 'hr' && translated && translated !== (meta.original || r.komentar || '');
        const adults = parseInt(r.broj_osoba || 0, 10) || 0;
        const children = parseInt(r.broj_djece || r.djeca || 0, 10) || 0;
        const guestsLabel = children > 0 ? `${adults} odraslih ${children} djece` : `${adults} odraslih`;
        const replyBtn = meta.email ? `<button class="btn btn-secondary btn-sm" onclick='replyToPoruka(${JSON.stringify({ ime: r.ime || '', email: meta.email, jezik: detectedLang || 'hr', poruka: meta.original || r.komentar || '' })})'>Odgovori</button>` : '';
        return renderInboxReservation(r, meta, detectedLang, translated, showTranslation, guestsLabel, replyBtn);
      }));

      rezWrap.innerHTML = rezCards.length ? `<div class="inbox-list">${rezCards.join('')}</div>` : '<div class="inbox-empty">Trenutno nema rezervacijskih upita.</div>';
    }

    if (obicneWrap) {
      try {
        const { data, error } = await sb.from('poruke').select('*').order('created_at', { ascending: false });
        if (error) {
          obicneWrap.innerHTML = '<div class="inbox-empty">Poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
        } else {
          const rows = await Promise.all((data || []).map(async p => {
            const lang = String(p.jezik || p.language || p.original_language || 'hr').toLowerCase();
            let detectedLang = lang;
            let translatedHr = p.translated_text_hr || '';
            const originalMessage = String(p.original_text || p.poruka || '').trim();
            const hasFakeTranslation = !!translatedHr && !!originalMessage && translatedHr.trim() === originalMessage;
            if ((!translatedHr || hasFakeTranslation) && originalMessage) {
              const translatedInfo = await balentTranslateWithDetection(p.original_text || p.poruka, lang !== 'hr' ? lang : 'auto', 'hr');
              translatedHr = translatedInfo.translated || '';
              detectedLang = lang !== 'hr' ? lang : (translatedInfo.detectedLang || lang);
              if (translatedHr) {
                try {
                  await sb.from('poruke').update({ translated_text_hr: translatedHr, original_language: detectedLang }).eq('id', p.id);
                } catch (err) {
                  console.warn('Saving translation failed:', err);
                }
              }
            }
            const showTranslation = detectedLang && detectedLang !== 'hr' && translatedHr && translatedHr !== (p.original_text || p.poruka || '');
            return renderInboxMessage(p, lang, detectedLang, translatedHr, showTranslation);
          }));
          obicneWrap.innerHTML = rows.length ? `<div class="inbox-list">${rows.join('')}</div>` : '<div class="inbox-empty">Trenutno nema poruka.</div>';
        }
      } catch (err) {
        obicneWrap.innerHTML = '<div class="inbox-empty">Poruke će se prikazivati ovdje čim tablica poruka bude dostupna.</div>';
      }
    }
  };
})();

(() => {
  function ensureBrojRacunaField() {
    const statusField = document.getElementById('rStatus')?.closest('.fg');
    if (!statusField || document.getElementById('rBrojRacuna')) return;
    const wrap = document.createElement('div');
    wrap.className = 'fg';
    wrap.innerHTML = `
      <label>Broj računa</label>
      <input type="text" id="rBrojRacuna" placeholder="Npr. 2026-014">
    `;
    statusField.parentNode.insertBefore(wrap, statusField);
  }

  function ensureRacunUiText() {
    const fileInput = document.getElementById('rRacunFile');
    if (fileInput) fileInput.removeAttribute('accept');
    const link = document.getElementById('rRacunLink');
    if (link && link.textContent.includes('račun')) link.textContent = 'Pogledaj dokument';
  }

  const _origOpenRezModal = openRezModal;
  openRezModal = function(rez = null) {
    ensureBrojRacunaField();
    ensureRacunUiText();
    racunClearedInModal = false;
    _origOpenRezModal(rez);
    initRezDatePickers();
    if (rezDolazakPicker) rezDolazakPicker.setDate(rez?.datum_dolaska || '', false);
    if (rezOdlazakPicker) {
      rezOdlazakPicker.set('minDate', rez?.datum_dolaska || null);
      rezOdlazakPicker.setDate(rez?.datum_odlaska || '', false);
      if (rez?.datum_dolaska) rezOdlazakPicker.jumpToDate(rez.datum_dolaska);
    }
    const broj = document.getElementById('rBrojRacuna');
    const link = document.getElementById('rRacunLink');
    const wrap = document.getElementById('rRacunExisting');
    if (broj) broj.value = rez?.broj_racuna || '';
    if (link && wrap) {
      const url = getRacunUrl(rez);
      if (url) {
        wrap.style.display = 'block';
        link.dataset.ref = url;
        link.href = '#';
        link.onclick = function(ev) {
          ev.preventDefault();
          openStoredDocument(url, getRacunName(rez) || 'Dokument');
        };
        link.textContent = getRacunName(rez) || 'Pogledaj dokument';
      } else {
        wrap.style.display = 'none';
        link.removeAttribute('data-ref');
        link.removeAttribute('href');
        link.onclick = null;
        link.textContent = 'Pogledaj dokument';
      }
    }
    loadUplateForCurrentRez();
  };

  clearRacun = async function() {
    racunClearedInModal = true;
    const file = document.getElementById('rRacunFile');
    const wrap = document.getElementById('rRacunExisting');
    const link = document.getElementById('rRacunLink');
    if (file) file.value = '';
    if (wrap) wrap.style.display = 'none';
    if (link) {
      link.removeAttribute('data-ref');
      link.removeAttribute('href');
      link.onclick = null;
      link.textContent = 'Pogledaj dokument';
    }
    if (currentRezId) {
      const previousReservation = findReservationSnapshot(currentRezId);
      const clearPayload = {
        racun_url: null,
        racun_dokument_url: null,
        racun_dokument_naziv: null,
        racun_dokument_tip: null,
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from('rezervacije').update(clearPayload).eq('id', currentRezId);
      if (error) {
        alert('Greška pri uklanjanju dokumenta: ' + error.message);
        return;
      }
      await logReservationAudit({
        action: 'update',
        source: 'dashboard_reservation_document_clear',
        reservationId: currentRezId,
        oldData: previousReservation,
        newData: clearPayload,
        notes: 'clearRacun'
      });
      if (Array.isArray(allRezervacije)) {
        allRezervacije = allRezervacije.map(r => String(r.id) === String(currentRezId)
          ? { ...r, racun_url: null, racun_dokument_url: null, racun_dokument_naziv: null, racun_dokument_tip: null }
          : r);
      }
      loadGosti();
      loadFinancije();
    }
  };

  const _origSaveRezervacija = saveRezervacija;
  saveRezervacija = async function() {
    ensureBrojRacunaField();
    ensureRacunUiText();

    const ime = document.getElementById('rIme').value.trim();
    const dolazak = rezPickerValue('rDolazak', rezDolazakPicker);
    const odlazak = rezPickerValue('rOdlazak', rezOdlazakPicker);
    if (!ime || !dolazak || !odlazak) { alert('Unesite ime, datum dolaska i odlaska.'); return; }

    const runSave = async () => {
      const zaradaAuto = calcPrice(dolazak, odlazak);
      const zaradaRucnaVal = parseMoneyInputValue(document.getElementById('rZarada').value);
      const zaradaJeRucna = zaradaRucnaVal !== null && zaradaRucnaVal !== zaradaAuto;

      let racunUrl = currentRezId ? getModalRacunUrl() : null;
      let racunNaziv = currentRezId && racunUrl ? (document.getElementById('rRacunLink').textContent || null) : null;
      let racunTip = null;
      const fileInput = document.getElementById('rRacunFile');
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const fileName = `racuni/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const { error: uploadErr } = await sb.storage.from('dokumenti').upload(fileName, file);
        if (uploadErr) { alert('Greška pri uploadu: ' + uploadErr.message); return; }
        racunUrl = fileName;
        racunNaziv = file.name;
        racunTip = file.type || null;
        racunClearedInModal = false;
      } else if (racunClearedInModal) {
        racunUrl = null;
        racunNaziv = null;
        racunTip = null;
      } else if (!racunUrl) {
        racunNaziv = null;
      }

      const payload = {
        ime,
        email: document.getElementById('rEmail')?.value.trim() || null,
        apartman: parseInt(document.getElementById('rApt').value),
        datum_dolaska: dolazak,
        datum_odlaska: odlazak,
        broj_osoba: parseInt(document.getElementById('rBrojOsoba').value) || 1,
        izvor: document.getElementById('rIzvor').value,
        status: document.getElementById('rStatus').value,
        broj_racuna: document.getElementById('rBrojRacuna')?.value.trim() || null,
        komentar: document.getElementById('rKomentar').value || null,
        racun_url: racunUrl,
        racun_dokument_url: racunUrl,
        racun_dokument_naziv: racunNaziv,
        racun_dokument_tip: racunTip,
        zarada_auto: zaradaAuto,
        zarada_rucna: zaradaJeRucna ? zaradaRucnaVal : null,
        zarada_je_rucna: zaradaJeRucna,
        updated_at: new Date().toISOString()
      };

      let err;
      const previousReservation = findReservationSnapshot(currentRezId);
      if (currentRezId) ({ error: err } = await sb.from('rezervacije').update(payload).eq('id', currentRezId));
      else ({ error: err } = await sb.from('rezervacije').insert([payload]));

      if (err) { alert('Greška: ' + err.message); return; }
      await logReservationAudit({
        action: currentRezId ? 'update' : 'insert',
        source: currentRezId ? 'dashboard_reservation_edit' : 'dashboard_reservation_create',
        reservationId: currentRezId,
        oldData: previousReservation,
        newData: payload,
        notes: 'active saveRezervacija flow'
      });
      racunClearedInModal = false;
      closeModal('rezModal');
      await loadGosti();
      await loadKalendar();
      await loadKalendarStats();
      await loadFinancije();
    };

    const nextStatus = document.getElementById('rStatus').value;
    if (currentRezId && currentRezStatus === 'upit' && nextStatus === 'otkazano') {
      showConfirm('⚠️','Otkaži upit?','Upit će biti označen kao otkazan. Jeste li sigurni da želite nastaviti?', async () => {
        currentRezStatus = nextStatus;
        await runSave();
      });
      return;
    }
    currentRezStatus = nextStatus;
    await runSave();
  };

  filterGosti = function() {
    const ime = document.getElementById('filterIme').value.toLowerCase();
    const apt = document.getElementById('filterApt').value;
    const izvor = document.getElementById('filterIzvor').value;
    const status = document.getElementById('filterStatus').value;
    const od = document.getElementById('filterDatumOd').value;
    const do_ = document.getElementById('filterDatumDo').value;
    const god = document.getElementById('filterGodina').value;

    let filtered = allRezervacije.filter(r => {
      if (ime && !String(r.ime || '').toLowerCase().includes(ime)) return false;
      if (apt && r.apartman != apt) return false;
      if (izvor && r.izvor !== izvor) return false;
      if (status && normalizeRezStatus(r.status) !== status) return false;
      if (od && r.datum_dolaska < od) return false;
      if (do_ && r.datum_dolaska > do_) return false;
      if (god && new Date(r.datum_dolaska).getFullYear() != god) return false;
      return true;
    });

    const tbody = document.getElementById('gostiBody');
    if (!tbody) return;
    if (typeof setupGostiBulkEmailUi === 'function') setupGostiBulkEmailUi();

    const tableHeadRow = document.querySelector('#gostiTable thead tr');
    if (tableHeadRow) {
      const th = tableHeadRow.children[8];
      if (th) th.textContent = 'Račun / dokument';
    }

    if (!filtered.length) {
      const colspan = document.getElementById('gostiSelectAllTh') ? 11 : 10;
      tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty"><div class="ico">👥</div><p>Nema gostiju koji odgovaraju filteru.</p></div></td></tr>`;
      if (typeof syncBulkEmailButton === 'function') syncBulkEmailButton();
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const zarada = rezZarada(r);
      const zaradaCls = r.zarada_je_rucna ? 'zarada-rucna' : '';
      const statusNorm = normalizeRezStatus(r.status);
      const zaradaPrikaz = statusNorm === 'otkazano' ? '–' : fmtEur(zarada);
      const email = String(r.email || '').trim();
      const hasBulk = !!document.getElementById('gostiSelectAllTh');
      const checked = email && typeof selectedGuestEmails !== 'undefined' && selectedGuestEmails.has(email) ? 'checked' : '';
      const checkbox = hasBulk ? (email ? `<input type="checkbox" class="gosti-email-select" data-email="${escapeHtml(email)}" ${checked} onchange='toggleGuestEmailSelection("${escapeHtml(email)}", this.checked)'>` : '–') : '';
      return `<tr>
        ${hasBulk ? `<td>${checkbox}</td>` : ''}
        <td><strong>${escapeHtml(r.ime || '')}</strong></td>
        <td>${aptLabel(r.apartman)}</td>
        <td>${fmtDate(r.datum_dolaska)}</td>
        <td>${fmtDate(r.datum_odlaska)}</td>
        <td>${r.broj_osoba || '–'}</td>
        <td>${izvorBadge(r.izvor)}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="${statusNorm === 'otkazano' ? '' : zaradaCls}">${zaradaPrikaz}</td>
        <td>${racunCell(r)}</td>
        <td>${dokumentCell(r)}</td>
        <td><button class="btn btn-secondary btn-sm btn-icon" onclick='editRezervacija(${JSON.stringify(r)})'>✎</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRez('${r.id}')">🗑️</button></td>
      </tr>`;
    }).join('');

    if (typeof syncBulkEmailButton === 'function') syncBulkEmailButton();
  };
})();
