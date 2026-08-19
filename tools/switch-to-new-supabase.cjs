const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pageFiles = [
  'deploy/index.html',
  'deploy/apartman-1/index.html',
  'deploy/apartman-2/index.html',
  'deploy/apartman-3/index.html',
  'deploy/apartman-4/index.html',
];

const oldProjectRef = 'xtvgkraqccsuonqhaeab';
const oldStorageBase = `https://${oldProjectRef}.supabase.co/storage/v1/object/public/`;
const localImageHelper = `function supabasePublicUrls(bucket, names) {
  const apartmentMatch = String(bucket).match(/^apartman\\s+([34])$/i);
  if (!apartmentMatch) return [];
  const apartment = apartmentMatch[1];
  return names.map(name => {
    const numberMatch = String(name).match(/-(\\d+)\\.[a-z]+$/i);
    if (!numberMatch) return '';
    return \`/assets/photos/apartment-\${apartment}/apartman-\${apartment}-\${String(numberMatch[1]).padStart(3, '0')}.webp\`;
  }).filter(Boolean);
}`;

for (const relativeFile of pageFiles) {
  const file = path.join(root, relativeFile);
  let html = fs.readFileSync(file, 'utf8');

  html = html
    .replaceAll(
      `${oldStorageBase}apartman%203/Apartmani%20Balent%20-%203-1.jpg`,
      'https://apartmanibalent.hr/assets/photos/apartment-3/apartman-3-001.webp'
    )
    .replaceAll(
      `${oldStorageBase}apartman%204/Apartmani%20Balent%20-%204-13.jpg`,
      'https://apartmanibalent.hr/assets/photos/apartment-4/apartman-4-013.webp'
    )
    .replaceAll(
      `${oldStorageBase}apartman%204/Apartmani%20Balent%20-%204-33.jpg`,
      'https://apartmanibalent.hr/assets/photos/apartment-4/apartman-4-033.webp'
    )
    .replaceAll(
      `${oldStorageBase}ostalo/gaga_portret.jpg`,
      '/assets/photos/host/gaga_portret.jpg'
    )
    .replace(
      `const SUPABASE_PUBLIC_BASE = '${oldStorageBase}';\nfunction supabasePublicUrls(bucket, names) {\n  return names.map(name => \`\${SUPABASE_PUBLIC_BASE}\${encodeURIComponent(bucket)}/\${encodeURIComponent(name)}\`);\n}`,
      localImageHelper
    );

  if (html.includes(oldProjectRef)) {
    throw new Error(`Old Supabase reference remains in ${relativeFile}`);
  }
  fs.writeFileSync(file, html, 'utf8');
}

const cssFile = path.join(root, 'deploy/assets/css/seo-pages.css');
let css = fs.readFileSync(cssFile, 'utf8');
css = css.replaceAll(
  `${oldStorageBase}apartman%203/Apartmani%20Balent%20-%203-1.jpg`,
  '../photos/apartment-3/apartman-3-001.webp'
);
if (css.includes(oldProjectRef)) {
  throw new Error('Old Supabase reference remains in seo-pages.css');
}
fs.writeFileSync(cssFile, css, 'utf8');

const sharedFile = path.join(root, 'deploy/shared.js');
let shared = fs.readFileSync(sharedFile, 'utf8');
shared = shared
  .replace(
    `SUPABASE_URL: 'https://${oldProjectRef}.supabase.co'`,
    `SUPABASE_URL: 'https://dbgsdwmmomgnjhoywgjr.supabase.co'`
  )
  .replace(
    `SUPABASE_KEY: 'sb_publishable_SL6TVK5N_mR9-aP2gPXYFw_jC3K1rOZ'`,
    `SUPABASE_KEY: 'sb_publishable_uioC9IaDgyWB4xQNIPPwdg_d5tLFvxJ'`
  );
if (shared.includes(oldProjectRef)) {
  throw new Error('Old Supabase reference remains in shared.js');
}
fs.writeFileSync(sharedFile, shared, 'utf8');

console.log('Switched deploy files to the new Supabase project and local photos.');
