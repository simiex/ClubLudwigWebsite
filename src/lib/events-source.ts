/**
 * ============================================================================
 * EVENTQUELLE FÜR DIE ÖFFENTLICHEN SEITEN
 * ============================================================================
 * Führende Quelle sind die Events in Supabase. Beim Build werden sie einmal
 * abgerufen und statisch in die Seiten gerendert – damit bleiben Startseite
 * und Tourenkalender schnell, indexierbar und liefern schema.org-Daten.
 *
 * Ist Supabase beim Build nicht erreichbar (Offline-Build, Netzwerksperre,
 * Ausfall), fällt der Build auf src/data/events.json zurück, statt eine leere
 * Seite auszuliefern. Der Fallback wird im Buildlog deutlich gemeldet.
 *
 * WICHTIG: Neue Events erscheinen erst nach einem Deploy. Cloudflare Pages
 * bietet dafür Deploy-Hooks – einen Hook anlegen und nach dem Anlegen eines
 * Events aufrufen, dann baut die Seite sich selbst neu.
 * ============================================================================
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, type DbEvent } from './supabase';
import type { RawClubEvent, EventStatus } from './events';
import fallbackEvents from '../data/events.json';

function toRaw(e: DbEvent): RawClubEvent {
  const startsAt = e.starts_at ? new Date(e.starts_at) : null;
  return {
    id: e.slug,
    title: e.title,
    venueId: e.venue_id ?? 'hofgarten',
    date: startsAt ? startsAt.toISOString().slice(0, 10) : null,
    time: startsAt
      ? startsAt.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Berlin',
        })
      : null,
    meetingPoint: e.meeting_point ?? '',
    distanceKm: e.distance_km === null ? null : Number(e.distance_km),
    elevationM: e.elevation_m,
    durationHours: e.duration_hours === null ? null : Number(e.duration_hours),
    terrain: e.terrain,
    difficulty: e.difficulty,
    fitness: e.fitness,
    cost: e.cost,
    dogsAllowed: e.dogs_allowed,
    status: (e.status === 'draft' ? 'offen' : e.status) as EventStatus,
    description: e.description,
    registrationUrl: e.registration_url,
  };
}

/**
 * Lädt die Events zur Build-Zeit. Nur Termine der Art „tour“ landen im
 * öffentlichen Kalender – virtuelle Events und Challenges sind Sache des
 * Mitgliederbereichs.
 */
export async function loadEvents(): Promise<RawClubEvent[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?select=*&status=neq.draft&kind=eq.tour&order=starts_at.asc`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as DbEvent[];
    console.log(`[events] ${rows.length} Event(s) aus Supabase geladen.`);
    return rows.map(toRaw);
  } catch (err) {
    console.warn(
      `\n[events] ⚠  Supabase beim Build nicht erreichbar (${(err as Error).message}).\n` +
        `[events]    Fallback auf src/data/events.json – die Seite zeigt womöglich veraltete Termine.\n`
    );
    return fallbackEvents as RawClubEvent[];
  }
}
