(function () {
  'use strict';

  function currentLang() {
    return (localStorage.getItem('balent_lang') || 'hr').toLowerCase();
  }

  function copyFor(lang) {
    return {
      hr: { required: 'Molimo unesite ime, email, apartman i oba datuma.', unavailable: 'Odabrani raspon uključuje zauzete datume. Molimo odaberite slobodan termin.', sending: 'Slanje...', error: 'Upit trenutačno nije moguće poslati. Pokušajte ponovno ili nas kontaktirajte putem WhatsAppa.', duplicate: 'Upit je već poslan ili je poslano previše pokušaja. Pričekajte nekoliko minuta.' },
      en: { required: 'Please enter your name, email, apartment and both dates.', unavailable: 'The selected dates include an unavailable period. Please choose another stay.', sending: 'Sending...', error: 'The enquiry cannot be sent right now. Please try again or contact us on WhatsApp.', duplicate: 'This enquiry was already sent or there were too many attempts. Please wait a few minutes.' },
      de: { required: 'Bitte Name, E-Mail, Apartment und beide Reisedaten eingeben.', unavailable: 'Der gewählte Zeitraum enthält belegte Daten. Bitte wählen Sie einen freien Termin.', sending: 'Wird gesendet...', error: 'Die Anfrage kann momentan nicht gesendet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns über WhatsApp.', duplicate: 'Diese Anfrage wurde bereits gesendet oder es gab zu viele Versuche. Bitte warten Sie einige Minuten.' },
      it: { required: 'Inserisci nome, email, appartamento ed entrambe le date.', unavailable: 'L’intervallo selezionato include date non disponibili. Scegli un altro periodo.', sending: 'Invio...', error: 'Al momento non è possibile inviare la richiesta. Riprova o contattaci su WhatsApp.', duplicate: 'La richiesta è già stata inviata o ci sono stati troppi tentativi. Attendi qualche minuto.' },
      ru: { required: 'Введите имя, email, апартамент и обе даты.', unavailable: 'Выбранный период содержит занятые даты. Выберите другой период.', sending: 'Отправка...', error: 'Сейчас запрос отправить невозможно. Повторите попытку или свяжитесь с нами через WhatsApp.', duplicate: 'Запрос уже отправлен или было слишком много попыток. Подождите несколько минут.' }
    }[lang] || null;
  }

  async function secureOccupancy(apartment) {
    if (!apartment && typeof buildOccupancySnapshot === 'function') return buildOccupancySnapshot([]);
    if (!window.BalentPublicApi || typeof buildOccupancySnapshot !== 'function') {
      throw new Error('availability_service_unavailable');
    }
    if (typeof occupancyCache !== 'undefined' && occupancyCache[apartment]) return occupancyCache[apartment];
    const rows = await window.BalentPublicApi.availability(apartment);
    const snapshot = buildOccupancySnapshot(rows || []);
    if (typeof occupancyCache !== 'undefined') occupancyCache[apartment] = snapshot;
    if (typeof zauzetiDatumi !== 'undefined') zauzetiDatumi[apartment] = snapshot.disabled;
    return snapshot;
  }

  try { loadOccupancyData = secureOccupancy; } catch (_) {}
  window.loadOccupancyData = secureOccupancy;

  async function translatedMessage(message, lang) {
    if (!message || typeof translateWithDetection !== 'function') return { translated: message, detectedLang: lang };
    return translateWithDetection(message, lang === 'hr' ? 'auto' : lang, 'hr');
  }

  async function sendQuestion(fields, onSuccess, button) {
    const lang = currentLang();
    const copy = copyFor(lang);
    const name = (fields.name?.value || '').trim();
    const email = (fields.email?.value || '').trim();
    const phone = (fields.phone?.value || '').trim();
    const message = (fields.message?.value || '').trim();
    if (!name || !email || !message) return alert(copy.required);

    if (button) { button.disabled = true; button.textContent = copy.sending; }
    try {
      const translated = await translatedMessage(message, lang);
      await window.BalentPublicApi.enquiry({
        mode: 'question', name, email, phone, message,
        translatedMessage: translated.translated || message,
        language: translated.detectedLang || lang
      });
      onSuccess();
    } catch (error) {
      console.warn('Secure public question failed.', error);
      alert(error?.status === 429 ? copy.duplicate : copy.error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.submitQuestionModal = function () {
    const button = document.getElementById('questionSubmitBtn');
    return sendQuestion({
      name: document.getElementById('q-name'), email: document.getElementById('q-email'),
      phone: document.getElementById('q-phone'), message: document.getElementById('q-msg')
    }, function () {
      const form = document.getElementById('questionForm');
      const success = document.getElementById('questionSuccess');
      if (form) form.style.display = 'none';
      if (success) success.style.display = 'block';
    }, button);
  };

  async function submitBooking() {
    const lang = currentLang();
    const copy = copyFor(lang);
    const dateValues = typeof getModalDates === 'function' ? getModalDates() : { inVal: '', outVal: '' };
    const apartment = parseInt(document.getElementById('m-apt')?.value || '0', 10);
    const name = (document.getElementById('m-name')?.value || '').trim();
    const email = (document.getElementById('m-email')?.value || '').trim();
    const phone = (document.getElementById('m-phone')?.value || '').trim();
    const message = (document.getElementById('m-msg')?.value || '').trim();
    const button = document.querySelector('.modal-submit-btn') || document.querySelector('#modalForm .btn-primary');

    if (!name || !email || !apartment || !dateValues.inVal || !dateValues.outVal) return alert(copy.required);
    if (button) { button.disabled = true; button.textContent = copy.sending; }

    try {
      const occupancy = await secureOccupancy(apartment);
      if (typeof rangeOverlapsDisabled === 'function' && rangeOverlapsDisabled(dateValues.inVal, dateValues.outVal, occupancy)) {
        alert(copy.unavailable);
        return;
      }
      const translated = await translatedMessage(message, lang);
      await window.BalentPublicApi.enquiry({
        mode: 'booking', name, email, phone, apartment,
        checkin: dateValues.inVal, checkout: dateValues.outVal,
        adults: parseInt(document.getElementById('m-guests')?.value || '1', 10) || 1,
        children: parseInt(document.getElementById('m-children')?.value || '0', 10) || 0,
        extraBed: (document.getElementById('m-extra')?.value || '0') === '1',
        message, translatedMessage: translated.translated || message,
        language: translated.detectedLang || lang
      });
      if (typeof occupancyCache !== 'undefined') delete occupancyCache[apartment];
      if (typeof zauzetiDatumi !== 'undefined') delete zauzetiDatumi[apartment];
      const form = document.getElementById('modalForm');
      const success = document.getElementById('modalSuccess');
      if (form) form.style.display = 'none';
      if (success) success.style.display = 'block';
    } catch (error) {
      console.warn('Secure public booking failed.', error);
      if (error?.code === 'dates_unavailable') alert(copy.unavailable);
      else if (error?.status === 429) alert(copy.duplicate);
      else alert(copy.error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.submitModal = submitBooking;
  window.submitModalFinal = function () {
    if ((window.contactModalMode || 'booking') === 'question') {
      const button = document.querySelector('#modalForm .btn-primary');
      return sendQuestion({
        name: document.getElementById('m-name'), email: document.getElementById('m-email'),
        phone: document.getElementById('m-phone'), message: document.getElementById('m-msg')
      }, function () {
        const form = document.getElementById('modalForm');
        const success = document.getElementById('modalSuccess');
        if (form) form.style.display = 'none';
        if (success) success.style.display = 'block';
      }, button);
    }
    return submitBooking();
  };
})();
