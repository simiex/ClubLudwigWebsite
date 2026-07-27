import rawEvents from '../data/events.json';

export interface ClubEvent {
  id: string;
  title: string;
  /** ISO-Datum, z. B. "2026-08-09" */
  date: string;
  /** Uhrzeit, z. B. "09:30" */
  time: string;
  meetingPoint: string;
  distance: string;
  elevation: string;
  duration: string;
  terrain: string;
  difficulty: string;
  fitness: string;
  cost: string;
  dogsAllowed: string;
  registrationStatus: string;
  description: string;
  registrationLink: string;
}

export const events: ClubEvent[] = (rawEvents as ClubEvent[])
  .slice()
  .sort((a, b) => a.date.localeCompare(b.date));

/** Alle Events ab heute (Build-Zeitpunkt), aufsteigend sortiert. */
export function getUpcomingEvents(now: Date = new Date()): ClubEvent[] {
  const today = now.toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today);
}

/** Das nächste zukünftige Event – Fallback: das letzte bekannte Event. */
export function getNextEvent(now: Date = new Date()): ClubEvent {
  const upcoming = getUpcomingEvents(now);
  return upcoming[0] ?? events[events.length - 1]!;
}

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** "09" – Tag mit führender Null (für die große Datumszahl). */
export function formatDay(event: ClubEvent): string {
  return event.date.slice(8, 10);
}

/** "August" */
export function formatMonth(event: ClubEvent): string {
  return MONTHS[toDate(event.date).getMonth()]!;
}

/** "2026" */
export function formatYear(event: ClubEvent): string {
  return event.date.slice(0, 4);
}

/** "Sonntag" */
export function formatWeekday(event: ClubEvent): string {
  return toDate(event.date).toLocaleDateString('de-DE', { weekday: 'long' });
}

/** "So., 09. Aug" – Kurzform für die Event-Leiste. */
export function formatShortDate(event: ClubEvent): string {
  const d = toDate(event.date);
  const month = d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
  return `${WEEKDAYS_SHORT[d.getDay()]}., ${formatDay(event)}. ${month}`;
}

/** "09. August 2026" */
export function formatFullDate(event: ClubEvent): string {
  return `${formatDay(event)}. ${formatMonth(event)} ${formatYear(event)}`;
}
