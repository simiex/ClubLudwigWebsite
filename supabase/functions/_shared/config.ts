/**
 * ============================================================================
 * Gemeinsame Konfiguration aller Newsletter-Functions
 * ============================================================================
 * Secrets werden im Supabase-Dashboard gesetzt
 * (Edge Functions → Secrets) bzw. lokal in supabase/.env.local.
 * ============================================================================
 */

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** API-Key von resend.com */
export const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

/*
 * Die Rückfallwerte sind keine Beispiele.
 *
 * Fehlt ein Secret, laufen die Functions damit weiter, statt abzubrechen - und
 * das ist richtig so, nur muss der Rückfall dann auf eine Domain zeigen, die
 * es gibt. Als clubludwig.de wegfiel, standen hier drei tote Adressen, von
 * denen niemand etwas gemerkt hätte, solange die Secrets gesetzt sind. Die
 * Zeilen gehören deshalb zu jedem Domainwechsel dazu.
 *
 * Deno läuft getrennt vom Astro-Build; src/config/site.ts ist hier nicht
 * erreichbar. Wer die Domain ändert, ändert sie dort UND hier.
 */

/*
 * Absender auf der Versand-Subdomain, Antwort auf der nackten Domain.
 *
 * Verifiziert ist bei Resend `send.clubludwig.app`, nicht `clubludwig.app` -
 * auf der nackten Domain legt Cloudflare Email Routing einen eigenen
 * SPF-Eintrag an, und zwei davon auf derselben Domain sind ungueltig.
 * Ein Absender auf `clubludwig.app` wuerde von Resend also abgewiesen.
 *
 * `reply_to` ist ein eigenes Feld und an die Absenderdomain nicht gebunden.
 * Antworten gehen deshalb an die Adresse, die auch im Impressum steht.
 */
export const MAIL_FROM = Deno.env.get('NEWSLETTER_FROM') ?? 'Club Ludwig <post@send.clubludwig.app>';
export const MAIL_REPLY_TO = Deno.env.get('NEWSLETTER_REPLY_TO') ?? 'simon@clubludwig.app';

/** Öffentliche Basis-URL der Website (ohne Slash am Ende). */
export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://clubludwig.app';

/**
 * Die Domain als sichtbarer Text – abgeleitet, nicht geschrieben.
 *
 * In der Fußzeile jeder Mail steht die Domain einmal als Link und einmal als
 * Beschriftung. Die Beschriftung war fest verdrahtet und folgte SITE_URL
 * nicht: Nach dem Wechsel hätte dort weiter „clubludwig.de" gestanden,
 * verlinkt auf clubludwig.app. Kein Secret der Welt heilt das.
 */
export const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Basis-URL der Functions, für Bestätigungs- und Abmeldelinks. */
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Leitet nach Bestätigung/Abmeldung auf die passende Seite weiter. */
export function redirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}${path}` },
  });
}

/** Erste IP aus der Proxy-Kette – für den Opt-in-Nachweis. */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return null;
  const ip = fwd.split(',')[0]?.trim();
  return ip && ip.length > 0 ? ip : null;
}

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}
