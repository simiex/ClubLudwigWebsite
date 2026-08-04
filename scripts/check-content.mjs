#!/usr/bin/env node
/**
 * ============================================================================
 * CONTENT- & PRODUCTION-READINESS-CHECK
 * ============================================================================
 * Läuft automatisch vor `npm run build`.
 *
 *   FEHLER (Exit 1) → rechtlich notwendige Angaben fehlen. Der Build bricht ab.
 *   WARNUNG         → inhaltlich empfehlenswert, blockiert aber nicht.
 *
 * Bewusst ohne Build-Guard arbeiten (nur für lokale Vorschau):
 *   npm run build:draft
 * ============================================================================
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

const errors = [];
const warnings = [];

/* -------------------------------------------------------------------------- */
/* 1. Rechtliche Pflichtangaben in der Konfiguration                          */
/* -------------------------------------------------------------------------- */

const configSource = readFileSync(join(SRC, 'config/site.ts'), 'utf8');
const MARKER = 'TODO_REQUIRED as';

/** Felder, die für einen rechtssicheren Livegang zwingend sind. */
const REQUIRED_FIELDS = [
  ['contact.email', 'Kontaktadresse (§ 5 DDG, Impressum + Datenschutz)'],
  ['legal.providerName', 'Name des Diensteanbieters (§ 5 Abs. 1 Nr. 1 DDG)'],
  ['legal.street', 'Ladungsfähige Anschrift – Straße und Hausnummer'],
  ['legal.postalCode', 'Ladungsfähige Anschrift – Postleitzahl'],
  ['legal.city', 'Ladungsfähige Anschrift – Ort'],
  ['legal.responsibleName', 'Inhaltlich Verantwortlicher (§ 18 Abs. 2 MStV)'],
  ['legal.entityType', 'Rechtsform – bestimmt weitere Pflichtangaben'],
];

for (const [field, why] of REQUIRED_FIELDS) {
  const key = field.split('.').pop();
  const re = new RegExp(`^\\s*${key}:\\s*${MARKER}`, 'm');
  if (re.test(configSource)) {
    errors.push(`src/config/site.ts → ${field} ist noch nicht gesetzt.\n      Benötigt für: ${why}`);
  }
}

/* Domain in astro.config.mjs und src/config/site.ts müssen übereinstimmen */
const astroConfig = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
const astroSite = astroConfig.match(/SITE_URL\s*=\s*'([^']+)'/)?.[1];
const configSite = configSource.match(/^\s*url:\s*'([^']+)'/m)?.[1];
if (astroSite && configSite && astroSite !== configSite) {
  errors.push(
    `Domain weicht ab: astro.config.mjs = "${astroSite}", src/config/site.ts = "${configSite}". ` +
      `Canonical- und OG-URLs wären falsch.`
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Platzhalter-Muster im gesamten Quelltext                                 */
/* -------------------------------------------------------------------------- */

const BLOCKING_PATTERNS = [
  { re: /\[Vorname Nachname\]/g, label: 'Namens-Platzhalter' },
  { re: /\[Straße Hausnummer\]/g, label: 'Adress-Platzhalter' },
  { re: /\[PLZ\]/g, label: 'PLZ-Platzhalter' },
  { re: /Lorem ipsum/gi, label: 'Blindtext' },
];

const WARNING_PATTERNS = [
  { re: /Platzhalter/g, label: 'Wort „Platzhalter“ im Inhalt' },
  { re: /\bTODO\b/g, label: 'offenes TODO' },
  { re: /https?:\/\/(www\.)?instagram\.com\/?(["'\s])/g, label: 'generischer Instagram-Link' },
  { re: /https?:\/\/(www\.)?strava\.com\/?(["'\s])/g, label: 'generischer Strava-Link' },
  { re: /example\.(com|org)/g, label: 'Beispiel-Domain' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(astro|ts|tsx|js|mjs|json|md|css)$/.test(entry)) out.push(full);
  }
  return out;
}

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');

  for (const { re, label } of BLOCKING_PATTERNS) {
    const hits = text.match(re);
    if (hits) errors.push(`${rel} → ${label} (${hits.length}×): ${hits[0]}`);
  }
  // Die Konfigurations- und Guard-Dateien dokumentieren die Marker selbst.
  if (rel.includes('config/site.ts') || rel.includes('lib/media.ts')) continue;

  for (const { re, label } of WARNING_PATTERNS) {
    const hits = text.match(re);
    if (hits) warnings.push(`${rel} → ${label} (${hits.length}×)`);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Eventdaten                                                               */
/* -------------------------------------------------------------------------- */

const events = JSON.parse(readFileSync(join(SRC, 'data/events.json'), 'utf8'));
const VALID_STATUS = ['offen', 'wenige-plaetze', 'ausgebucht', 'abgesagt', 'beendet'];
const venueSource = readFileSync(join(SRC, 'data/venues.ts'), 'utf8');

if (events.length === 0) {
  warnings.push('src/data/events.json → keine Events hinterlegt.');
}

for (const e of events) {
  const at = `src/data/events.json → "${e.id ?? '(ohne id)'}"`;
  if (!e.id) errors.push(`${at}: Feld "id" fehlt.`);
  if (!e.title) errors.push(`${at}: Feld "title" fehlt.`);
  if (!VALID_STATUS.includes(e.status)) {
    errors.push(`${at}: ungültiger status "${e.status}". Erlaubt: ${VALID_STATUS.join(', ')}.`);
  }
  if (e.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) {
    errors.push(`${at}: "date" muss YYYY-MM-DD oder null sein.`);
  }
  if (e.date === null) {
    warnings.push(`${at}: noch kein Termin hinterlegt – wird als „Termin folgt“ angezeigt.`);
  }
  if (!venueSource.includes(`id: '${e.venueId}'`)) {
    errors.push(`${at}: venueId "${e.venueId}" existiert nicht in src/data/venues.ts.`);
  }
  if (e.registrationUrl === null && !e.venueId) {
    errors.push(`${at}: weder registrationUrl noch venueId – keine Anmeldung möglich.`);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Referenzierte Grafiken vorhanden?                                        */
/* -------------------------------------------------------------------------- */

const graphicsDir = join(ROOT, 'public/assets/graphics');
const graphics = new Set(readdirSync(graphicsDir).map((f) => f.replace(/\.svg$/, '')));
for (const m of venueSource.matchAll(/media:\s*'([^']+)'/g)) {
  if (!graphics.has(m[1])) {
    errors.push(`src/data/venues.ts → Grafik "${m[1]}.svg" fehlt in public/assets/graphics/.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Ausgabe                                                                     */
/* -------------------------------------------------------------------------- */

const strict = process.env.CONTENT_CHECK !== 'off';

console.log('\n── Content- & Production-Readiness-Check ──────────────────────\n');

if (warnings.length > 0) {
  console.log(`  ⚠  ${warnings.length} Hinweis(e):`);
  for (const w of warnings) console.log(`     · ${w}`);
  console.log('');
}

if (errors.length > 0) {
  console.log(`  ✖  ${errors.length} blockierende(r) Fehler:\n`);
  for (const e of errors) console.log(`     · ${e}\n`);
  if (strict) {
    console.log('  Der Production-Build wurde abgebrochen.');
    console.log('  Fehlende Werte in src/config/site.ts eintragen und erneut bauen.');
    console.log('  Nur für eine lokale Vorschau: npm run build:draft\n');
    process.exit(1);
  }
  console.log('  CONTENT_CHECK=off – Fehler werden ignoriert (Draft-Build).\n');
} else {
  console.log('  ✓  Keine blockierenden Platzhalter gefunden.\n');
}
