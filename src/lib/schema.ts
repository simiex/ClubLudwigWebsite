import { app, contact, resolve, site, social } from '../config/site';
import { venues } from '../data/venues';

/** schema.org/Organization – Basisdaten des Clubs. */
export function organizationSchema(): Record<string, unknown> {
  const sameAs = [social.instagram, social.strava, social.shop, app.appStore, app.playStore].filter(Boolean);
  const email = resolve(contact.email);

  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: site.name,
    url: site.url,
    sport: 'Hiking',
    description:
      'Offener Hiking Club aus Bonn. Gemeinsam wandern zwischen Rhein, Kottenforst und Siebengebirge.',
    areaServed: { '@type': 'City', name: site.city },
    address: { '@type': 'PostalAddress', addressLocality: site.city, addressCountry: 'DE' },
    logo: `${site.url}/icon-512.png`,
  };
  if (sameAs.length > 0) org.sameAs = sameAs;
  if (email) org.email = email;
  return org;
}

/** schema.org/ItemList der Standorte – nur mit belegten Daten. */
export function venueListSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${site.name} – Standorte`,
    itemListElement: venues.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Place',
        name: `${site.name} – ${v.name}`,
        address: { '@type': 'PostalAddress', addressLocality: v.area, addressCountry: 'DE' },
        url: v.uscUrl,
      },
    })),
  };
}

/** schema.org/WebSite – damit Google den Namen der Seite als „Club Ludwig“ zeigt. */
export function websiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    alternateName: ['Club Ludwig Bonn', app.name],
    url: `${site.url}/`,
    inLanguage: 'de-DE',
  };
}

/** schema.org/MobileApplication – je ein Eintrag für iOS und Android. */
export function appSchemas(): Record<string, unknown>[] {
  const basis = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: app.name,
    applicationCategory: 'HealthApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@type': 'SportsOrganization', name: site.name, url: site.url },
  };
  return [
    { ...basis, operatingSystem: 'iOS', downloadUrl: app.appStore, installUrl: app.appStore },
    { ...basis, operatingSystem: 'Android', downloadUrl: app.playStore, installUrl: app.playStore },
  ];
}
