// @ts-check
import { defineConfig } from 'astro/config';
import { site as marke } from './src/config/site.ts';

// https://astro.build/config
export default defineConfig({
  // Produktivdomain – daraus baut Astro Canonical-, OG- und Sitemap-URLs.
  // Steht hier die Cloudflare-Vorschauadresse, verweisen alle Linkvorschauen
  // und der Canonical jeder Seite dorthin statt auf die echte Domain.
  //
  // Der Wert kommt aus src/config/site.ts und steht hier nicht noch einmal.
  // Diese beiden Zeilen waren bereits auseinandergelaufen, und so etwas faellt
  // nicht auf: Die Seite laedt normal, nur der Canonical und die sitemap.xml
  // zeigen auf eine Domain, die es nicht mehr gibt - und Google glaubt das
  // wochenlang.
  site: marke.url,
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
