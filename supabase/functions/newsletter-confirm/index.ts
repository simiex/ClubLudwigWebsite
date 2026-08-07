/**
 * ============================================================================
 * newsletter-confirm
 * ============================================================================
 * Zielseite des Bestätigungslinks aus der Double-Opt-in-Mail.
 * Setzt den Status auf 'confirmed', protokolliert Zeitpunkt und IP als
 * Einwilligungsnachweis und verbrennt den Token.
 *
 * Deploy:  supabase functions deploy newsletter-confirm --no-verify-jwt
 * ============================================================================
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { FUNCTIONS_URL, SERVICE_ROLE_KEY, SUPABASE_URL, clientIp, redirect } from '../_shared/config.ts';

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return redirect('/newsletter/?status=fehler');

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: sub } = await db
    .from('newsletter_subscribers')
    .select('id, status, email')
    .eq('confirm_token', token)
    .maybeSingle();

  if (!sub) {
    // Token schon benutzt oder abgelaufen – meistens ein zweiter Klick.
    return redirect('/newsletter/?status=abgelaufen');
  }

  const { error } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirm_ip: clientIp(req),
      confirm_token: null,
    })
    .eq('id', sub.id);

  if (error) {
    console.error('[confirm] Update fehlgeschlagen:', error.message);
    return redirect('/newsletter/?status=fehler');
  }

  /*
   * Erstausgabe sofort hinterher: Wer sich am Dienstag anmeldet, soll nicht
   * bis zum nächsten Montag auf die erste Mail warten. Der Versand läuft über
   * newsletter-weekly, damit es nur eine Stelle gibt, die den Inhalt baut.
   * Ein Fehler dabei darf die Bestätigung nicht kippen – die ist gespeichert.
   */
  try {
    const res = await fetch(`${FUNCTIONS_URL}/newsletter-weekly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ welcome_for: sub.email }),
    });
    if (!res.ok) {
      console.error('[confirm] Erstausgabe fehlgeschlagen:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[confirm] Erstausgabe fehlgeschlagen:', (err as Error).message);
  }

  return redirect('/newsletter/?status=bestaetigt');
});
