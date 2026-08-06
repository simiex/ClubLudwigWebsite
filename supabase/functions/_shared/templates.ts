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
/** Trennzeichen zwischen Angaben – dunkler als der Text, damit es nicht mitliest. */
const DIVIDER = '#4d5866';
const FAINT = '#7d7a74';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Externe Links absolut machen (im Kalender stehen teils Pfade wie /touren/). */
const abs = (url: string) => (url.startsWith('http') ? url : `${SITE_URL}${url}`);

/** Senkrechter Strich zwischen zwei Angaben. */
const sep = `<span style="color:${DIVIDER};">&nbsp;|&nbsp;</span>`;

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
            <td align="center" style="padding:12px 0 64px;">
              <a href="${SITE_URL}/" style="text-decoration:none;">
                <img src="${SITE_URL}/assets/logo-white.png" width="180" height="37" alt="Club Ludwig"
                     style="display:block;border:0;width:180px;height:auto;">
              </a>
            </td>
          </tr>

          ${opts.body}

          <!-- Fuß -->
          <tr>
            <td align="center" style="padding:56px 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
              <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${CREAM_DIM};text-align:center;">
                ${opts.footer}
              </p>
              <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:2;color:#6f6d68;text-align:center;">
                <a href="${SITE_URL}/" style="color:#6f6d68;text-decoration:none;">clubludwig.de</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/impressum/" style="color:#6f6d68;text-decoration:none;">Impressum</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/datenschutz/" style="color:#6f6d68;text-decoration:none;">Datenschutz</a>
                <br>Club Ludwig · Bonn, Deutschland
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

const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const M_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * Abreißkalender-Block für die linke Spalte: Wochentag, Tageszahl, Monat.
 * Mehrtägiges wird als Spanne gesetzt (8–10) und rückt dafür eine Stufe
 * kleiner, damit die Zahl in der schmalen Spalte nicht umbricht.
 */
function dateBlock(startIso: string, endIso: string | null, accent: string): string {
  const s = new Date(`${startIso}T12:00:00Z`);
  const e = endIso && endIso !== startIso ? new Date(`${endIso}T12:00:00Z`) : null;

  const day = e ? `${s.getUTCDate()}–${e.getUTCDate()}` : String(s.getUTCDate());
  const month =
    e && e.getUTCMonth() !== s.getUTCMonth()
      ? `${M_SHORT[s.getUTCMonth()]}/${M_SHORT[e.getUTCMonth()]}`
      : M_SHORT[s.getUTCMonth()];

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${FAINT};">${
      WD_SHORT[s.getUTCDay()]
    }</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:${
      e ? '25px' : '34px'
    };line-height:1.1;font-weight:bold;color:${accent};padding:3px 0 2px;">${day}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${CREAM_DIM};">${month}</div>`;
}

/** Kleine Status-Plakette – nur, wenn sie etwas aussagt. */
function statusPill(status: string): string {
  const label = STATUS_LABEL[status];
  if (!label || status === 'anmeldung_offen') return '';
  const color = status === 'ausgebucht' ? '#ff9d4d' : CREAM_DIM;
  return `<span style="display:inline-block;padding:3px 9px;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${color};border:1px solid ${color};border-radius:99px;">${esc(
    label
  )}</span><br>`;
}

/* -------------------------------------------------------------------------- */
/* Karten                                                                      */
/* -------------------------------------------------------------------------- */

function marchCard(m: March, accent = NEON): string {
  const format = FORMAT_LABEL[m.format] ?? m.format;
  const link = m.event_url ?? m.organizer_url;
  const ort = [m.city, m.region].filter(Boolean).join(', ');

  return `<tr><td style="padding:0 0 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}"
           style="background:${SURFACE};border:1px solid ${LINE};border-radius:8px;">
      <tr>
        <!-- Datumsspalte -->
        <td width="92" valign="top" align="center"
            style="width:92px;padding:22px 0 22px 6px;border-right:1px solid ${LINE};">
          ${dateBlock(m.start_date, m.end_date, accent)}
        </td>

        <!-- Inhalt -->
        <td valign="top" style="padding:22px 24px 22px 20px;">
          ${statusPill(m.status)}
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.3;font-weight:bold;color:${CREAM};">
            ${link ? `<a href="${abs(link)}" style="color:${CREAM};text-decoration:none;">${esc(m.title)}</a>` : esc(m.title)}
          </p>

          <p style="margin:9px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${CREAM};">
            <span style="color:${accent};font-weight:bold;">${esc(formatDistances(m))}</span>${sep}${esc(format)}
          </p>
          <p style="margin:5px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${CREAM_DIM};">
            ${esc(ort)}${sep}${esc(m.organizer)}
          </p>
          ${
            m.note
              ? `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${FAINT};">${esc(
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
        </td>
      </tr>
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

  return `<tr><td style="padding:0 0 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}"
           style="background:${SURFACE};border:1px solid rgba(219,255,62,.35);border-radius:8px;">
      <tr>
        <td width="92" valign="top" align="center"
            style="width:92px;padding:22px 0 22px 6px;border-right:1px solid rgba(219,255,62,.2);">
          ${
            date
              ? dateBlock(date, null, LIME) +
                (time
                  ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${FAINT};padding-top:5px;">${time}</div>`
                  : '')
              : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${CREAM_DIM};">Termin<br>folgt</div>`
          }
        </td>

        <td valign="top" style="padding:22px 24px 22px 20px;">
          <span style="display:inline-block;padding:3px 9px;margin:0 0 9px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${LIME};border:1px solid rgba(219,255,62,.45);border-radius:99px;">Club Ludwig</span><br>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.3;font-weight:bold;color:${CREAM};">
            ${esc(e.title)}
          </p>
          ${
            meta.length > 0
              ? `<p style="margin:9px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${CREAM_DIM};">${esc(
                  meta.join(' · ')
                )}</p>`
              : ''
          }
          <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
            <a href="${abs(e.registration_url ?? '/touren/')}" style="color:${LIME};text-decoration:none;font-weight:bold;">Mitwandern &rarr;</a>
          </p>
        </td>
      </tr>
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
  if (n === 0) return `Marschkalender: ${label}`;
  return `Marschkalender: ${n} ${n === 1 ? 'Termin' : 'Termine'} · ${label}`;
}

export function weeklyHtml(input: WeeklyInput): string {
  const { monday, thisWeek, ownEvents, outlook, unsubscribeUrl } = input;
  const label = weekLabel(monday);
  const total = thisWeek.length + ownEvents.length;

  let body = `
    <tr><td style="padding:0 4px 6px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${LIME};font-weight:bold;">
        Marschkalender<span style="color:${DIVIDER};font-weight:normal;">&nbsp;&nbsp;·&nbsp;&nbsp;</span><span style="color:${CREAM_DIM};font-weight:normal;">${esc(
          label
        )}</span>
      </p>
      <h1 style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.2;font-weight:bold;color:${CREAM};">
        ${total > 0 ? 'Das steht diese Woche an.' : 'Ruhige Woche im Kalender.'}
      </h1>
      <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        ${
          total > 0
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
             style="background:${SURFACE};border:1px solid ${LINE};border-radius:8px;">
        ${outlook
          .map((m, i) => {
            const rule = i > 0 ? `border-top:1px solid ${LINE};` : '';
            return `<tr>
              <!-- Datum linksbündig in fester Spalte: die Zeilen fluchten -->
              <td width="86" valign="top"
                  style="width:86px;padding:15px 0 15px 22px;${rule}
                         font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;
                         font-weight:bold;color:#ff9d4d;white-space:nowrap;">
                ${esc(formatShortDate(m.start_date))}
              </td>
              <td valign="top" style="padding:15px 22px 15px 0;${rule}">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:${CREAM};">${
                  m.event_url
                    ? `<a href="${abs(m.event_url)}" style="color:${CREAM};text-decoration:none;">${esc(m.title)}</a>`
                    : esc(m.title)
                }</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${CREAM_DIM};padding-top:3px;">
                  ${esc(m.city)}${sep}${esc(formatDistances(m))}
                </div>
              </td>
            </tr>`;
          })
          .join('')}
      </table>
    </td></tr>`;
  }

  body += `<tr><td style="padding:30px 4px 0;">
      ${button('Ganzen Marschkalender ansehen', `${SITE_URL}/maersche/`)}
    </td></tr>`;

  const footer =
    `<a href="${unsubscribeUrl}" style="color:${CREAM};font-weight:bold;text-decoration:underline;">Newsletter abbestellen</a><br>` +
    `<span style="font-size:12px;line-height:1.7;color:${FAINT};">Du bekommst diese Mail, weil du dich für den Marschkalender angemeldet<br>` +
    `und die Anmeldung per Klick bestätigt hast.</span>`;

  return shell({
    preheader:
      total > 0 ? `${total} Termine zwischen ${label}` : `Kein Marsch diese Woche – dafür der Ausblick.`,
    body,
    footer,
  });
}

export function weeklyText(input: WeeklyInput): string {
  const lines: string[] = [];
  lines.push('CLUB LUDWIG – MARSCHKALENDER', weekLabel(input.monday), '');

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
      lines.push(
        `  ${[FORMAT_LABEL[m.format] ?? m.format, formatDistances(m), [m.city, m.region].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ')}`
      );
      if (m.note) lines.push(`  ${m.note}`);
      // Nicht jeder Marsch hat einen Link. Ohne diesen Rückfall bekäme abs()
      // null und der ganze Versand stürbe an einem einzigen Eintrag.
      const link = m.event_url ?? m.organizer_url;
      lines.push(`  ${link ? abs(link) : `${SITE_URL}/maersche/`}`, '');
    }
  }

  if (input.outlook.length > 0) {
    lines.push('DEMNÄCHST', '');
    for (const m of input.outlook) {
      lines.push(`${formatShortDate(m.start_date)} – ${m.title}`);
      lines.push(`  ${m.city} · ${formatDistances(m)}`);
      lines.push(`  ${abs(m.event_url ?? '/maersche/')}`, '');
    }
  }

  lines.push(`Kalender: ${SITE_URL}/maersche/`, '');
  lines.push(`Abmelden: ${input.unsubscribeUrl}`);

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Double-Opt-in-Mail                                                          */
/* -------------------------------------------------------------------------- */
/* Wird von newsletter-subscribe importiert – ohne diese beiden Funktionen     */
/* lässt sich die Function nicht laden und keine Anmeldung geht mehr durch.    */

export function confirmHtml(confirmUrl: string): string {
  const body = `
    <tr><td style="padding:0 4px;">
      <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:bold;color:${CREAM};">
        Noch ein Klick, dann bist du dabei.
      </h1>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        Du hast dich für den Marschkalender von Club Ludwig angemeldet: jeden Montagmorgen
        die Märsche und Touren der laufenden Woche, kompakt in einer Mail.
      </p>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${CREAM_DIM};">
        Bitte bestätige kurz, dass die Adresse dir gehört:
      </p>
      <div style="margin:26px 0 0;">${button('Anmeldung bestätigen', confirmUrl)}</div>
      <p style="margin:26px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${FAINT};">
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
    'Du hast dich für den Marschkalender angemeldet: jeden Montag die Märsche',
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
