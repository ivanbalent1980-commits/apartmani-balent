(function () {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href.split('#')[0];
  const title = document.title || 'Apartmani Balent';
  const description = document.querySelector('meta[name="description"]')?.content || 'Apartmani Balent u Šilu na otoku Krku.';

  const pageNames = {
    'apartmani-silo-krk': 'Apartmani Šilo Krk',
    'apartmani-silo-blizu-plaze': 'Apartmani blizu plaže',
    'silo-otok-krk': 'Šilo',
    'plaze-silo-krk': 'Plaže Šilo',
    'restorani-silo-krk': 'Restorani Šilo',
    'izleti-otok-krk': 'Izleti otok Krk',
    'obiteljski-odmor-krk': 'Obiteljski odmor Krk',
    'apartments-silo-krk': 'Apartments Silo Krk',
    'ferienwohnungen-silo-krk': 'Ferienwohnungen Silo Krk',
    'appartamenti-silo-krk': 'Appartamenti Silo Krk'
  };

  const slug = new URL(canonical).pathname.split('/').filter(Boolean)[0] || '';
  const currentName = pageNames[slug] || title;
  const itemListElement = [
    { '@type': 'ListItem', position: 1, name: 'Hrvatska', item: 'https://apartmanibalent.hr/' },
    { '@type': 'ListItem', position: 2, name: 'Kvarner', item: 'https://apartmanibalent.hr/' }
  ];

  if (slug === 'silo-otok-krk') {
    itemListElement.push({ '@type': 'ListItem', position: 3, name: 'Šilo', item: canonical });
  } else {
    itemListElement.push(
      { '@type': 'ListItem', position: 3, name: 'Šilo', item: 'https://apartmanibalent.hr/silo-otok-krk/' },
      { '@type': 'ListItem', position: 4, name: currentName, item: canonical }
    );
  }

  const lodging = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': 'https://apartmanibalent.hr/#lodging',
    name: 'Apartmani Balent',
    url: 'https://apartmanibalent.hr/',
    description: 'Četiri moderna apartmana u Šilu na otoku Krku, blizu plaže i pogodna za obiteljski odmor.',
    telephone: '+385915444478',
    email: 'ivana.balent1@gmail.com',
    priceRange: '€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Jesenovica 27',
      addressLocality: 'Šilo',
      addressRegion: 'Primorsko-goranska županija',
      postalCode: '51515',
      addressCountry: 'HR'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 45.1452477,
      longitude: 14.665856
    },
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Wi-Fi', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Air conditioning', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Kitchen', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Terrace or balcony', value: true }
    ]
  };

  const webpage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonical,
    description: description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Apartmani Balent',
      url: 'https://apartmanibalent.hr/'
    },
    about: { '@id': 'https://apartmanibalent.hr/#lodging' }
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement
  };

  const graph = document.createElement('script');
  graph.type = 'application/ld+json';
  graph.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [lodging, webpage, breadcrumb] });
  document.head.appendChild(graph);
})();
