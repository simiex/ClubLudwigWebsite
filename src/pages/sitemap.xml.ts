/**
 * sitemap.xml – die Seiten, die Google finden soll.
 *
 * Bewusst nur die aktuellen Seiten im Marschpass-Design und die Pflichtseiten,
 * nicht die alten Neon-Seiten (Touren, Standorte …), die noch im Projekt liegen.
 * Neue Seite, die gefunden werden soll? Hier eintragen.
 */
import type { APIRoute } from 'astro';
import { REGIONEN } from '../lib/kalender';

export const GET: APIRoute = ({ site }) => {
  const heute = new Date().toISOString().slice(0, 10);
  const seiten: { pfad: string; prio: string; freq: string }[] = [
    { pfad: '/', prio: '1.0', freq: 'weekly' },
    { pfad: '/maersche/', prio: '0.9', freq: 'daily' },
    ...REGIONEN.map((r) => ({ pfad: `/maersche/${r.slug}/`, prio: '0.8', freq: 'weekly' })),
    { pfad: '/impressum/', prio: '0.2', freq: 'yearly' },
    { pfad: '/datenschutz/', prio: '0.2', freq: 'monthly' },
    { pfad: '/nutzungsbedingungen/', prio: '0.2', freq: 'monthly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seiten
  .map(
    (s) =>
      `  <url><loc>${new URL(s.pfad, site).href}</loc><lastmod>${heute}</lastmod><changefreq>${s.freq}</changefreq><priority>${s.prio}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
