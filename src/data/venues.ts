/**
 * Die Club-Ludwig-Standorte bei Urban Sports Club.
 *
 * Die URLs sind von der USC-Partnerseite übernommen (Abschnitt „Andere
 * Standorte“ auf /de/venues/club-ludwig-hofgarten) und damit verifiziert –
 * keine geratenen Slugs.
 *
 * `image` verweist auf die aktuelle SVG-Illustration. Sobald echte Fotos
 * vorliegen, nur `photo` setzen (siehe src/lib/media.ts) – die SVG bleibt
 * automatisch als Fallback erhalten.
 */
export interface Venue {
  id: string;
  /** Anzeigename ohne „Club Ludwig – “ Präfix */
  name: string;
  /** Ort laut USC-Eintrag */
  area: string;
  /** Partnerseite bei Urban Sports Club */
  uscUrl: string;
  /** Kurzbeschreibung für die Regionen-Sektion */
  text: string;
  /** Basisname der Illustration in /assets/graphics/ (ohne Endung) */
  media: string;
  alt: string;
}

export const venues: readonly Venue[] = [
  {
    id: 'hofgarten',
    name: 'Hofgarten',
    area: 'Bonn',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-hofgarten',
    text: 'Unser Einstieg mitten in Bonn. Von hier starten Urban Hikes, Community Walks und entspannte Feierabendtouren entlang des Rheins.',
    media: 'panel-city',
    alt: 'Bonner Hofgarten bei Nacht als Startpunkt einer Tour',
  },
  {
    id: 'drachenfels',
    name: 'Drachenfels',
    area: 'Königswinter',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-drachenfels',
    text: 'Der Klassiker über dem Rhein – Serpentinen, weite Blicke und unten wartet das Wasser.',
    media: 'region-drachenfels',
    alt: 'Drachenfels mit Burgruine über dem Rhein',
  },
  {
    id: 'ennert',
    name: 'Ennert',
    area: 'Beuel',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-ennert',
    text: 'Stille Waldpfade direkt hinter Beuel – unsere liebste Feierabendrunde.',
    media: 'region-ennert',
    alt: 'Stiller Waldpfad im Ennert hinter Beuel',
  },
  {
    id: 'heisterbach',
    name: 'Heisterbach',
    area: 'Königswinter',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-heisterbach',
    text: 'Start an der alten Klosterruine, dann hinauf in die stillen Buchenwälder des Siebengebirges.',
    media: 'region-heisterbach',
    alt: 'Chorruine der Abtei Heisterbach im Siebengebirge',
  },
  {
    id: 'waldau',
    name: 'Waldau',
    area: 'Ippendorf',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-waldau',
    text: 'Alte Alleen, offene Lichtungen und viel Raum für Gespräche – perfekt für die erste Tour mit uns.',
    media: 'region-waldau',
    alt: 'Baumallee im Kottenforst bei der Waldau',
  },
  {
    id: 'ziepchensplatz',
    name: 'Ziepchensplatz',
    area: 'Bad Honnef',
    uscUrl: 'https://urbansportsclub.com/de/venues/club-ludwig-ziepchensplatz',
    text: 'Ausgangspunkt im Süden: vom Ortskern hinauf ins Rheintal mit Blick zurück auf das Siebengebirge.',
    media: 'region-ziepchensplatz',
    alt: 'Blick vom Rheintal bei Bad Honnef auf das Siebengebirge',
  },
];

export function getVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

/** Standort für den Haupt-CTA „Mitwandern“. */
export function requireVenue(id: string): Venue {
  const v = getVenue(id);
  if (!v) throw new Error(`Unbekannter Standort: "${id}" (siehe src/data/venues.ts)`);
  return v;
}
