/**
 * ============================================================================
 * Newsletter-Vorschau ohne Versand
 * ============================================================================
 *   npm run newsletter:preview            – kommende Woche
 *   npm run newsletter:preview 2026-09-14 – beliebiger Montag
 *
 * Schreibt die fertige Mail nach .preview/newsletter.html und den Textteil
 * nach .preview/newsletter.txt. Datenquelle ist Supabase; ist die nicht
 * erreichbar, wird src/data/marches.json genommen.
 *
 * Die Vorlagen liegen in supabase/functions/_shared und sind für Deno
 * geschrieben – deshalb wird Deno.env hier minimal nachgebildet.
 * ============================================================================
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const SUPABASE_URL = 'https://glkugldixsgtiqwdjouj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3qcl4FGcXKcET-GbXb2uqA_UBeAg0r9';

// Deno-Stub, damit die Function-Module in Node laufen
(globalThis as unknown as { Deno: unknown }).Deno = {
  env: {
    get(name: string) {
      return {
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: 'preview',
        RESEND_API_KEY: 'preview',
        SITE_URL: 'https://clubludwig.de',
      }[name];
    },
  },
};

const { addDays, berlinToday, weekStart } = await import(
  '../supabase/functions/_shared/marches.ts'
);
const { weeklyHtml, weeklySubject, weeklyText } = await import(
  '../supabase/functions/_shared/templates.ts'
);

type March = Awaited<ReturnType<typeof loadMarches>>[number];

async function loadMarches() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/marches?select=*&status=neq.entwurf&order=start_date.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('Daten aus Supabase geladen.');
    return (await res.json()) as any[];
  } catch (err) {
    console.warn(`Supabase nicht erreichbar (${(err as Error).message}) – nutze marches.json.`);
    return JSON.parse(await readFile(new URL('../src/data/marches.json', import.meta.url), 'utf8'));
  }
}

const monday = process.argv[2] ?? weekStart(berlinToday());
const sunday = addDays(monday, 6);
const outlookEnd = addDays(sunday, 28);

const all = (await loadMarches()) as March[];
const thisWeek = all.filter(
  (m) => m.status !== 'abgesagt' && m.start_date <= sunday && (m.end_date ?? m.start_date) >= monday
);
const inWeek = new Set(thisWeek.map((m) => m.slug));
const outlook = all
  .filter(
    (m) =>
      !inWeek.has(m.slug) &&
      m.status !== 'abgesagt' &&
      m.start_date > sunday &&
      m.start_date <= outlookEnd
  )
  .slice(0, 6);

const input = {
  monday,
  thisWeek,
  ownEvents: [],
  outlook,
  unsubscribeUrl: 'https://example.invalid/abmelden',
};

await mkdir(new URL('../.preview/', import.meta.url), { recursive: true });
await writeFile(new URL('../.preview/newsletter.html', import.meta.url), weeklyHtml(input));
await writeFile(new URL('../.preview/newsletter.txt', import.meta.url), weeklyText(input));

console.log(`\nWoche ab ${monday}`);
console.log(`Betreff:  ${weeklySubject(input)}`);
console.log(`Märsche:  ${thisWeek.length}  ·  Ausblick: ${outlook.length}`);
console.log(`\n→ .preview/newsletter.html im Browser öffnen`);
