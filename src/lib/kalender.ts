/**
 * ============================================================================
 * MARSCHKALENDER – Daten für /maersche/ und die Seiten je Region
 * ============================================================================
 * Fremde Termine aus `marches` (lib/marches.ts) plus die eigenen
 * Club-Ludwig-Touren, dazu die Regionen und die schema.org-Ausgabe.
 *
 * WARUM SEITEN JE BUNDESLAND
 * Wer „Märsche in meiner Nähe“ oder „Wanderevents NRW“ sucht, landet bei
 * Google auf einer Seite, die genau diese Region im Titel trägt. Die
 * Hauptseite allein kann das für 16 Bundesländer nicht leisten. Jede Region
 * hat deshalb ihre eigene Adresse (/maersche/bayern/ …), auch wenn dort gerade
 * kein Termin steht – dann zeigt sie die Nachbarn. So verschwindet keine
 * Adresse aus dem Index, nur weil ein Monat ruhig ist.
 * ============================================================================
 */
import { buildEvents } from './events';
import { loadEvents } from './events-source';
import { FORMAT_LABEL, formatDistances, loadMarches, type March } from './marches';

/* -------------------------------------------------------------------------- */
/* Regionen                                                                    */
/* -------------------------------------------------------------------------- */

export interface Region {
  slug: string;
  /** So, wie sie in `marches.region` steht (Bundesland) bzw. der Landesname. */
  name: string;
  /** Kurzform für Überschriften und Titel, z. B. „NRW“. */
  kurz?: string;
  land: 'DE' | 'AT' | 'CH';
  /** Angrenzende Regionen – für „Auch in der Nähe“. */
  nachbarn: string[];
}

export const REGIONEN: Region[] = [
  { slug: 'baden-wuerttemberg', name: 'Baden-Württemberg', land: 'DE', nachbarn: ['bayern', 'hessen', 'rheinland-pfalz', 'schweiz'] },
  { slug: 'bayern', name: 'Bayern', land: 'DE', nachbarn: ['baden-wuerttemberg', 'hessen', 'thueringen', 'sachsen', 'oesterreich'] },
  { slug: 'berlin', name: 'Berlin', land: 'DE', nachbarn: ['brandenburg'] },
  { slug: 'brandenburg', name: 'Brandenburg', land: 'DE', nachbarn: ['berlin', 'mecklenburg-vorpommern', 'niedersachsen', 'sachsen-anhalt', 'sachsen'] },
  { slug: 'bremen', name: 'Bremen', land: 'DE', nachbarn: ['niedersachsen'] },
  { slug: 'hamburg', name: 'Hamburg', land: 'DE', nachbarn: ['schleswig-holstein', 'niedersachsen'] },
  { slug: 'hessen', name: 'Hessen', land: 'DE', nachbarn: ['nordrhein-westfalen', 'niedersachsen', 'thueringen', 'bayern', 'baden-wuerttemberg', 'rheinland-pfalz'] },
  { slug: 'mecklenburg-vorpommern', name: 'Mecklenburg-Vorpommern', land: 'DE', nachbarn: ['schleswig-holstein', 'niedersachsen', 'brandenburg'] },
  { slug: 'niedersachsen', name: 'Niedersachsen', land: 'DE', nachbarn: ['bremen', 'hamburg', 'schleswig-holstein', 'mecklenburg-vorpommern', 'brandenburg', 'sachsen-anhalt', 'thueringen', 'hessen', 'nordrhein-westfalen'] },
  { slug: 'nordrhein-westfalen', name: 'Nordrhein-Westfalen', kurz: 'NRW', land: 'DE', nachbarn: ['niedersachsen', 'hessen', 'rheinland-pfalz'] },
  { slug: 'rheinland-pfalz', name: 'Rheinland-Pfalz', land: 'DE', nachbarn: ['nordrhein-westfalen', 'hessen', 'baden-wuerttemberg', 'saarland'] },
  { slug: 'saarland', name: 'Saarland', land: 'DE', nachbarn: ['rheinland-pfalz'] },
  { slug: 'sachsen', name: 'Sachsen', land: 'DE', nachbarn: ['bayern', 'thueringen', 'sachsen-anhalt', 'brandenburg'] },
  { slug: 'sachsen-anhalt', name: 'Sachsen-Anhalt', land: 'DE', nachbarn: ['niedersachsen', 'brandenburg', 'sachsen', 'thueringen'] },
  { slug: 'schleswig-holstein', name: 'Schleswig-Holstein', land: 'DE', nachbarn: ['hamburg', 'niedersachsen', 'mecklenburg-vorpommern'] },
  { slug: 'thueringen', name: 'Thüringen', land: 'DE', nachbarn: ['hessen', 'niedersachsen', 'sachsen-anhalt', 'sachsen', 'bayern'] },
  { slug: 'oesterreich', name: 'Österreich', land: 'AT', nachbarn: ['bayern', 'schweiz'] },
  { slug: 'schweiz', name: 'Schweiz', land: 'CH', nachbarn: ['baden-wuerttemberg', 'oesterreich'] },
];

export function regionBySlug(slug: string): Region | undefined {
  return REGIONEN.find((r) => r.slug === slug);
}

/** Gehört ein Termin in diese Region? In Deutschland nach Bundesland, sonst nach Land. */
export function inRegion(m: March, r: Region): boolean {
  if (r.land !== 'DE') return m.country === r.land;
  return m.country === 'DE' && m.region === r.name;
}

/** Die Region eines Termins – oder undefined (Ausland außer AT/CH, Bundesland fehlt). */
export function regionOf(m: March): Region | undefined {
  return REGIONEN.find((r) => inRegion(m, r));
}

/** „in NRW“, „in der Schweiz“, „in Bayern“ – für Fließtext und Titel. */
export function inDerRegion(r: Region): string {
  const name = r.kurz ?? r.name;
  if (r.slug === 'schweiz') return 'in der Schweiz';
  if (r.slug === 'saarland') return 'im Saarland';
  return `in ${name}`;
}

/* -------------------------------------------------------------------------- */
/* Laden                                                                       */
/* -------------------------------------------------------------------------- */

let geladen: Promise<March[]> | null = null;

/**
 * Alle kommenden Termine, fremde und eigene, nach Datum. Einmal je Build
 * geladen – die Regionsseiten fragen sonst achtzehnmal bei Supabase an.
 */
export function loadKalender(): Promise<March[]> {
  geladen ??= (async () => {
    const fremde = await loadMarches();

    /*
     * Eigene Club-Ludwig-Touren laufen im selben Kalender mit – sonst wirkt es,
     * als hätten wir mit dem Thema nichts zu tun. Sie werden als eigener
     * "Veranstalter" geführt und deutlich hervorgehoben.
     */
    const eigene: March[] = buildEvents(await loadEvents())
      .filter((e) => !e.isPast && e.hasDate && e.effectiveStatus !== 'abgesagt')
      .map((e) => ({
        slug: `club-ludwig-${e.id}`,
        title: e.title,
        organizer: 'Club Ludwig',
        organizer_url: '/touren/',
        format: 'wanderung' as const,
        start_date: e.date!,
        end_date: null,
        city: e.venue.area,
        region: 'Nordrhein-Westfalen',
        country: 'DE',
        distances_km: e.distanceKm != null ? [e.distanceKm] : [],
        time_limit_hours: null,
        price_from: null,
        event_url: '/touren/',
        note: 'Unsere eigene Tour – Anmeldung über Urban Sports Club',
        verified_at: null,
        status: e.effectiveStatus === 'ausgebucht' ? 'ausgebucht' : 'geplant',
      }));

    return [...eigene, ...fremde].sort((a, b) => a.start_date.localeCompare(b.start_date));
  })();
  return geladen;
}

/* -------------------------------------------------------------------------- */
/* schema.org                                                                  */
/* -------------------------------------------------------------------------- */

const LAND_NAME: Record<string, string> = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande', BE: 'Belgien',
  DK: 'Dänemark', ES: 'Spanien', LI: 'Liechtenstein', LU: 'Luxemburg', FR: 'Frankreich', IT: 'Italien',
};

export function landName(code: string): string {
  return LAND_NAME[code] ?? code;
}

/**
 * Ein Termin als schema.org/Event – Google zeigt solche Termine in der Suche
 * gesondert an („Veranstaltungen in der Nähe“). Ort ist nur die Stadt: Eine
 * Startadresse führt der Kalender nicht, die steht beim Veranstalter.
 */
export function marchSchema(m: March, site: URL): Record<string, unknown> {
  const url = m.event_url ? new URL(m.event_url, site).href : new URL('/maersche/', site).href;
  const beschreibung = [
    FORMAT_LABEL[m.format] ?? 'Wanderevent',
    formatDistances(m),
    m.time_limit_hours ? `${m.time_limit_hours} h Zeitlimit` : null,
    m.note,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: m.title,
    description: beschreibung,
    startDate: m.start_date,
    ...(m.end_date ? { endDate: m.end_date } : {}),
    eventStatus:
      m.status === 'abgesagt' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: m.city,
      address: {
        '@type': 'PostalAddress',
        addressLocality: m.city,
        ...(m.region ? { addressRegion: m.region } : {}),
        addressCountry: m.country,
      },
    },
    organizer: {
      '@type': 'Organization',
      name: m.organizer,
      ...(m.organizer_url ? { url: new URL(m.organizer_url, site).href } : {}),
    },
    url,
  };
}

/** Brotkrumen für Google: Start › Marschkalender › Region. */
export function breadcrumbSchema(site: URL, region?: Region): Record<string, unknown> {
  const items = [
    { name: 'Club Ludwig', url: new URL('/', site).href },
    { name: 'Marschkalender', url: new URL('/maersche/', site).href },
    ...(region ? [{ name: region.name, url: new URL(`/maersche/${region.slug}/`, site).href }] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

/** Häufige Fragen als schema.org/FAQPage – der Text muss auf der Seite stehen. */
export function faqSchema(fragen: { frage: string; antwort: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: fragen.map((f) => ({
      '@type': 'Question',
      name: f.frage,
      acceptedAnswer: { '@type': 'Answer', text: f.antwort },
    })),
  };
}
