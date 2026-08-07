/**
 * ============================================================================
 * newsletter-subscribe
 * ============================================================================
 * Nimmt eine E-Mail-Adresse entgegen und verschickt die Bestätigungsmail.
 * Eingetragen wird nur `status = 'pending'` – versendet wird erst nach dem
 * Klick auf den Bestätigungslink (Double Opt-in, § 7 UWG).
 *
 * Antwortet bewusst immer gleich, egal ob die Adresse schon bekannt ist.
 * Sonst ließe sich über das Formular herausfinden, wer angemeldet ist.
 *
 * Deploy:  supabase functions deploy newsletter-subscribe --no-verify-jwt
 * ============================================================================
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  CORS_HEADERS,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
  FUNCTIONS_URL,
  clientIp,
  json,
  randomToken,
} from '../_shared/config.ts';
import { sendMail } from '../_shared/mailer.ts';
import { confirmHtml, confirmText } from '../_shared/templates.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Immer dieselbe Antwort – verrät nicht, ob die Adresse schon existiert. */
const OK = { ok: true, message: 'Fast geschafft: Bitte bestätige die Anmeldung in deinem Postfach.' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { email?: string; website?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }

  // Honeypot: echte Menschen füllen ein unsichtbares Feld nicht aus.
  if (body.website) return json(OK);

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ip = clientIp(req);
  const ua = req.headers.get('user-agent')?.slice(0, 300) ?? null;

  /*
   * Bremse gegen Massenanmeldungen von einer Adresse aus.
   *
   * Gezählt werden nur unbestätigte Anmeldungen: Genau die erzeugt ein Bot,
   * während eine bestätigte Zeile für einen echten Menschen mit Zugriff auf
   * sein Postfach steht.
   *
   * Die Grenze ist bewusst hoch. Mobilfunkanbieter stecken sehr viele Kunden
   * hinter dieselbe öffentliche IPv4 – nach einem Post in einer Story kommen
   * echte Anmeldungen darum gebündelt von wenigen IPs. Bei zu enger Grenze
   * gingen sie lautlos verloren, denn abgewiesen wird mit der Erfolgsmeldung.
   */
  const ANMELDUNGEN_PRO_IP_UND_STUNDE = 20;

  if (ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('signup_ip', ip)
      .eq('status', 'pending')
      .gte('created_at', since);
    if ((count ?? 0) >= ANMELDUNGEN_PRO_IP_UND_STUNDE) {
      console.warn(`[subscribe] IP-Grenze erreicht: ${ip} (${count} offene Anmeldungen/Stunde)`);
      return json(OK);
    }
  }

  const { data: existing } = await db
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email_normalized', email)
    .maybeSingle();

  // Bereits bestätigt: nichts tun, aber auch nichts verraten.
  if (existing?.status === 'confirmed') return json(OK);

  const token = randomToken(24);

  if (existing) {
    // 'pending' oder 'unsubscribed' → neuer Token, neue Bestätigungsmail
    const { error } = await db
      .from('newsletter_subscribers')
      .update({
        status: 'pending',
        confirm_token: token,
        created_at: new Date().toISOString(),
        confirmed_at: null,
        unsubscribed_at: null,
        signup_ip: ip,
        signup_user_agent: ua,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[subscribe] Update fehlgeschlagen:', error.message);
      return json({ error: 'Das hat gerade nicht geklappt. Bitte später erneut versuchen.' }, 500);
    }
  } else {
    const { error } = await db.from('newsletter_subscribers').insert({
      email,
      status: 'pending',
      confirm_token: token,
      signup_ip: ip,
      signup_user_agent: ua,
      source: body.source ?? 'website',
    });
    if (error) {
      console.error('[subscribe] Insert fehlgeschlagen:', error.message);
      return json({ error: 'Das hat gerade nicht geklappt. Bitte später erneut versuchen.' }, 500);
    }
  }

  const confirmUrl = `${FUNCTIONS_URL}/newsletter-confirm?token=${token}`;

  try {
    await sendMail({
      to: email,
      subject: 'Bitte bestätige deine Anmeldung – Club Ludwig',
      html: confirmHtml(confirmUrl),
      text: confirmText(confirmUrl),
    });
  } catch (err) {
    console.error('[subscribe] Mailversand fehlgeschlagen:', (err as Error).message);
    return json({ error: 'Die Bestätigungsmail konnte nicht zugestellt werden.' }, 502);
  }

  return json(OK);
});
