/**
 * ============================================================================
 * newsletter-weekly
 * ============================================================================
 * Der eigentliche Versand. Läuft montags per pg_cron (siehe Migration).
 *
 * Ablauf:
 *   1. Wochenfenster bestimmen (Montag–Sonntag, Europe/Berlin)
 *   2. Prüfen, ob diese Woche schon versendet wurde  → sonst Abbruch
 *   3. Märsche der Woche + eigene Touren + Ausblick laden
 *   4. Für jede bestätigte Adresse eine eigene Mail bauen (eigener
 *      Abmeldelink) und in Paketen zu 100 verschicken
 *   5. Versand protokollieren
 *
 * Manueller Aufruf (Service-Role-Key nötig):
 *   { "force": true }                     → sendet, auch wenn schon versendet
 *   { "test_to": "simon@clubludwig.de" }  → nur an diese Adresse, kein Protokoll
 *   { "dry": true }                       → verschickt nichts, gibt Vorschau-HTML
 * ============================================================================
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  CORS_HEADERS,
  FUNCTIONS_URL,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
  json,
} from '../_shared/config.ts';
import { sendBatch, type Mail } from '../_shared/mailer.ts';
import {
  addDays,
  berlinHour,
  berlinToday,
  weekStart,
  type ClubEvent,
  type March,
} from '../_shared/marches.ts';
import { weeklyHtml, weeklySubject, weeklyText, type WeeklyInput } from '../_shared/templates.ts';

/** Wie weit der Ausblick reicht und wie viele Einträge er zeigt. */
const OUTLOOK_DAYS = 28;
const OUTLOOK_MAX = 6;

/** Datumsteil eines Zeitstempels in Berliner Zeit – für die Wochenzuordnung. */
function berlinDate(ts: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(ts));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Nur mit Service-Role-Key aufrufbar (Cron und Admin).
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: 'Unauthorized' }, 401);

  const opts: { force?: boolean; test_to?: string; dry?: boolean } = await req
    .json()
    .catch(() => ({}));

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  /* --- 1. Wochenfenster ------------------------------------------------- */
  const today = berlinToday();
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const outlookEnd = addDays(sunday, OUTLOOK_DAYS);

  /*
   * pg_cron rechnet in UTC, deshalb sind zwei Jobs eingetragen (Sommer- und
   * Winterzeit). Der zu frühe Lauf bricht hier ab, statt um 6 Uhr zu senden.
   */
  if (!opts.force && !opts.test_to && !opts.dry && berlinHour() < 7) {
    return json({ skipped: 'zu früh (vor 07:00 Berliner Zeit)' });
  }

  /* --- 2. Doppelversand ausschließen ------------------------------------ */
  if (!opts.force && !opts.test_to && !opts.dry) {
    const { data: already } = await db
      .from('newsletter_sends')
      .select('week_start')
      .eq('week_start', monday)
      .maybeSingle();
    if (already) return json({ skipped: `Woche ${monday} wurde bereits versendet.` });
  }

  /* --- 3. Inhalte laden -------------------------------------------------- */
  const { data: marchRows, error: marchErr } = await db
    .from('marches')
    .select('*')
    .neq('status', 'entwurf')
    .neq('status', 'abgesagt')
    .gte('start_date', addDays(monday, -30))
    .lte('start_date', outlookEnd)
    .order('start_date', { ascending: true });

  if (marchErr) {
    console.error('[weekly] Märsche konnten nicht geladen werden:', marchErr.message);
    return json({ error: marchErr.message }, 500);
  }

  const marches = (marchRows ?? []) as March[];

  // Diese Woche: startet zwischen Montag und Sonntag – oder läuft noch.
  const thisWeek = marches.filter((m) => {
    const end = m.end_date ?? m.start_date;
    return m.start_date <= sunday && end >= today;
  });

  const inWeek = new Set(thisWeek.map((m) => m.slug));
  const outlook = marches
    .filter((m) => !inWeek.has(m.slug) && m.start_date > sunday && m.start_date <= outlookEnd)
    .slice(0, OUTLOOK_MAX);

  // Eigene Touren derselben Woche
  const { data: eventRows } = await db
    .from('events')
    .select('slug, title, starts_at, meeting_point, distance_km, elevation_m, status, registration_url')
    .not('starts_at', 'is', null)
    .gte('starts_at', `${addDays(monday, -1)}T00:00:00Z`)
    .lte('starts_at', `${addDays(sunday, 1)}T23:59:59Z`)
    .not('status', 'in', '("draft","beendet","abgesagt")')
    .order('starts_at', { ascending: true });

  const ownEvents = ((eventRows ?? []) as ClubEvent[]).filter((e) => {
    if (!e.starts_at) return false;
    const d = berlinDate(e.starts_at);
    return d >= today && d <= sunday;
  });

  /* --- 4. Empfänger ------------------------------------------------------ */
  let recipients: Array<{ id: string; email: string; unsubscribe_token: string }>;

  if (opts.test_to) {
    recipients = [{ id: 'test', email: opts.test_to, unsubscribe_token: 'test-token' }];
  } else {
    const { data, error } = await db
      .from('newsletter_subscribers')
      .select('id, email, unsubscribe_token')
      .eq('status', 'confirmed');
    if (error) {
      console.error('[weekly] Empfänger konnten nicht geladen werden:', error.message);
      return json({ error: error.message }, 500);
    }
    recipients = data ?? [];
  }

  const base: Omit<WeeklyInput, 'unsubscribeUrl'> = { monday, thisWeek, ownEvents, outlook };
  const subject = weeklySubject({ ...base, unsubscribeUrl: '' });

  /* Vorschau ohne Versand – praktisch zum Gegenlesen vor dem Montag. */
  if (opts.dry) {
    const html = weeklyHtml({ ...base, unsubscribeUrl: `${FUNCTIONS_URL}/newsletter-unsubscribe?token=demo` });
    return new Response(html, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (recipients.length === 0) {
    return json({ ok: true, note: 'Keine bestätigten Empfänger.', monday, marches: thisWeek.length });
  }

  const mails: Mail[] = recipients.map((r) => {
    const unsubscribeUrl = `${FUNCTIONS_URL}/newsletter-unsubscribe?token=${r.unsubscribe_token}`;
    const input: WeeklyInput = { ...base, unsubscribeUrl };
    return {
      to: r.email,
      subject,
      html: weeklyHtml(input),
      text: weeklyText(input),
      unsubscribeUrl,
    };
  });

  const { sent, failed } = await sendBatch(mails);

  /* --- 5. Protokoll ------------------------------------------------------ */
  if (!opts.test_to) {
    const failedSet = new Set(failed);
    const okIds = recipients.filter((r) => !failedSet.has(r.email)).map((r) => r.id);
    if (okIds.length > 0) {
      await db
        .from('newsletter_subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .in('id', okIds);
    }

    await db.from('newsletter_sends').upsert(
      {
        week_start: monday,
        subject,
        march_count: thisWeek.length,
        event_count: ownEvents.length,
        recipients: sent,
        failed: failed.length,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'week_start' }
    );
  }

  console.log(`[weekly] ${monday}: ${sent} versendet, ${failed.length} fehlgeschlagen.`);
  return json({
    ok: true,
    monday,
    subject,
    marches: thisWeek.length,
    events: ownEvents.length,
    outlook: outlook.length,
    sent,
    failed: failed.length,
  });
});
