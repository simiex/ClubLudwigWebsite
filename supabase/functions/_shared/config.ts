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

/** Absender – die Domain muss bei Resend verifiziert sein (SPF/DKIM). */
export const MAIL_FROM = Deno.env.get('NEWSLETTER_FROM') ?? 'Club Ludwig <post@clubludwig.de>';
export const MAIL_REPLY_TO = Deno.env.get('NEWSLETTER_REPLY_TO') ?? 'simon@clubludwig.de';

/** Öffentliche Basis-URL der Website (ohne Slash am Ende). */
export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://clubludwig.de';

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
