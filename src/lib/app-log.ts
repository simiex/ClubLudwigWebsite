import raw from '../data/app-log.json';

/**
 * neu   – ist in der App angekommen
 * bald  – fest geplant, kommt demnächst
 * leak  – kleiner Vorgeschmack, bewusst vage
 */
export type AppLogKind = 'neu' | 'bald' | 'leak';

/** Kurzer Loop aus der App – MP4, WebM als Ausweiche, Standbild (webp) für Vorschau und reduzierte Bewegung. */
export interface AppLogMedia {
  src: string;
  webm?: string;
  poster: string;
  alt: string;
}

export interface AppLogEntry {
  /** ISO-Datum, z. B. "2026-09-29" – bei bald/leak der Tag des Eintrags */
  date: string;
  kind: AppLogKind;
  title: string;
  text: string;
  media?: AppLogMedia[];
}

const entries = raw as AppLogEntry[];

const newestFirst = (a: AppLogEntry, b: AppLogEntry) => b.date.localeCompare(a.date);

/** Was schon in der App ist, neuestes zuerst. */
export const shipped = entries.filter((e) => e.kind === 'neu').sort(newestFirst);

/** Ausblick: Geplantes und Leaks, neuestes zuerst. */
export const upcoming = entries.filter((e) => e.kind !== 'neu').sort(newestFirst);

export function formatLogDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
