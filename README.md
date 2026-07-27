# Club Ludwig – Website

Website des Club Ludwig, dem offenen Hiking Club aus Bonn.
Gebaut mit [Astro](https://astro.build) als statische Seite, Animationen mit GSAP + ScrollTrigger.

## Lokaler Start

Voraussetzung: Node.js ≥ 20

```bash
npm install     # Abhängigkeiten installieren
npm run dev     # Dev-Server auf http://localhost:4321
```

Weitere Befehle:

```bash
npm run build     # Produktions-Build nach ./dist
npm run preview   # Build lokal testen
npm run check     # Typprüfung (astro check)
```

## Eventdaten pflegen

Alle Wanderungen stehen in **`src/data/events.json`**. Die Website zeigt automatisch das
nächste zukünftige Event als „Nächste Wanderung“ auf der Startseite; `/touren` listet alle
kommenden Events.

Ein Event hat folgende Felder:

| Feld                 | Beispiel                          |
| -------------------- | --------------------------------- |
| `id`                 | `"siebengebirge-classic-2026-08"` |
| `title`              | `"Siebengebirge Classic"`         |
| `date`               | `"2026-08-09"` (ISO-Format)       |
| `time`               | `"09:30"`                         |
| `meetingPoint`       | `"Bonn Hbf"`                      |
| `distance`           | `"14 km"`                         |
| `elevation`          | `"480 hm"`                        |
| `duration`           | `"ca. 4,5 h"`                     |
| `terrain`            | `"Waldpfade, Anstiege"`           |
| `difficulty`         | `"Moderat"`                       |
| `fitness`            | `"Grundkondition"`                |
| `cost`               | `"Kostenlos"`                     |
| `dogsAllowed`        | `"Ja, angeleint"`                 |
| `registrationStatus` | `"Anmeldung offen"`               |
| `description`        | Freitext                          |
| `registrationLink`   | URL oder `mailto:`-Link           |

**Wichtig:** Die Seite ist statisch – „nächstes Event“ wird zum **Build-Zeitpunkt** berechnet.
Nach dem Eintragen neuer Events einmal neu deployen (bei Cloudflare Pages genügt ein Git-Push).
Optional lässt sich in Cloudflare ein regelmäßiger Build (Deploy Hook + Cron) einrichten, damit
abgelaufene Events automatisch verschwinden.

## Projektstruktur

```
public/
  assets/            Logos (weiß für dunkle, dunkel für helle Flächen), OG-Image
  favicon.svg        Favicon-Platzhalter (Sonnen-Mark)
src/
  components/        Header, Hero, Principles, FeaturedEvent, Regions,
                     Community, Manifest, FinalCta, Footer
  data/events.json   Eventdaten (einzige Datei, die für neue Touren angefasst werden muss)
  layouts/           BaseLayout (SEO/OG/Meta), LegalLayout
  lib/events.ts      Event-Typen, Sortierung, Datumsformatierung
  pages/             index, touren/, impressum, datenschutz, 404
  scripts/           GSAP-/ScrollTrigger-Animationen der Startseite
  styles/global.css  Design-Tokens (Farben, Typo) & Basis-Styles
_prototype/          Entpackter Design-Export (nur Referenz, nicht Teil des Builds)
```

## Animationen

Implementiert in `src/scripts/home-animations.ts` mit `gsap.matchMedia()`:

- **Desktop (≥ 900px, ohne `prefers-reduced-motion`):** Hero-Pinning mit Morph des
  Hero-Mediums in das Sticky-Panel der Club-Sektion, Crossfades der Medienpanels,
  dezente Parallax-Effekte.
- **Alle Geräte (ohne `prefers-reduced-motion`):** einmalige Text-Reveals.
- **Mobil:** kein Pinning, kein Morph, kein Parallax – der Hero ist ein normaler Screen.
- **`prefers-reduced-motion: reduce`:** keinerlei Scroll-Animationen.

## Deployment auf Cloudflare Pages

1. Repository in Cloudflare Pages verbinden: **Workers & Pages → Create → Pages →
   Connect to Git**.
2. Build-Einstellungen:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Deployen – fertig. Jeder Push auf den Produktionsbranch löst einen neuen Build aus.

Nach dem Livegang die finale Domain in `astro.config.mjs` (`site`) eintragen, damit
Canonical- und Open-Graph-URLs stimmen.

## Offene Platzhalter vor dem Livegang

- Fotos/Videos: alle Medienflächen sind Farbverlaufs-Platzhalter (Hero-Video, Club-Panels,
  Regionen, Community, Manifest).
- Mitglieder-/Kilometer-Statistiken im Hero.
- Instagram-/Strava-Links zeigen auf die generischen Startseiten.
- Partner-Liste („Lokale Partner · Platzhalter“).
- Impressum & Datenschutz: `[Vorname Nachname]` etc. ausfüllen und rechtlich prüfen.
- Favicon & OG-Image sind generierte Platzhalter.
