// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // TODO: Auf die finale Domain anpassen (wichtig für Canonical- & OG-URLs)
  site: 'https://clubludwig.pages.dev',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
