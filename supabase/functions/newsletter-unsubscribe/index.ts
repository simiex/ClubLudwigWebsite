/**
 * ============================================================================
 * newsletter-unsubscribe
 * ============================================================================
 * Abmeldung mit einem Klick, ohne Login und ohne Rückfrage – so verlangt es
 * Art. 21 DSGVO und so erwarten es Gmail und Apple Mail über den
 * List-Unsubscribe-Header (dort kommt ein POST statt eines GET).
 *
 * Die Zeile bleibt bestehen (status = 'unsubscribed'), damit dieselbe Adresse
 * nicht versehentlich über einen Altbestand wieder angeschrieben wird.
 *
 * Deploy:  supabase functions deploy newsletter-unsubscribe --no-verify-jwt
 * ============================================================================
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS_HEADERS, SERVICE_ROLE_KEY, SUPABASE_URL, redirect } from '../_shared/config.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const token = new URL(req.url).searchParams.get('token');
  const oneClick = req.method === 'POST';

  if (!token) {
    return oneClick ? new Response('Missing token', { status: 400 }) : redirect('/newsletter/?status=fehler');
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { error } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      confirm_token: null,
    })
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('[unsubscribe] Update fehlgeschlagen:', error.message);
    return oneClick ? new Response('Error', { status: 500 }) : redirect('/newsletter/?status=fehler');
  }

  // Ein unbekannter Token führt trotzdem zur Bestätigungsseite: für die
  // abmeldende Person ist das Ergebnis dasselbe, und es verrät nichts.
  return oneClick ? new Response('OK', { status: 200 }) : redirect('/newsletter/?status=abgemeldet');
});
