// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Produktivdomain – daraus baut Astro Canonical-, OG- und Sitemap-URLs.
  // Steht hier die Cloudflare-Vorschauadresse, verweisen alle Linkvorschauen
  // und der Canonical jeder Seite dorthin statt auf die echte Domain.
  site: 'https://clubludwig.de',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
