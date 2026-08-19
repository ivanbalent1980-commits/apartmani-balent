(() => {
  const copy = {
    hr: {
      label: 'Direktna rezervacija',
      title: 'Kako <em>rezervirati</em>',
      intro: 'Jednostavan postupak, bez posredničke provizije i uz izravan dogovor s domaćicom Ivanom.',
      steps: [
        ['Pošaljite upit', 'Odaberite apartman i datume te pošaljite upit putem obrasca ili WhatsAppa.'],
        ['Potvrda dostupnosti', 'Ivana potvrđuje slobodan termin i šalje podatke za uplatu.'],
        ['Akontacija 30%', 'Rezervacija je potvrđena nakon uplate nepovratne akontacije u iznosu 30% ukupne cijene.'],
        ['Ostatak pri dolasku', 'Preostali iznos plaća se pri dolasku, uplatom na račun ili gotovinom.']
      ],
      noticeTitle: 'Važno prije rezervacije',
      notice: 'U slučaju otkaza od strane gosta akontacija se ne vraća. Preporučujemo da prije uplate ugovorite osiguranje od otkaza putovanja. Pokriće i uvjeti povrata ovise o odabranoj polici osiguranja.',
      cta: 'Pošalji upit za termin',
      faqLabel: 'Prije dolaska',
      faqTitle: 'Česta <em>pitanja</em>',
      faqs: [
        ['Je li slanje upita obvezujuće?', 'Nije. Najprije provjeravamo dostupnost i dogovaramo detalje. Rezervacija je potvrđena nakon uplate akontacije.'],
        ['Kako se plaća rezervacija?', 'Akontacija iznosi 30% ukupne cijene i uplaćuje se na račun prema podacima koje šaljemo nakon dogovora. Ostatak se plaća pri dolasku, uplatom na račun ili gotovinom. Kartično plaćanje u objektu nije dostupno.'],
        ['Što se događa ako otkažem?', 'U slučaju otkaza od strane gosta uplaćena akontacija se ne vraća. Zbog nepredviđenih okolnosti preporučujemo osiguranje od otkaza putovanja.'],
        ['Kako funkcionira osiguranje od otkaza?', 'Putno osiguranje ugovara se izravno s odabranim osiguravateljem. Pokriveni razlozi otkaza, iznos povrata i ostali uvjeti ovise o konkretnoj polici.'],
        ['Zašto je direktna rezervacija povoljnija?', 'Kod direktne rezervacije nema posredničke provizije, pa je cijena u pravilu osjetno povoljnija nego na velikim platformama.'],
        ['Kada su prijava i odjava?', 'Check-in je od 15:00 do 20:00, a check-out do 10:00.']
      ],
      hostTitle: 'Vaša domaćica Ivana',
      hostText: 'Ivana vam stoji na raspolaganju za pitanja, informacije i dogovor oko rezervacije.'
    },
    en: {
      label: 'Direct booking',
      title: 'How to <em>book</em>',
      intro: 'A simple process with no intermediary commission and direct communication with your host, Ivana.',
      steps: [
        ['Send an enquiry', 'Choose an apartment and dates, then contact us through the form or WhatsApp.'],
        ['Availability confirmation', 'Ivana confirms the available dates and sends the payment details.'],
        ['30% deposit', 'The booking is confirmed after payment of a non-refundable deposit equal to 30% of the total price.'],
        ['Balance on arrival', 'The remaining amount is paid on arrival by bank transfer or in cash.']
      ],
      noticeTitle: 'Important before booking',
      notice: 'If the guest cancels, the deposit is non-refundable. We recommend arranging travel cancellation insurance before payment. Coverage and reimbursement conditions depend on the selected insurance policy.',
      cta: 'Enquire about your dates',
      faqLabel: 'Before arrival',
      faqTitle: 'Frequently asked <em>questions</em>',
      faqs: [
        ['Is sending an enquiry binding?', 'No. We first confirm availability and agree on the details. The booking is confirmed after the deposit is paid.'],
        ['How do I pay for the booking?', 'The deposit is 30% of the total price and is paid by bank transfer using the details sent after we agree on the booking. The balance is paid on arrival by bank transfer or in cash. Card payment at the property is not available.'],
        ['What happens if I cancel?', 'If the guest cancels, the paid deposit is non-refundable. We recommend travel cancellation insurance for unforeseen circumstances.'],
        ['How does cancellation insurance work?', 'Travel insurance is arranged directly with the insurer of your choice. Covered reasons, reimbursement amounts and other conditions depend on the specific policy.'],
        ['Why is direct booking less expensive?', 'There is no intermediary commission on a direct booking, so the price is generally noticeably lower than on large booking platforms.'],
        ['What are the check-in and check-out times?', 'Check-in is from 15:00 to 20:00 and check-out is by 10:00.']
      ],
      hostTitle: 'Your host Ivana',
      hostText: 'Ivana is available for questions, local information and booking arrangements.'
    },
    de: {
      label: 'Direktbuchung',
      title: 'So funktioniert die <em>Buchung</em>',
      intro: 'Ein einfacher Ablauf ohne Vermittlungsprovision und mit direktem Kontakt zu Ihrer Gastgeberin Ivana.',
      steps: [
        ['Anfrage senden', 'Wählen Sie Apartment und Reisedaten und senden Sie Ihre Anfrage über das Formular oder WhatsApp.'],
        ['Verfügbarkeit bestätigen', 'Ivana bestätigt den freien Termin und sendet Ihnen die Zahlungsdaten.'],
        ['30 % Anzahlung', 'Die Buchung ist nach Eingang einer nicht erstattungsfähigen Anzahlung von 30 % des Gesamtpreises bestätigt.'],
        ['Restzahlung bei Ankunft', 'Der Restbetrag wird bei Ankunft per Banküberweisung oder bar bezahlt.']
      ],
      noticeTitle: 'Wichtig vor der Buchung',
      notice: 'Bei einer Stornierung durch den Gast wird die Anzahlung nicht zurückerstattet. Wir empfehlen, vor der Zahlung eine Reiserücktrittsversicherung abzuschließen. Deckung und Erstattung richten sich nach der gewählten Versicherungspolice.',
      cta: 'Termin anfragen',
      faqLabel: 'Vor der Anreise',
      faqTitle: 'Häufige <em>Fragen</em>',
      faqs: [
        ['Ist eine Anfrage verbindlich?', 'Nein. Zuerst bestätigen wir die Verfügbarkeit und vereinbaren die Details. Die Buchung ist nach Zahlung der Anzahlung bestätigt.'],
        ['Wie wird die Buchung bezahlt?', 'Die Anzahlung beträgt 30 % des Gesamtpreises und wird nach der Vereinbarung auf das von uns mitgeteilte Konto überwiesen. Der Restbetrag wird bei Ankunft per Überweisung oder bar bezahlt. Kartenzahlung vor Ort ist nicht möglich.'],
        ['Was geschieht bei einer Stornierung?', 'Bei einer Stornierung durch den Gast wird die geleistete Anzahlung nicht zurückerstattet. Für unvorhergesehene Umstände empfehlen wir eine Reiserücktrittsversicherung.'],
        ['Wie funktioniert eine Reiserücktrittsversicherung?', 'Die Versicherung schließen Sie direkt bei einem Versicherer Ihrer Wahl ab. Versicherte Gründe, Erstattungshöhe und weitere Bedingungen hängen von der jeweiligen Police ab.'],
        ['Warum ist die Direktbuchung günstiger?', 'Bei einer Direktbuchung fällt keine Vermittlungsprovision an. Deshalb ist der Preis in der Regel deutlich günstiger als auf großen Buchungsplattformen.'],
        ['Wann sind Check-in und Check-out?', 'Check-in ist von 15:00 bis 20:00 Uhr, Check-out bis 10:00 Uhr.']
      ],
      hostTitle: 'Ihre Gastgeberin Ivana',
      hostText: 'Ivana steht Ihnen für Fragen, Informationen und die Buchungsabsprache zur Verfügung.'
    },
    it: {
      label: 'Prenotazione diretta',
      title: 'Come <em>prenotare</em>',
      intro: 'Una procedura semplice, senza commissioni di intermediazione e con contatto diretto con la vostra host Ivana.',
      steps: [
        ['Invia una richiesta', 'Scegli appartamento e date, quindi invia la richiesta tramite il modulo o WhatsApp.'],
        ['Conferma della disponibilità', 'Ivana conferma le date disponibili e invia i dati per il pagamento.'],
        ['Acconto del 30%', 'La prenotazione è confermata dopo il pagamento di un acconto non rimborsabile pari al 30% del prezzo totale.'],
        ['Saldo all’arrivo', 'L’importo rimanente si paga all’arrivo tramite bonifico bancario o in contanti.']
      ],
      noticeTitle: 'Importante prima di prenotare',
      notice: 'In caso di cancellazione da parte dell’ospite, l’acconto non viene rimborsato. Consigliamo di stipulare un’assicurazione contro l’annullamento del viaggio prima del pagamento. Copertura e rimborso dipendono dalla polizza scelta.',
      cta: 'Richiedi le date',
      faqLabel: 'Prima dell’arrivo',
      faqTitle: 'Domande <em>frequenti</em>',
      faqs: [
        ['L’invio della richiesta è vincolante?', 'No. Prima confermiamo la disponibilità e concordiamo i dettagli. La prenotazione è confermata dopo il pagamento dell’acconto.'],
        ['Come si paga la prenotazione?', 'L’acconto è pari al 30% del prezzo totale e viene versato tramite bonifico usando i dati inviati dopo l’accordo. Il saldo si paga all’arrivo tramite bonifico o in contanti. Non è disponibile il pagamento con carta presso la struttura.'],
        ['Cosa succede se cancello?', 'In caso di cancellazione da parte dell’ospite, l’acconto versato non viene rimborsato. Per gli imprevisti consigliamo un’assicurazione contro l’annullamento del viaggio.'],
        ['Come funziona l’assicurazione contro l’annullamento?', 'L’assicurazione si stipula direttamente con la compagnia scelta. Motivi coperti, importo del rimborso e altre condizioni dipendono dalla singola polizza.'],
        ['Perché la prenotazione diretta è più conveniente?', 'Con la prenotazione diretta non ci sono commissioni di intermediazione, quindi il prezzo è generalmente sensibilmente inferiore rispetto alle grandi piattaforme.'],
        ['Quali sono gli orari di check-in e check-out?', 'Il check-in è dalle 15:00 alle 20:00 e il check-out entro le 10:00.']
      ],
      hostTitle: 'La vostra host Ivana',
      hostText: 'Ivana è a disposizione per domande, informazioni e accordi sulla prenotazione.'
    },
    ru: {
      label: 'Прямое бронирование',
      title: 'Как <em>забронировать</em>',
      intro: 'Простой процесс без комиссии посредника и с прямым общением с хозяйкой Иваной.',
      steps: [
        ['Отправьте запрос', 'Выберите апартамент и даты, затем отправьте запрос через форму или WhatsApp.'],
        ['Подтверждение дат', 'Ивана подтверждает свободные даты и отправляет реквизиты для оплаты.'],
        ['Предоплата 30%', 'Бронирование подтверждается после внесения невозвратной предоплаты в размере 30% общей стоимости.'],
        ['Остаток по прибытии', 'Оставшаяся сумма оплачивается по прибытии банковским переводом или наличными.']
      ],
      noticeTitle: 'Важно перед бронированием',
      notice: 'При отмене со стороны гостя предоплата не возвращается. До оплаты рекомендуем оформить страховку от отмены поездки. Покрытие и условия возмещения зависят от выбранного страхового полиса.',
      cta: 'Узнать о свободных датах',
      faqLabel: 'Перед приездом',
      faqTitle: 'Частые <em>вопросы</em>',
      faqs: [
        ['Обязывает ли отправка запроса к бронированию?', 'Нет. Сначала мы подтверждаем наличие мест и согласовываем детали. Бронирование подтверждается после внесения предоплаты.'],
        ['Как оплатить бронирование?', 'Предоплата составляет 30% общей стоимости и переводится на счет по реквизитам, которые мы отправим после согласования. Остаток оплачивается по прибытии переводом или наличными. Оплата картой на месте недоступна.'],
        ['Что произойдет при отмене?', 'При отмене со стороны гостя внесенная предоплата не возвращается. На случай непредвиденных обстоятельств рекомендуем страховку от отмены поездки.'],
        ['Как работает страховка от отмены?', 'Страховка оформляется напрямую у выбранной страховой компании. Покрываемые причины, размер возмещения и другие условия зависят от конкретного полиса.'],
        ['Почему прямое бронирование выгоднее?', 'При прямом бронировании нет комиссии посредника, поэтому цена, как правило, заметно ниже, чем на крупных платформах.'],
        ['Когда заезд и выезд?', 'Заезд с 15:00 до 20:00, выезд до 10:00.']
      ],
      hostTitle: 'Ваша хозяйка Ивана',
      hostText: 'Ивана ответит на вопросы, предоставит информацию и поможет согласовать бронирование.'
    }
  };

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  function currentLanguage() {
    const saved = localStorage.getItem('balent_lang');
    return copy[saved] ? saved : 'hr';
  }

  function renderSection(lang) {
    const c = copy[lang];
    const steps = c.steps.map((step, index) => `
      <article class="booking-step">
        <span class="booking-step-number">${index + 1}</span>
        <h3>${escapeHtml(step[0])}</h3>
        <p>${escapeHtml(step[1])}</p>
      </article>`).join('');
    const faqs = c.faqs.map((faq, index) => `
      <details class="booking-faq-item"${index === 0 ? ' open' : ''}>
        <summary>${escapeHtml(faq[0])}<span aria-hidden="true"></span></summary>
        <p>${escapeHtml(faq[1])}</p>
      </details>`).join('');

    return `
      <section id="rezervacija-info" class="booking-info-section" aria-labelledby="booking-info-title">
        <div class="container">
          <p class="sec-label">${escapeHtml(c.label)}</p>
          <h2 id="booking-info-title" class="sec-title">${c.title}</h2>
          <p class="sec-desc booking-info-intro">${escapeHtml(c.intro)}</p>
          <div class="booking-steps">${steps}</div>
          <div class="booking-policy-note">
            <div><strong>${escapeHtml(c.noticeTitle)}</strong><p>${escapeHtml(c.notice)}</p></div>
            <button type="button" class="btn-primary" onclick="openModal()">${escapeHtml(c.cta)} →</button>
          </div>
          <div class="booking-faq" aria-labelledby="booking-faq-title">
            <p class="sec-label">${escapeHtml(c.faqLabel)}</p>
            <h2 id="booking-faq-title" class="sec-title">${c.faqTitle}</h2>
            <div class="booking-faq-list">${faqs}</div>
          </div>
        </div>
      </section>`;
  }

  function updateHost(lang) {
    const card = document.getElementById('hostCard');
    if (!card) return;
    const c = copy[lang];
    const heading = card.querySelector('h4');
    const paragraph = card.querySelector('p');
    const image = card.querySelector('img');
    if (heading) heading.textContent = c.hostTitle;
    if (paragraph) paragraph.textContent = c.hostText;
    if (image) image.alt = c.hostTitle;
  }

  function addStructuredData() {
    if (document.getElementById('booking-faq-schema')) return;
    const data = copy.hr.faqs.map(faq => ({
      '@type': 'Question',
      name: faq[0],
      acceptedAnswer: { '@type': 'Answer', text: faq[1] }
    }));
    const script = document.createElement('script');
    script.id = 'booking-faq-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: data });
    document.head.appendChild(script);
  }

  function render() {
    const priceSection = document.getElementById('cjenik');
    if (!priceSection) return;
    const lang = currentLanguage();
    const existing = document.getElementById('rezervacija-info');
    if (existing) existing.remove();
    priceSection.insertAdjacentHTML('afterend', renderSection(lang));
    updateHost(lang);
    addStructuredData();
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', () => {
      window.setTimeout(render, 0);
    }));
  });
})();
