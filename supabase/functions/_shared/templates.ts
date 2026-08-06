/**
 * ============================================================================
 * E-Mail-Vorlagen
 * ============================================================================
 * Tabellenlayout, Inline-Styles, feste Farben – Mailclients können kein
 * modernes CSS und keine Custom Properties. Die Farbwerte sind Kopien der
 * Tokens aus src/styles/global.css.
 *
 * Jede Mail wird zusätzlich als reiner Text ausgeliefert (bessere
 * Zustellbarkeit, Screenreader, Textclients).
 * ============================================================================
 */
import { SITE_URL } from './config.ts';
import {
  FORMAT_LABEL,
  STATUS_LABEL,
  formatDateRange,
  formatDistances,
  formatShortDate,
  formatWeekday,
  weekLabel,
  type ClubEvent,
  type March,
} from './marches.ts';

/* Farben (Kopie der Design-Tokens) */
const NIGHT = '#060d16';
const SURFACE = '#0c1522';
const CREAM = '#f2eee4';
const CREAM_DIM = '#a7a49c';
const LIME = '#dbff3e';
const NEON = '#3ef0cf';
const LINE = '#1d2836';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Externe Links absolut machen (im Kalender stehen teils Pfade wie /touren/). */
const abs = (url: string) => (url.startsWith('http') ? url : `${SITE_URL}${url}`);

/* -------------------------------------------------------------------------- */
/* Grundgerüst                                                                 */
/* -------------------------------------------------------------------------- */

function shell(opts: { preheader: string; body: string; footer: string }): string {
  return `<!DOCTYPE html>
<html lang="de" style="margin:0;padding:0;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Club Ludwig</title>
</head>
<body style="margin:0;padding:0;background:${NIGHT};color:${CREAM};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${esc(
    opts.preheader
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${NIGHT}" style="background:${NIGHT};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

          <!-- Kopf -->
          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <a href="${SITE_URL}/" style="text-decoration:none;">
                <img src="${SITE_URL}/assets/logo-white.png" width="180" height="37" alt="Club Ludwig"
                     style="display:block;border:0;width:180px;height:auto;">
              </a>
            </td>
          </tr>

          ${opts.body}

          <!-- Fuß -->
          <tr>
            <td style="padding:36px 4px 0;border-top:1px solid ${LINE};">
              <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${CREAM_DIM};">
                ${opts.footer}
              </p>
              <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#6f6d68;">
                Club Ludwig · Bonn, Deutschland ·
                <a href="${SITE_URL}/impressum/" style="color:#6f6d68;">Impressum</a> ·
                <a href="${SITE_URL}/datenschutz/" style="color:#6f6d68;">Datenschutz</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string, color = LIME): string {
  return `<tr><td style="padding:34px 4px 14px;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${color};font-weight:bold;">${esc(
      text
    )}</p>
  </td></tr>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${LIME}" style="border-radius:4px;">
      <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:.04em;color:#060d16;text-decoration:none;">${esc(
        label
      )}</a>
    </td>
  </tr></table>`;
}

/* -------------------------------------------------------------------------- */
/* Karten                                                                      */
/* -------------------------------------------------------------------------- */

function marchCard(m: March, accent = NEON): string {
  const status = STATUS_LABEL[m.status];
  const format = FORMAT_LABEL[m.format] ?? m.format;
  const link = m.event_url ?? m.organizer_url;
  const ort = [m.city, m.region].filter(Boolean).join(', ');

  const meta = [format, formatDistances(m), ort].filter(Boolean);

  return `<tr><td style="padding:0 0 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}"
           style="background:${SURFACE};border:1px solid ${LINE};border-radius:6px;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${accent};">
          ${esc(formatDateRange(m))}${status ? ` &middot; ${esc(status)}` : ''}
        </p>
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.3;font-weight:bold;color:${CREAM};">
          ${link ? `<a href="${abs(link)}" style="color:${CREAM};text-decoration:none;">${esc(m.title)}</a>` : esc(m.title)}
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${CREAM_DIM};">
          ${esc(meta.join(' · '))}<br>
          <span style="color:#7d7a74;">Veranstalter: ${esc(m.organizer)}</span>
        </p>
        ${
          m.note
            ? `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${CREAM_DIM};">${esc(
                m.note
              )}</p>`
            : ''
        }
        ${
          link
            ? `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
                 <a href="${abs(link)}" style="color:${LIME};text-decoration:none;font-weight:bold;">Zur Veranstaltung &rarr;</a>
               </p>`
            : ''
        }
      </td></tr>
    </table>
  </td></tr>`;
}

function eventCard(e: ClubEvent): string {
  const date = e.starts_at ? e.starts_at.slice(0, 10) : null;
  const time = e.starts_at
    ? new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(e.starts_at))
    : null;

  const meta = [
    e.distance_km ? `${String(e.distance_km).replace('.', ',')} km` : null,
    e.elevation_m ? `${e.elevation_m} hm` : null,
    e.meeting_point,
  ].filter(Boolean) as string[];

  return `<tr><td style="padding:0 0 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}"
           style="background:${SURFACE};border:1px solid rgba(219,255,62,.3);border-left:3px solid ${LIME};border-radius:6px;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${LIME};">
          ${date ? esc(formatWeekday(date)) : 'Termin folgt'}${time ? ` &middot; ${time} Uhr` : ''}
        </p>
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.3;font-weight:bold;color:${CREAM};">
          ${esc(e.title)}
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${CREAM_DIM};">
          ${esc(meta.join(' · '))}
        </p>
        <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
          <a href="${abs(e.registration_url ?? '/touren/')}" style="color:${LIME};text-decoration:none;font-weight:bold;">Mitwandern &rarr;</a>
        </p>
      </td></tr>
    </table>
  </td></tr>`;
}

/* -------------------------------------------------------------------------- */
/* Wochen-Newsletter                                                           */
/* -------------------------------------------------------------------------- */

export interface WeeklyInput {
  monday: string;
  /** Märsche, die in dieser Woche stattfinden */
  thisWeek: March[];
  /** Eigene Club-Ludwig-Touren dieser Woche */
  ownEvents: ClubEvent[];
  /** Ausblick auf die folgenden Wochen (kompakte Liste) */
  outlook: March[];
  unsubscribeUrl: string;
}

export function weeklySubject(input: WeeklyInput): string {
  const label = weekLabel(input.monday);
  const n = input.thisWeek.length + input.ownEvents.length;
  if (n === 0) return `Club Ludwig · Woche vom ${label}`;
  return `Diese Woche: ${n} ${n === 1 ? 'Termin' : 'Termine'} · ${label}`;
}

export function weeklyHtml(input: WeeklyInput): string {
  const { monday, thisWeek, ownEvents, outlook, unsubscribeUrl } = input;
  const label = weekLabel(monday);

  let body = `
    <tr><td style="padding:0 4px 6px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${CREAM_DIM};">
        Die Woche vom ${esc(label)}
      </p>
      <h1 style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.2;font-weight:bold;color:${CREAM};">
        ${
          thisWeek.length + ownEvents.length > 0
            ? 'Das steht diese Woche an.'
            : 'Ruhige Woche im Kalender.'
        }
      </h1>
      <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        ${
          thisWeek.length + ownEvents.length > 0
            ? 'Alle Märsche und Touren, die zwischen heute und Sonntag starten.'
            : 'Diese Woche startet kein Marsch aus unserem Kalender. Dafür lohnt der Blick nach vorne.'
        }
      </p>
    </td></tr>`;

  if (ownEvents.length > 0) {
    body += heading('Unsere Touren', LIME);
    body += ownEvents.map(eventCard).join('');
  }

  if (thisWeek.length > 0) {
    body += heading('Märsche diese Woche', NEON);
    body += thisWeek.map((m) => marchCard(m)).join('');
  }

  if (outlook.length > 0) {
    body += heading('Demnächst', '#ff9d4d');
    body += `<tr><td style="padding:0 0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}"
             style="background:${SURFACE};border:1px solid ${LINE};border-radius:6px;">
        ${outlook
          .map(
            (m, i) => `<tr><td style="padding:14px 22px;${
              i > 0 ? `border-top:1px solid ${LINE};` : ''
            }">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${CREAM};">
                ${
                  m.event_url
                    ? `<a href="${abs(m.event_url)}" style="color:${CREAM};text-decoration:none;">${esc(m.title)}</a>`
                    : esc(m.title)
                }
                <br><span style="font-size:13px;color:${CREAM_DIM};">${esc(
                  formatShortDate(m.start_date)
                )} · ${esc(m.city)} · ${esc(formatDistances(m))}</span>
              </td>
            </tr></table>
          </td></tr>`
          )
          .join('')}
      </table>
    </td></tr>`;
  }

  body += `<tr><td style="padding:30px 4px 0;">
      ${button('Ganzen Marschkalender ansehen', `${SITE_URL}/maersche/`)}
    </td></tr>`;

  const footer =
    `Du bekommst diese Mail, weil du dich für den Wochenüberblick von Club Ludwig angemeldet und ` +
    `die Anmeldung per Klick bestätigt hast.<br>` +
    `<a href="${unsubscribeUrl}" style="color:${CREAM_DIM};text-decoration:underline;">Newsletter abbestellen</a>`;

  return shell({
    preheader:
      thisWeek.length + ownEvents.length > 0
        ? `${thisWeek.length + ownEvents.length} Termine zwischen ${label}`
        : `Kein Marsch diese Woche – dafür der Ausblick.`,
    body,
    footer,
  });
}

export function weeklyText(input: WeeklyInput): string {
  const lines: string[] = [];
  lines.push(`CLUB LUDWIG – Woche vom ${weekLabel(input.monday)}`, '');

  if (input.ownEvents.length > 0) {
    lines.push('UNSERE TOUREN', '');
    for (const e of input.ownEvents) {
      const d = e.starts_at ? formatWeekday(e.starts_at.slice(0, 10)) : 'Termin folgt';
      lines.push(`${d} – ${e.title}`);
      if (e.meeting_point) lines.push(`  Treffpunkt: ${e.meeting_point}`);
      lines.push(`  ${abs(e.registration_url ?? '/touren/')}`, '');
    }
  }

  if (input.thisWeek.length > 0) {
    lines.push('MÄRSCHE DIESE WOCHE', '');
    for (const m of input.thisWeek) {
      lines.push(`${formatDateRange(m)} – ${m.title}`);
      lines.push(`  ${m.city} · ${formatDistances(m)} · ${m.organizer}`);
      const link = m.event_url ?? m.organizer_url;
      if (link) lines.push(`  ${abs(link)}`);
      lines.push('');
    }
  } else if (input.ownEvents.length === 0) {
    lines.push('Diese Woche startet kein Marsch aus unserem Kalender.', '');
  }

  if (input.outlook.length > 0) {
    lines.push('DEMNÄCHST', '');
    for (const m of input.outlook) {
      lines.push(`${formatShortDate(m.start_date)} – ${m.title} (${m.city}, ${formatDistances(m)})`);
    }
    lines.push('');
  }

  lines.push(
    `Ganzer Marschkalender: ${SITE_URL}/maersche/`,
    '',
    '—',
    'Du bekommst diese Mail, weil du dich angemeldet und die Anmeldung bestätigt hast.',
    `Abmelden: ${input.unsubscribeUrl}`,
    `Impressum: ${SITE_URL}/impressum/`
  );
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Double-Opt-in-Mail                                                          */
/* -------------------------------------------------------------------------- */

export function confirmHtml(confirmUrl: string): string {
  const body = `
    <tr><td style="padding:0 4px;">
      <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.25;font-weight:bold;color:${CREAM};">
        Noch ein Klick, dann bist du dabei.
      </h1>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        Du hast dich für den Wochenüberblick von Club Ludwig angemeldet: jeden Montagmorgen
        die Märsche und Touren der laufenden Woche, kompakt in einer Mail.
      </p>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        Bitte bestätige kurz, dass die Adresse dir gehört:
      </p>
      <div style="margin:26px 0 0;">${button('Anmeldung bestätigen', confirmUrl)}</div>
      <p style="margin:26px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#7d7a74;">
        Klappt der Button nicht, kopier diesen Link in den Browser:<br>
        <span style="color:${NEON};word-break:break-all;">${esc(confirmUrl)}</span>
      </p>
    </td></tr>`;

  return shell({
    preheader: 'Ein Klick fehlt noch zur Anmeldung.',
    body,
    footer:
      'Du hast dich nicht angemeldet? Dann ignorier diese Mail einfach – ohne Bestätigung ' +
      'verschicken wir nichts, und wir löschen die Adresse nach 14 Tagen automatisch.',
  });
}

export function confirmText(confirmUrl: string): string {
  return [
    'CLUB LUDWIG – Anmeldung bestätigen',
    '',
    'Du hast dich für den Wochenüberblick angemeldet: jeden Montag die Märsche',
    'und Touren der laufenden Woche.',
    '',
    'Bitte bestätige die Anmeldung über diesen Link:',
    confirmUrl,
    '',
    'Du hast dich nicht angemeldet? Dann ignorier diese Mail. Ohne Bestätigung',
    'verschicken wir nichts; die Adresse wird nach 14 Tagen gelöscht.',
    '',
    `${SITE_URL}/impressum/`,
  ].join('\n');
}
