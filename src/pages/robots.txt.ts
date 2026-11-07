/** robots.txt – alles darf gelesen werden, außer der Verwaltung. Verweist auf die Sitemap. */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /mein-club/\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
