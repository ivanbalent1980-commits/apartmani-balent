(function () {
  'use strict';

  const config = window.BALENT_CONFIG || {};
  const endpoint = config.SUPABASE_URL ? `${config.SUPABASE_URL}/functions/v1/public-site-api` : '';

  function campaignAttribution() {
    const params = new URLSearchParams(window.location.search || '');
    const campaign = {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmContent: params.get('utm_content') || '',
      landingPath: `${window.location.pathname}${window.location.hash || ''}`
    };
    return Object.values(campaign).some(Boolean) ? campaign : {};
  }

  async function request(payload) {
    if (!endpoint || !config.SUPABASE_KEY) throw new Error('Public service is not configured.');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: config.SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      const error = new Error(result.code || `Request failed (${response.status})`);
      error.code = result.code || 'request_failed';
      error.status = response.status;
      throw error;
    }
    return result;
  }

  window.BalentPublicApi = Object.freeze({
    async availability(apartment) {
      const result = await request({
        action: 'availability',
        ...(apartment ? { apartment: Number(apartment) } : {})
      });
      return Array.isArray(result.records) ? result.records : [];
    },
    async enquiry(details) {
      return request({ action: 'enquiry', ...details, ...campaignAttribution() });
    }
  });
})();
