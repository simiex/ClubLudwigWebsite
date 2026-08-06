/**
 * ============================================================================
 * Mailversand über Resend
 * ============================================================================
 * Warum Resend: verifizierte Absenderdomain mit SPF/DKIM, Batch-Endpunkt für
 * bis zu 100 individuelle Mails pro Request, kein eigener Mailserver nötig.
 * Austauschbar – nur diese Datei müsste für einen anderen Anbieter angefasst
 * werden.
 * ============================================================================
 */
import { MAIL_FROM, MAIL_REPLY_TO, RESEND_API_KEY } from './config.ts';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** List-Unsubscribe-Header: Abmelden direkt aus Gmail/Apple Mail heraus. */
  unsubscribeUrl?: string;
}

function payload(m: Mail) {
  return {
    from: MAIL_FROM,
    to: [m.to],
    reply_to: MAIL_REPLY_TO,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${m.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined,
  };
}

export async function sendMail(m: Mail): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload(m)),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

/**
 * Versendet in Paketen zu 100. Gibt zurück, welche Adressen durchgefallen
 * sind – der Rest geht trotzdem raus, ein kaputter Empfänger darf den
 * Newsletter nicht stoppen.
 */
export async function sendBatch(mails: Mail[]): Promise<{ sent: number; failed: string[] }> {
  const failed: string[] = [];
  let sent = 0;

  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map(payload)),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      sent += chunk.length;
    } catch (err) {
      console.error('[newsletter] Batch fehlgeschlagen:', (err as Error).message);
      failed.push(...chunk.map((m) => m.to));
    }
    // Resend drosselt bei zu vielen Requests pro Sekunde
    if (i + 100 < mails.length) await new Promise((r) => setTimeout(r, 600));
  }

  return { sent, failed };
}
