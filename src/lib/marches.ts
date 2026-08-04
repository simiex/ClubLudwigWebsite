/**
 * ============================================================================
 * MARSCHKALENDER
 * ============================================================================
 * Kuratierte Übersicht fremder Wander- und Marschveranstaltungen.
 * Bewusst getrennt von den eigenen Club-Ludwig-Touren: hier gibt es keine
 * Anmeldung und keine Stempel, nur den Verweis auf den Veranstalter.
 *
 * Quelle ist die Tabelle `marches` in Supabase, gelesen zur Build-Zeit.
 * Fällt sie aus, greift die Datei src/data/marches.json als Rückfall.
 * ============================================================================
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase';
import fallback from '../data/marches.json';

export type MarchFormat =
  | 'marsch'
  | '24h'
  | 'backyard'
  | 'etappen'
  | 'nachtmarsch'
  | 'wanderung';

export interface March {
  slug: string;
  title: string;
  organizer: string;
  organizer_url: string | null;
  format: MarchFormat;
  start_date: string;
  end_date: string | null;
  city: string;
  region: string | null;
  country: string;
  distances_km: number[];
  time_limit_hours: number | null;
  price_from: number | null;
  event_url: string | null;
  note: string | null;
  verified_at: string | null;
  status: string;
}

/** Nur auffällige Zustände zeigen – „geplant“ ist der Normalfall. */
export const STATUS_LABEL: Record<string, string> = {
  anmeldung_offen: 'Anmeldung offen',
  ausgebucht: 'Ausgebucht',
  abgesagt: 'Abgesagt',
};

export function statusLabel(m: March): string | null {
  return STATUS_LABEL[m.status] ?? null;
}

export const FORMAT_LABEL: Record<MarchFormat, string> = {
  marsch: 'Marsch',
  '24h': '24 Stunden',
  backyard: 'Backyard',
  etappen: 'Etappen',
  nachtmarsch: 'Nachtmarsch',
  wanderung: 'Wanderung',
};

/** Grobe Einordnung für den Filter „wie weit". */
export function distanceBucket(km: number): 'kurz' | 'mittel' | 'lang' | 'ultra' {
  if (km < 30) return 'kurz';
  if (km < 60) return 'mittel';
  if (km < 100) return 'lang';
  return 'ultra';
}

export function buckets(m: March): string[] {
  return [...new Set(m.distances_km.map(distanceBucket))];
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function formatDateRange(m: March): string {
  const s = new Date(`${m.start_date}T12:00:00`);
  const day = s.getDate();
  const month = MONTHS[s.getMonth()]!;
  if (!m.end_date || m.end_date === m.start_date) {
    return `${day}. ${month} ${s.getFullYear()}`;
  }
  const e = new Date(`${m.end_date}T12:00:00`);
  if (e.getMonth() === s.getMonth()) {
    return `${day}.–${e.getDate()}. ${month} ${s.getFullYear()}`;
  }
  return `${day}. ${month} – ${e.getDate()}. ${MONTHS[e.getMonth()]} ${s.getFullYear()}`;
}

export function formatDistances(m: March): string {
  // Termin steht, Distanzen noch nicht veröffentlicht
  if (!m.distances_km || m.distances_km.length === 0) return 'Distanzen folgen';
  return m.distances_km
    .map((d) => String(d).replace('.', ',').replace(/,0$/, ''))
    .join(' · ') + ' km';
}

/** Monatsschlüssel für die Gruppierung, z. B. "2026-09". */
export function monthKey(m: March): string {
  return m.start_date.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, mo] = key.split('-');
  return `${MONTHS[Number(mo) - 1]} ${y}`;
}

/** Lädt zur Build-Zeit; nur Termine ab heute. */
export async function loadMarches(): Promise<March[]> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/marches?select=*&status=neq.entwurf&order=start_date.asc`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as March[];
    console.log(`[marches] ${rows.length} Termin(e) aus Supabase geladen.`);
    return rows.filter((m) => (m.end_date ?? m.start_date) >= today);
  } catch (err) {
    console.warn(
      `\n[marches] ⚠  Supabase beim Build nicht erreichbar (${(err as Error).message}).` +
        `\n[marches]    Fallback auf src/data/marches.json.\n`
    );
    return (fallback as March[]).filter((m) => (m.end_date ?? m.start_date) >= today);
  }
}
