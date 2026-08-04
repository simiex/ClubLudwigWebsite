import rawEvents from '../data/events.json';
import { getVenue, type Venue } from '../data/venues';
import { contact, resolve, site } from '../config/site';

/* -------------------------------------------------------------------------- */
/* Typen                                                                       */
/* -------------------------------------------------------------------------- */

/** Status einer Tour. `beendet` wird zusätzlich automatisch aus dem Datum abgeleitet. */
export type EventStatus = 'offen' | 'wenige-plaetze' | 'ausgebucht' | 'abgesagt' | 'beendet';

export interface RawClubEvent {
  id: string;
  title: string;
  /** Verweis auf src/data/venues.ts */
  venueId: string;
  /** ISO-Datum "2026-08-09" – oder null, wenn der Termin noch nicht feststeht. */
  date: string | null;
  /** "09:30" – oder null. */
  time: string | null;
  meetingPoint: string;
  /** Zahlen statt Strings: erlauben Formatierung und schema.org-Ausgabe. */
  distanceKm: number | null;
  elevationM: number | null;
  durationHours: number | null;
  terrain: string | null;
  difficulty: string | null;
  fitness: string | null;
  cost: string | null;
  dogsAllowed: boolean | null;
  status: EventStatus;
  description: string;
  /** Bevorzugter Anmeldeweg. null → Urban-Sports-Club-Seite des Standorts. */
  registrationUrl: string | null;
}

export interface ClubEvent extends RawClubEvent {
  venue: Venue;
  /** Effektiver Status inkl. automatischer „beendet“-Ableitung. */
  effectiveStatus: EventStatus;
  /** true, wenn ein konkreter Termin hinterlegt ist. */
  hasDate: boolean;
  isPast: boolean;
}

/* -------------------------------------------------------------------------- */
/* Statuslabels                                                                */
/* -------------------------------------------------------------------------- */

export const STATUS_LABELS: Record<EventStatus, string> = {
  offen: 'Anmeldung offen',
  'wenige-plaetze': 'Nur noch wenige Plätze',
  ausgebucht: 'Ausgebucht',
  abgesagt: 'Abgesagt',
  beendet: 'Beendet',
};

/** Steuert die farbliche Auszeichnung im UI. */
export const STATUS_TONE: Record<EventStatus, 'go' | 'warn' | 'stop' | 'muted'> = {
  offen: 'go',
  'wenige-plaetze': 'warn',
  ausgebucht: 'stop',
  abgesagt: 'stop',
  beendet: 'muted',
};

/** Anmeldung nur möglich, solange Plätze frei sind. */
export function isBookable(event: ClubEvent): boolean {
  return event.effectiveStatus === 'offen' || event.effectiveStatus === 'wenige-plaetze';
}

/* -------------------------------------------------------------------------- */
/* Aufbereitung                                                                */
/* -------------------------------------------------------------------------- */

const VALID_STATUS: readonly EventStatus[] = [
  'offen',
  'wenige-plaetze',
  'ausgebucht',
  'abgesagt',
  'beendet',
];

function todayIso(now: Date): string {
  const tz = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function hydrate(raw: RawClubEvent, now: Date): ClubEvent {
  const venue = getVenue(raw.venueId);
  if (!venue) {
    throw new Error(
      `Event "${raw.id}" verweist auf unbekannten Standort "${raw.venueId}". ` +
        `Bekannte IDs siehe src/data/venues.ts.`
    );
  }
  if (!VALID_STATUS.includes(raw.status)) {
    throw new Error(
      `Event "${raw.id}" hat den ungültigen Status "${raw.status}". ` +
        `Erlaubt: ${VALID_STATUS.join(', ')}.`
    );
  }
  if (raw.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new Error(`Event "${raw.id}": date muss ISO-Format (YYYY-MM-DD) oder null sein.`);
  }

  const hasDate = raw.date !== null;
  const isPast = hasDate && raw.date! < todayIso(now);
  // „abgesagt“ bleibt bestehen, auch wenn der Termin vorbei ist.
  const effectiveStatus: EventStatus =
    raw.status === 'abgesagt' ? 'abgesagt' : isPast ? 'beendet' : raw.status;

  return { ...raw, venue, hasDate, isPast, effectiveStatus };
}

/** Wandelt beliebige Rohdaten (DB oder JSON) in aufbereitete Events um. */
export function buildEvents(raw: RawClubEvent[], now: Date = new Date()): ClubEvent[] {
  return raw
    .map((e) => hydrate(e, now))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.title.localeCompare(b.title, 'de');
    });
}

/** Alle Events aus der statischen Datei (Fallback-Pfad). */
export function getAllEvents(now: Date = new Date()): ClubEvent[] {
  return (rawEvents as RawClubEvent[])
    .map((e) => hydrate(e, now))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.title.localeCompare(b.title, 'de');
    });
}

export const events: ClubEvent[] = getAllEvents();

/** Kommende Touren aus einer bereits aufbereiteten Liste. */
export function upcomingFrom(list: ClubEvent[]): ClubEvent[] {
  return list.filter((e) => !e.isPast && e.effectiveStatus !== 'beendet');
}

/** Vergangene Touren aus einer bereits aufbereiteten Liste, jüngste zuerst. */
export function pastFrom(list: ClubEvent[]): ClubEvent[] {
  return list.filter((e) => e.isPast).reverse();
}

/** Nächstes Event aus einer bereits aufbereiteten Liste. */
export function nextFrom(list: ClubEvent[]): ClubEvent | null {
  const upcoming = upcomingFrom(list);
  const dated = upcoming.filter((e) => e.hasDate && e.effectiveStatus !== 'abgesagt');
  if (dated.length > 0) return dated[0]!;
  const undated = upcoming.filter((e) => !e.hasDate);
  if (undated.length > 0) return undated[0]!;
  if (upcoming.length > 0) return upcoming[0]!;
  return pastFrom(list)[0] ?? null;
}

/** Kommende Touren: künftige Termine plus solche, deren Datum noch offen ist. */
export function getUpcomingEvents(now: Date = new Date()): ClubEvent[] {
  return getAllEvents(now).filter((e) => !e.isPast && e.effectiveStatus !== 'beendet');
}

/** Vergangene Touren, absteigend (jüngste zuerst). */
export function getPastEvents(now: Date = new Date()): ClubEvent[] {
  return getAllEvents(now)
    .filter((e) => e.isPast)
    .reverse();
}

/**
 * Das nächste zukünftige Event für die Startseite.
 * Bevorzugt buchbare Termine mit Datum, dann Termine ohne Datum,
 * zuletzt (Fallback) das jüngste vergangene Event. null, wenn gar nichts vorliegt.
 */
export function getNextEvent(now: Date = new Date()): ClubEvent | null {
  const upcoming = getUpcomingEvents(now);
  const dated = upcoming.filter((e) => e.hasDate && e.effectiveStatus !== 'abgesagt');
  if (dated.length > 0) return dated[0]!;
  const undated = upcoming.filter((e) => !e.hasDate);
  if (undated.length > 0) return undated[0]!;
  if (upcoming.length > 0) return upcoming[0]!;
  return getPastEvents(now)[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Anmeldung                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Anmeldeziel eines Events, in dieser Reihenfolge:
 *   1. registrationUrl aus den Eventdaten
 *   2. Urban-Sports-Club-Seite des Standorts
 *   3. mailto als reiner Fallback (nur wenn eine Kontaktadresse konfiguriert ist)
 */
export function getRegistrationTarget(
  event: ClubEvent
): { href: string; kind: 'url' | 'usc' | 'mailto'; external: boolean } | null {
  if (event.registrationUrl) {
    return { href: event.registrationUrl, kind: 'url', external: true };
  }
  if (event.venue.uscUrl) {
    return { href: event.venue.uscUrl, kind: 'usc', external: true };
  }
  const email = resolve(contact.email);
  if (email) {
    const subject = encodeURIComponent(`Anmeldung ${event.title}`);
    return { href: `mailto:${email}?subject=${subject}`, kind: 'mailto', external: false };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Formatierung                                                                */
/* -------------------------------------------------------------------------- */

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** "09" – oder null, wenn kein Termin feststeht. */
export function formatDay(event: ClubEvent): string | null {
  return event.date ? event.date.slice(8, 10) : null;
}

export function formatMonth(event: ClubEvent): string | null {
  return event.date ? MONTHS[toDate(event.date).getMonth()]! : null;
}

export function formatYear(event: ClubEvent): string | null {
  return event.date ? event.date.slice(0, 4) : null;
}

export function formatWeekday(event: ClubEvent): string | null {
  return event.date ? toDate(event.date).toLocaleDateString('de-DE', { weekday: 'long' }) : null;
}

/** "So., 09. Aug" – oder "Termin folgt". */
export function formatShortDate(event: ClubEvent): string {
  if (!event.date) return 'Termin folgt';
  const d = toDate(event.date);
  const month = d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
  return `${WEEKDAYS_SHORT[d.getDay()]}., ${formatDay(event)}. ${month}`;
}

/** "09. August 2026" – oder null. */
export function formatFullDate(event: ClubEvent): string | null {
  if (!event.date) return null;
  return `${formatDay(event)}. ${formatMonth(event)} ${formatYear(event)}`;
}

/** "21,3 km" – null, wenn nicht hinterlegt. */
export function formatDistance(event: ClubEvent): string | null {
  if (event.distanceKm == null) return null;
  return `${event.distanceKm.toLocaleString('de-DE')} km`;
}

export function formatElevation(event: ClubEvent): string | null {
  if (event.elevationM == null) return null;
  return `${event.elevationM.toLocaleString('de-DE')} hm`;
}

export function formatDuration(event: ClubEvent): string | null {
  if (event.durationHours == null) return null;
  return `ca. ${event.durationHours.toLocaleString('de-DE')} h`;
}

export function formatDogs(event: ClubEvent): string | null {
  if (event.dogsAllowed == null) return null;
  return event.dogsAllowed ? 'Ja, angeleint' : 'Nein';
}

/**
 * Metadaten-Paare für die Detailanzeige – leere Werte fallen komplett weg,
 * statt leer zu erscheinen.
 */
export function getEventMeta(event: ClubEvent): Array<{ label: string; value: string; wide?: boolean }> {
  const entries: Array<{ label: string; value: string | null; wide?: boolean }> = [
    { label: 'Start', value: event.meetingPoint },
    { label: 'Standort', value: `${event.venue.name} · ${event.venue.area}` },
    { label: 'Distanz', value: formatDistance(event) },
    { label: 'Höhenmeter', value: formatElevation(event) },
    { label: 'Dauer', value: formatDuration(event) },
    { label: 'Level', value: event.difficulty },
    { label: 'Gelände', value: event.terrain, wide: true },
    { label: 'Fitness', value: event.fitness, wide: true },
    { label: 'Hund erlaubt', value: formatDogs(event), wide: true },
    { label: 'Kosten', value: event.cost, wide: true },
  ];
  return entries
    .filter((e): e is { label: string; value: string; wide?: boolean } => Boolean(e.value))
    .map(({ label, value, wide }) => ({ label, value, ...(wide ? { wide } : {}) }));
}

/* -------------------------------------------------------------------------- */
/* schema.org                                                                  */
/* -------------------------------------------------------------------------- */

const SCHEMA_STATUS: Record<EventStatus, string> = {
  offen: 'https://schema.org/EventScheduled',
  'wenige-plaetze': 'https://schema.org/EventScheduled',
  ausgebucht: 'https://schema.org/EventScheduled',
  abgesagt: 'https://schema.org/EventCancelled',
  beendet: 'https://schema.org/EventScheduled',
};

const SCHEMA_AVAILABILITY: Partial<Record<EventStatus, string>> = {
  offen: 'https://schema.org/InStock',
  'wenige-plaetze': 'https://schema.org/LimitedAvailability',
  ausgebucht: 'https://schema.org/SoldOut',
};

/**
 * schema.org/Event – nur mit tatsächlich vorhandenen Feldern.
 * Ohne Datum ist ein Event laut Spezifikation unvollständig; in dem Fall
 * geben wir bewusst null zurück, statt ein Datum zu erfinden.
 */
export function toEventSchema(event: ClubEvent): Record<string, unknown> | null {
  if (!event.date) return null;

  const startDate = event.time ? `${event.date}T${event.time}:00+02:00` : event.date;
  const registration = getRegistrationTarget(event);

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate,
    eventStatus: SCHEMA_STATUS[event.effectiveStatus],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: `${site.name} – ${event.venue.name}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.venue.area,
        addressCountry: 'DE',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: site.name,
      url: site.url,
    },
  };

  const availability = SCHEMA_AVAILABILITY[event.effectiveStatus];
  if (registration && availability) {
    schema.offers = {
      '@type': 'Offer',
      url: registration.href,
      availability,
      category: 'Urban Sports Club',
    };
  }

  return schema;
}
