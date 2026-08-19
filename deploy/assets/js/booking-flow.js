(() => {
  const SEASON_END = '2026-09-30';
  const apartmentDetails = {
    1: { image: '/assets/photos/apartment-1/apartman-1-028.webp', position: { hr: 'Prizemlje · terasa s pogledom na vrt', en: 'Ground floor · garden-view terrace', de: 'Erdgeschoss · Terrasse mit Gartenblick', it: 'Piano terra · terrazza vista giardino', ru: 'Первый этаж · терраса с видом на сад' } },
    2: { image: '/assets/photos/apartment-2/apartman-2-009.webp', position: { hr: 'Prizemlje · terasa', en: 'Ground floor · terrace', de: 'Erdgeschoss · Terrasse', it: 'Piano terra · terrazza', ru: 'Первый этаж · терраса' } },
    3: { image: '/assets/photos/apartment-3/apartman-3-cover-001.webp', position: { hr: 'Prvi kat · balkon i djelomičan pogled na more', en: 'First floor · balcony and partial sea view', de: '1. Stock · Balkon und teilweiser Meerblick', it: 'Primo piano · balcone e vista mare parziale', ru: 'Второй этаж · балкон и частичный вид на море' } },
    4: { image: '/assets/photos/apartment-4-extra/apartman-4-extra-007.webp', position: { hr: 'Prvi kat · terasa i balkon', en: 'First floor · terrace and balcony', de: '1. Stock · Terrasse und Balkon', it: 'Primo piano · terrazza e balcone', ru: 'Второй этаж · терраса и балкон' } }
  };

  const copy = {
    hr: {
      label: 'Dostupnost i cijena', title: 'Pronađite <em>slobodan apartman</em>',
      intro: 'Unesite datume i broj gostiju. Odmah ćemo provjeriti sva četiri apartmana i prikazati ukupnu cijenu boravka.',
      checkin: 'Dolazak', checkout: 'Odlazak', guests: 'Broj gostiju', search: 'Provjeri dostupnost',
      selectDate: 'Odaberite datum', oneGuest: '1 gost', guestsSuffix: 'gosta', searching: 'Provjeravamo slobodne apartmane...',
      invalid: 'Odaberite ispravan datum dolaska i odlaska.', unavailable: 'Za odabrani termin trenutačno nema slobodnog apartmana.',
      unavailableHelp: 'Pokušajte s drugim datumima ili nam pošaljite poruku pa ćemo provjeriti mogućnosti.', contact: 'Pošalji pitanje',
      availableTitle: 'Slobodni apartmani', availableIntro: 'Prikazana cijena odnosi se na cijeli odabrani boravak i uključuje boravišnu pristojbu.',
      nights: n => `${n} ${n === 1 ? 'noćenje' : 'noćenja'}`, total: 'Ukupno', included: 'Boravišna pristojba uključena', choose: 'Odaberi i nastavi',
      calendar: 'Pogledajte mjesečni kalendar svih apartmana', calendarHint: 'Zeleni datumi su slobodni, a crveni zauzeti.',
      loadError: 'Trenutačno ne možemo automatski provjeriti dostupnost. Pošaljite nam upit i provjerit ćemo termin osobno.', enquiry: 'Pošalji upit',
      season: 'Online provjera dostupna je za sezonu do 30. rujna 2026.'
    },
    en: {
      label: 'Availability and price', title: 'Find an <em>available apartment</em>',
      intro: 'Enter your dates and number of guests. We will check all four apartments and show the total stay price.',
      checkin: 'Check-in', checkout: 'Check-out', guests: 'Guests', search: 'Check availability',
      selectDate: 'Select date', oneGuest: '1 guest', guestsSuffix: 'guests', searching: 'Checking available apartments...',
      invalid: 'Please select valid check-in and check-out dates.', unavailable: 'There are currently no apartments available for the selected dates.',
      unavailableHelp: 'Try different dates or send us a message and we will check the options.', contact: 'Send a question',
      availableTitle: 'Available apartments', availableIntro: 'The displayed price is for the entire selected stay and includes tourist tax.',
      nights: n => `${n} ${n === 1 ? 'night' : 'nights'}`, total: 'Total', included: 'Tourist tax included', choose: 'Select and continue',
      calendar: 'View the monthly calendar for all apartments', calendarHint: 'Green dates are available and red dates are unavailable.',
      loadError: 'We cannot check availability automatically at the moment. Send us an enquiry and we will verify the dates personally.', enquiry: 'Send enquiry',
      season: 'Online availability is currently shown through 30 September 2026.'
    },
    de: {
      label: 'Verfügbarkeit und Preis', title: 'Freies <em>Apartment finden</em>',
      intro: 'Geben Sie Reisedaten und Gästezahl ein. Wir prüfen alle vier Apartments und zeigen den Gesamtpreis.',
      checkin: 'Anreise', checkout: 'Abreise', guests: 'Gäste', search: 'Verfügbarkeit prüfen',
      selectDate: 'Datum wählen', oneGuest: '1 Gast', guestsSuffix: 'Gäste', searching: 'Freie Apartments werden geprüft...',
      invalid: 'Bitte wählen Sie gültige An- und Abreisedaten.', unavailable: 'Für den gewählten Zeitraum ist derzeit kein Apartment verfügbar.',
      unavailableHelp: 'Versuchen Sie andere Daten oder schreiben Sie uns, damit wir die Möglichkeiten prüfen.', contact: 'Frage senden',
      availableTitle: 'Freie Apartments', availableIntro: 'Der angezeigte Preis gilt für den gesamten Aufenthalt und enthält die Kurtaxe.',
      nights: n => `${n} ${n === 1 ? 'Nacht' : 'Nächte'}`, total: 'Gesamt', included: 'Kurtaxe inklusive', choose: 'Auswählen und fortfahren',
      calendar: 'Monatskalender aller Apartments ansehen', calendarHint: 'Grüne Daten sind frei, rote Daten sind belegt.',
      loadError: 'Die Verfügbarkeit kann momentan nicht automatisch geprüft werden. Senden Sie uns eine Anfrage, und wir prüfen den Termin persönlich.', enquiry: 'Anfrage senden',
      season: 'Die Online-Verfügbarkeit wird derzeit bis 30. September 2026 angezeigt.'
    },
    it: {
      label: 'Disponibilità e prezzo', title: 'Trova un <em>appartamento disponibile</em>',
      intro: 'Inserisci date e numero di ospiti. Verificheremo tutti e quattro gli appartamenti e mostreremo il prezzo totale.',
      checkin: 'Arrivo', checkout: 'Partenza', guests: 'Ospiti', search: 'Verifica disponibilità',
      selectDate: 'Seleziona data', oneGuest: '1 ospite', guestsSuffix: 'ospiti', searching: 'Verifica degli appartamenti disponibili...',
      invalid: 'Seleziona date di arrivo e partenza valide.', unavailable: 'Nessun appartamento è attualmente disponibile per le date selezionate.',
      unavailableHelp: 'Prova altre date oppure inviaci un messaggio e verificheremo le possibilità.', contact: 'Invia una domanda',
      availableTitle: 'Appartamenti disponibili', availableIntro: 'Il prezzo indicato è per l’intero soggiorno e include la tassa di soggiorno.',
      nights: n => `${n} ${n === 1 ? 'notte' : 'notti'}`, total: 'Totale', included: 'Tassa di soggiorno inclusa', choose: 'Scegli e continua',
      calendar: 'Vedi il calendario mensile di tutti gli appartamenti', calendarHint: 'Le date verdi sono disponibili, quelle rosse occupate.',
      loadError: 'Al momento non possiamo verificare automaticamente la disponibilità. Inviaci una richiesta e controlleremo personalmente le date.', enquiry: 'Invia richiesta',
      season: 'La disponibilità online è attualmente mostrata fino al 30 settembre 2026.'
    },
    ru: {
      label: 'Наличие и цена', title: 'Найдите <em>свободный апартамент</em>',
      intro: 'Укажите даты и число гостей. Мы проверим все четыре апартамента и покажем общую стоимость проживания.',
      checkin: 'Заезд', checkout: 'Выезд', guests: 'Гости', search: 'Проверить наличие',
      selectDate: 'Выберите дату', oneGuest: '1 гость', guestsSuffix: 'гостя', searching: 'Проверяем свободные апартаменты...',
      invalid: 'Выберите корректные даты заезда и выезда.', unavailable: 'На выбранные даты свободных апартаментов сейчас нет.',
      unavailableHelp: 'Попробуйте другие даты или напишите нам, и мы проверим возможные варианты.', contact: 'Задать вопрос',
      availableTitle: 'Свободные апартаменты', availableIntro: 'Указанная цена относится ко всему периоду проживания и включает туристический сбор.',
      nights: n => `${n} ночей`, total: 'Итого', included: 'Туристический сбор включён', choose: 'Выбрать и продолжить',
      calendar: 'Посмотреть календарь всех апартаментов', calendarHint: 'Зеленые даты свободны, красные заняты.',
      loadError: 'Сейчас автоматическая проверка недоступна. Отправьте запрос, и мы лично проверим даты.', enquiry: 'Отправить запрос',
      season: 'Онлайн-доступность сейчас показана до 30 сентября 2026 года.'
    }
  };

  const state = { checkin: '', checkout: '', guests: 2, results: null, loading: false, error: '' };
  let checkinPicker = null;
  let checkoutPicker = null;

  const lang = () => copy[localStorage.getItem('balent_lang')] ? localStorage.getItem('balent_lang') : 'hr';
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]);
  const parseIso = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const nights = () => {
    const start = parseIso(state.checkin), end = parseIso(state.checkout);
    return start && end && end > start ? Math.round((end - start) / 86400000) : 0;
  };
  const nightlyPrice = (date, apartment) => window.BalentPricing?.nightlyPrice(date, apartment) ?? 85;
  const stayPrice = apartment => {
    let total = 0;
    const cursor = parseIso(state.checkin);
    for (let index = 0; index < nights(); index += 1) {
      total += nightlyPrice(cursor, apartment);
      if (state.guests === 5 && apartment <= 3) total += 10;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  };
  const overlaps = records => (records || []).some(record => {
    if (!record.datum_dolaska || !record.datum_odlaska) return false;
    return state.checkin < record.datum_odlaska && state.checkout > record.datum_dolaska;
  });

  function resultMarkup() {
    const c = copy[lang()];
    if (state.loading) return `<div class="unified-status" role="status"><span class="unified-spinner" aria-hidden="true"></span>${esc(c.searching)}</div>`;
    if (state.error) return `<div class="unified-status unified-status-error"><strong>${esc(c.loadError)}</strong><button type="button" class="btn-primary" onclick="openModal()">${esc(c.enquiry)} →</button></div>`;
    if (!state.results) return '';
    if (!state.results.length) return `<div class="unified-status unified-status-empty"><strong>${esc(c.unavailable)}</strong><p>${esc(c.unavailableHelp)}</p><button type="button" class="btn-primary" onclick="openModal(undefined, 'question')">${esc(c.contact)} →</button></div>`;

    const cards = state.results.map(apt => {
      const image = apartmentDetails[apt].image;
      return `<article class="unified-result-card">
        <img src="${esc(image)}" alt="Apartman ${apt}">
        <div class="unified-result-body">
          <div><p class="unified-available-mark">${esc(c.availableTitle)}</p><h3>Apartman Balent ${apt}</h3><p>${esc(apartmentDetails[apt].position[lang()] || apartmentDetails[apt].position.hr)}</p></div>
          <div class="unified-price"><span>${esc(c.total)} · ${esc(c.nights(nights()))}</span><strong>${stayPrice(apt)} €</strong><small>${esc(c.included)}</small></div>
          <button type="button" class="btn-primary" data-unified-select="${apt}">${esc(c.choose)} →</button>
        </div>
      </article>`;
    }).join('');
    return `<div class="unified-results-head"><h3>${esc(c.availableTitle)}</h3><p>${esc(c.availableIntro)}</p></div><div class="unified-results-grid">${cards}</div>`;
  }

  function flowMarkup() {
    const c = copy[lang()];
    const guestOptions = [1, 2, 3, 4, 5].map(number => `<option value="${number}"${state.guests === number ? ' selected' : ''}>${number === 1 ? esc(c.oneGuest) : `${number} ${esc(c.guestsSuffix)}`}</option>`).join('');
    return `<div id="unified-booking-flow" class="unified-booking-flow">
      <div class="unified-booking-copy"><p class="sec-label">${esc(c.label)}</p><h2 class="sec-title">${c.title}</h2><p class="sec-desc">${esc(c.intro)}</p></div>
      <div class="unified-search-box">
        <div class="unified-field"><label for="unified-checkin">${esc(c.checkin)}</label><input id="unified-checkin" type="text" placeholder="${esc(c.selectDate)}" readonly></div>
        <div class="unified-field"><label for="unified-checkout">${esc(c.checkout)}</label><input id="unified-checkout" type="text" placeholder="${esc(c.selectDate)}" readonly></div>
        <div class="unified-field"><label for="unified-guests">${esc(c.guests)}</label><select id="unified-guests">${guestOptions}</select></div>
        <button type="button" id="unified-search" class="btn-primary">${esc(c.search)} →</button>
      </div>
      <p class="unified-season-note">${esc(c.season)}</p>
      <div id="unified-results" aria-live="polite">${resultMarkup()}</div>
    </div>`;
  }

  function readInputDate(input) {
    return input?._flatpickr?.selectedDates?.[0] ? iso(input._flatpickr.selectedDates[0]) : '';
  }

  function initDatePickers() {
    if (typeof window.flatpickr !== 'function') return;
    const checkin = document.getElementById('unified-checkin');
    const checkout = document.getElementById('unified-checkout');
    if (!checkin || !checkout) return;
    checkinPicker?.destroy();
    checkoutPicker?.destroy();
    const locale = window.flatpickr?.l10ns?.[lang()] || window.flatpickr?.l10ns?.hr || 'default';
    checkinPicker = window.flatpickr(checkin, {
      locale, dateFormat: 'd.m.Y.', minDate: 'today', maxDate: parseIso(SEASON_END), disableMobile: true, defaultDate: parseIso(state.checkin),
      onChange(selected) {
        state.checkin = selected[0] ? iso(selected[0]) : '';
        if (selected[0]) {
          const minimum = new Date(selected[0]); minimum.setDate(minimum.getDate() + 1);
          checkoutPicker?.set('minDate', iso(minimum));
          if (state.checkout && state.checkout <= state.checkin) { state.checkout = ''; checkoutPicker?.clear(); }
        }
      }
    });
    checkoutPicker = window.flatpickr(checkout, {
      locale, dateFormat: 'd.m.Y.', minDate: parseIso(state.checkin) || 'today', maxDate: parseIso(SEASON_END), disableMobile: true, defaultDate: parseIso(state.checkout),
      onChange(selected) { state.checkout = selected[0] ? iso(selected[0]) : ''; }
    });
  }

  async function searchAvailability() {
    const c = copy[lang()];
    const checkin = document.getElementById('unified-checkin');
    const checkout = document.getElementById('unified-checkout');
    state.checkin = readInputDate(checkin) || state.checkin;
    state.checkout = readInputDate(checkout) || state.checkout;
    state.guests = Number(document.getElementById('unified-guests')?.value || 2);
    if (!nights()) {
      state.results = null; state.error = '';
      const results = document.getElementById('unified-results');
      if (results) results.innerHTML = `<div class="unified-status unified-status-empty"><strong>${esc(c.invalid)}</strong></div>`;
      return;
    }
    state.loading = true; state.results = null; state.error = '';
    document.getElementById('unified-results').innerHTML = resultMarkup();
    try {
      if (!window.BalentPublicApi) throw new Error('Availability service is unavailable');
      const candidates = state.guests === 5 ? [1, 2, 3] : [1, 2, 3, 4];
      const allRecords = await window.BalentPublicApi.availability();
      const checks = candidates.map(apt => {
        const records = allRecords.filter(row => Number(row.apartman) === apt);
        return overlaps(records) ? null : apt;
      });
      state.results = checks.filter(Boolean);
    } catch (error) {
      console.warn('Unified availability check failed:', error);
      state.error = 'availability';
    } finally {
      state.loading = false;
      const results = document.getElementById('unified-results');
      if (results) results.innerHTML = resultMarkup();
    }
  }

  function selectApartment(apt) {
    if (typeof window.openModal !== 'function') return;
    window.openModal(`Apartman ${apt}`);
    let attempts = 0;
    const fill = () => {
      attempts += 1;
      const apartment = document.getElementById('m-apt');
      const guests = document.getElementById('m-guests');
      const inPicker = document.getElementById('m-checkin')?._flatpickr;
      const outPicker = document.getElementById('m-checkout')?._flatpickr;
      if (apartment) apartment.value = String(apt);
      if (guests) guests.value = String(state.guests);
      if (inPicker && outPicker) {
        inPicker.setDate(state.checkin, true, 'Y-m-d');
        window.setTimeout(() => outPicker.setDate(state.checkout, true, 'Y-m-d'), 80);
        return;
      }
      if (attempts < 15) window.setTimeout(fill, 100);
    };
    window.setTimeout(fill, 520);
  }

  function bindFlow() {
    document.getElementById('unified-search')?.addEventListener('click', searchAvailability);
    document.getElementById('unified-guests')?.addEventListener('change', event => { state.guests = Number(event.target.value); });
    document.getElementById('unified-results')?.addEventListener('click', event => {
      const button = event.target.closest('[data-unified-select]');
      if (button) selectApartment(Number(button.dataset.unifiedSelect));
    });
  }

  function prepareLegacyCalendar() {
    const calendar = document.getElementById('avail-calendar');
    const c = copy[lang()];
    if (!calendar) return;
    const existing = calendar.closest('.unified-calendar-details');
    if (existing) {
      const summary = existing.querySelector(':scope > summary');
      if (summary) summary.innerHTML = `<span><strong>${esc(c.calendar)}</strong><small>${esc(c.calendarHint)}</small></span><i aria-hidden="true"></i>`;
      return;
    }
    const details = document.createElement('details');
    details.className = 'unified-calendar-details';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span><strong>${esc(c.calendar)}</strong><small>${esc(c.calendarHint)}</small></span><i aria-hidden="true"></i>`;
    calendar.parentNode.insertBefore(details, calendar);
    details.append(summary, calendar);
    const oldCta = details.nextElementSibling;
    if (oldCta?.querySelector('.booking-cta-btn')) oldCta.hidden = true;
  }

  function updateNavigation() {
    const availability = document.querySelector('.nav-links a[href="#kalendar"]');
    const calculator = document.querySelector('.nav-links a[href="#kalkulator"]');
    if (availability) {
      const labels = { hr: 'Termin i cijena', en: 'Dates & price', de: 'Termin & Preis', it: 'Date e prezzo', ru: 'Даты и цена' };
      availability.querySelectorAll('[data-lang]').forEach(node => { node.textContent = labels[node.dataset.lang] || labels.hr; });
    }
    if (calculator?.parentElement) calculator.parentElement.hidden = true;
  }

  function render() {
    const section = document.getElementById('kalendar');
    if (!section) return;
    document.body.classList.add('unified-flow-active');
    section.querySelector(':scope > .container > .sec-label')?.remove();
    section.querySelector(':scope > .container > .sec-title')?.remove();
    section.querySelector(':scope > .container > .sec-desc')?.remove();
    const container = section.querySelector(':scope > .container');
    document.getElementById('unified-booking-flow')?.remove();
    container.insertAdjacentHTML('afterbegin', flowMarkup());
    prepareLegacyCalendar();
    updateNavigation();
    bindFlow();
    initDatePickers();
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', () => window.setTimeout(render, 20)));
  });
})();
