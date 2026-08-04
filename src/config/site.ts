/**
 * ============================================================================
 * ZENTRALE KONFIGURATION – Club Ludwig
 * ============================================================================
 * Alle veränderlichen Inhalte (Kontakt, Social-Links, Kennzahlen, Rechtsangaben)
 * stehen ausschließlich hier. Kein Wert darf hartkodiert in Komponenten liegen.
 *
 * Konvention:
 *   TODO_REQUIRED  → muss vor dem Livegang gesetzt werden.
 *                    `npm run build` bricht ab, solange der Wert gesetzt ist.
 *   null           → Wert liegt (noch) nicht vor. Die betroffene Anzeige wird
 *                    vollständig ausgeblendet, statt einen Platzhalter zu zeigen.
 * ============================================================================
 */

/** Marker für rechtlich notwendige Angaben, die den Production-Build blockieren. */
export const TODO_REQUIRED = '__TODO_REQUIRED__' as const;

export type Todo = typeof TODO_REQUIRED;

/** true, wenn ein Wert noch der Platzhalter-Marker ist. */
export function isTodo(value: unknown): value is Todo {
  return value === TODO_REQUIRED;
}

/**
 * Gibt den Wert zurück – oder null, wenn er noch ein Platzhalter ist.
 * Damit lassen sich Blöcke sauber ausblenden: `{resolve(x) && <div>…</div>}`
 */
export function resolve<T>(value: T | Todo | null | undefined): T | null {
  if (value == null || isTodo(value)) return null;
  return value;
}

/* -------------------------------------------------------------------------- */
/* Allgemein                                                                   */
/* -------------------------------------------------------------------------- */

export const site = {
  name: 'Club Ludwig',
  tagline: "From Beethoven's City to the Trails",
  claim: 'Gemeinsam raus. Gemeinsam weiter.',
  city: 'Bonn',
  country: 'Germany',
  locale: 'de-DE',
  /** Finale Domain – wird für Canonical-, OG- und schema.org-URLs genutzt. */
  url: 'https://clubludwig.de',
} as const;

/* -------------------------------------------------------------------------- */
/* Kontakt                                                                     */
/* -------------------------------------------------------------------------- */

export const contact = {
  email: 'simon@clubludwig.de' as string | Todo,
  /** Optional – wird ausgeblendet, solange null. */
  phone: null as string | null,
} as const;

/* -------------------------------------------------------------------------- */
/* Social & externe Profile                                                    */
/* -------------------------------------------------------------------------- */

export const social = {
  instagram: 'https://www.instagram.com/clubludwig/',
  strava: 'https://strava.app.link/ecgsqmoG84b',
  /** Shop – auf der USC-Partnerseite als offizielle Webseite hinterlegt. */
  shop: 'https://www.clubludwig.shop',
} as const;

/** Nur Einträge mit URL werden gerendert. */
export const socialLinks = [
  { label: 'Instagram', href: social.instagram },
  { label: 'Strava', href: social.strava },
  { label: 'Shop', href: social.shop },
].filter((l) => Boolean(resolve(l.href)));

/* -------------------------------------------------------------------------- */
/* Urban Sports Club                                                           */
/* -------------------------------------------------------------------------- */

export const urbanSports = {
  /** Haupt-CTA „Mitwandern“ – der Standort Hofgarten ist der Einstiegspunkt. */
  primaryVenueId: 'hofgarten',
  partnerName: 'Urban Sports Club',
} as const;

/* -------------------------------------------------------------------------- */
/* Kennzahlen                                                                  */
/* -------------------------------------------------------------------------- */
/**
 * null = wird auf der Seite vollständig ausgeblendet (kein Platzhalter!).
 * Erst eintragen, wenn belastbare Zahlen vorliegen.
 */
export const stats = {
  /** Anzahl Mitglieder, z. B. 240 */
  memberCount: null as number | null,
  /** Gemeinsam gegangene Kilometer, z. B. 1900 */
  kilometersTogether: null as number | null,
} as const;

/* -------------------------------------------------------------------------- */
/* Partner                                                                     */
/* -------------------------------------------------------------------------- */

export const partners: readonly string[] = ['Urban Sports Club', 'Wellhub'];

/* -------------------------------------------------------------------------- */
/* Rechtliches – blockiert den Production-Build, solange TODO_REQUIRED         */
/* -------------------------------------------------------------------------- */

export const legal = {
  /** Vollständiger Name des Diensteanbieters (§ 5 DDG) */
  providerName: 'Simon Lanzrath' as string | Todo,
  /** Straße und Hausnummer – Postfach ist nicht zulässig */
  street: 'Sankt Augustiner Str. 11' as string | Todo,
  postalCode: '53225' as string | Todo,
  city: 'Bonn' as string | Todo,
  /** Inhaltlich Verantwortlicher nach § 18 Abs. 2 MStV */
  responsibleName: 'Simon Lanzrath' as string | Todo,
  /** Rechtsform: 'privat' | 'verein' | 'gewerbe' – steuert Pflichtangaben */
  entityType: 'gewerbe' as 'privat' | 'verein' | 'gewerbe' | Todo,
  /** Nur bei Gewerbe/Verein: USt-IdNr. bzw. Registereintrag. Sonst null. */
  vatId: 'DE435108927' as string | null,
  registerEntry: null as string | null,
} as const;

/* -------------------------------------------------------------------------- */
/* Hosting (für die Datenschutzerklärung)                                      */
/* -------------------------------------------------------------------------- */

export const hosting = {
  provider: 'Cloudflare, Inc.',
  privacyUrl: 'https://www.cloudflare.com/privacypolicy/',
} as const;
