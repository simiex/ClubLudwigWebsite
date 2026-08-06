/**
 * ============================================================================
 * Marsch-Typen und Formatierung für den Newsletter
 * ============================================================================
 * Bewusst eine eigene Kopie statt eines Imports aus src/lib/marches.ts:
 * Edge Functions laufen in Deno und werden getrennt vom Astro-Build
 * deployt. Die Formatierung ist absichtlich identisch gehalten.
 * ============================================================================
 */

export interface March {
  slug: string;
  title: string;
  organizer: string;
  organizer_url: string | null;
  format: string;
  start_date: string;
  end_date: string | null;
  city: string;
  region: string | null;
  country: string;
  distances_km: number[] | null;
  time_limit_hours: number | null;
  price_from: number | null;
  event_url: string | null;
  note: string | null;
  status: string;
}

export interface ClubEvent {
  slug: string;
  title: string;
  starts_at: string | null;
  meeting_point: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  status: string;
  registration_url: string | null;
}

export const FORMAT_LABEL: Record<string, string> = {
  marsch: 'Marsch',
  '24h': '24 Stunden',
  backyard: 'Backyard',
  etappen: 'Etappen',
  nachtmarsch: 'Nachtmarsch',
  wanderung: 'Wanderung',
};

export const STATUS_LABEL: Record<string, string> = {
  anmeldung_offen: 'Anmeldung offen',
  ausgebucht: 'Ausgebucht',
  abgesagt: 'Abgesagt',
};

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** „Samstag, 8. August" – im Newsletter zählt der Wochentag mehr als das Jahr. */
export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function formatDateRange(m: { start_date: string; end_date: string | null }): string {
  const s = new Date(`${m.start_date}T12:00:00Z`);
  const day = s.getUTCDate();
  const month = MONTHS[s.getUTCMonth()];
  if (!m.end_date || m.end_date === m.start_date) {
    return `${WEEKDAYS[s.getUTCDay()]}, ${day}. ${month}`;
  }
  const e = new Date(`${m.end_date}T12:00:00Z`);
  if (e.getUTCMonth() === s.getUTCMonth()) {
    return `${day}.–${e.getUTCDate()}. ${month}`;
  }
  return `${day}. ${month} – ${e.getUTCDate()}. ${MONTHS[e.getUTCMonth()]}`;
}

/** Kurzform ohne Wochentag – für die Vorschau-Liste. */
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function formatDistances(m: March): string {
  if (!m.distances_km || m.distances_km.length === 0) return 'Distanzen folgen';
  return (
    m.distances_km
      .map((d) => String(d).replace('.', ',').replace(/,0$/, ''))
      .join(' · ') + ' km'
  );
}

/* -------------------------------------------------------------------------- */
/* Wochenlogik                                                                 */
/* -------------------------------------------------------------------------- */

/** Aktuelles Datum in Europe/Berlin als YYYY-MM-DD. */
export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
}

/** Aktuelle Stunde in Europe/Berlin (0–23). */
export function berlinHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );
}

/** Montag der Woche, in der `iso` liegt. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Montag = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** „10.–16. August 2026" für die Betreffzeile. */
export function weekLabel(monday: string): string {
  const s = new Date(`${monday}T12:00:00Z`);
  const e = new Date(`${addDays(monday, 6)}T12:00:00Z`);
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${s.getUTCDate()}.–${e.getUTCDate()}. ${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  }
  return (
    `${s.getUTCDate()}. ${MONTHS[s.getUTCMonth()]} – ` +
    `${e.getUTCDate()}. ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`
  );
}
