const fs = require('fs');
const path = require('path');
const vm = require('vm');

const shared = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'shared.js'), 'utf8');
const supabaseUrl = shared.match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
const publicKey = shared.match(/SUPABASE_KEY:\s*'([^']+)'/)?.[1];

if (!supabaseUrl || !publicKey) throw new Error('Missing public Supabase configuration.');

async function request(body, origin = 'https://apartmanibalent.hr') {
  const response = await fetch(`${supabaseUrl}/functions/v1/public-site-api`, {
    method: 'POST',
    headers: { apikey: publicKey, 'content-type': 'application/json', origin },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function testCampaignAttribution() {
  const clientCode = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'assets', 'js', 'public-site-api.js'), 'utf8');
  let sentBody = null;
  const window = {
    BALENT_CONFIG: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'public-key' },
    location: {
      search: '?utm_source=google_business&utm_medium=organic&utm_campaign=rujan_2026&utm_content=test_post',
      pathname: '/',
      hash: '#kalendar'
    }
  };
  window.window = window;
  const sandbox = {
    window,
    URLSearchParams,
    fetch: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    console
  };
  vm.runInNewContext(clientCode, sandbox);
  await window.BalentPublicApi.enquiry({ mode: 'question', name: 'Test' });
  return sentBody;
}

(async () => {
  const availability = await request({ action: 'availability', apartment: 3 });
  const invalid = await request({ action: 'enquiry', mode: 'question', name: 'A', email: 'bad', message: '' });
  const foreignOrigin = await request({ action: 'availability' }, 'https://example.com');
  const campaignBody = await testCampaignAttribution();
  const allowedFields = ['apartman', 'datum_dolaska', 'datum_odlaska', 'status'];
  const rows = availability.body.records || [];
  const leakedFields = rows.flatMap(row => Object.keys(row).filter(key => !allowedFields.includes(key)));

  const failures = [];
  if (availability.status !== 200 || availability.body.ok !== true) failures.push('availability request failed');
  if (leakedFields.length) failures.push(`availability leaked fields: ${[...new Set(leakedFields)].join(', ')}`);
  if (invalid.status !== 400 || invalid.body.code !== 'invalid_contact') failures.push('invalid enquiry was not rejected');
  if (foreignOrigin.status !== 403 || foreignOrigin.body.code !== 'origin_not_allowed') failures.push('foreign origin was not blocked');
  if (campaignBody?.utmSource !== 'google_business' || campaignBody?.utmCampaign !== 'rujan_2026' || campaignBody?.landingPath !== '/#kalendar') {
    failures.push('campaign attribution was not attached to enquiry');
  }

  if (failures.length) {
    console.error(`FAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log(`PASS: public API (${rows.length} safe availability rows, validation and origin checks passed)`);
})();
