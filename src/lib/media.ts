/**
 * ============================================================================
 * MEDIEN-REGISTRY
 * ============================================================================
 * Alle Bildflächen laufen über <Media name="…" />. Aktuell liefert jede Fläche
 * die SVG-Illustration aus /assets/graphics/<name>.svg.
 *
 * ECHTE FOTOS EINBAUEN – so geht's, ohne eine einzige Komponente anzufassen:
 *
 *   1. Foto als AVIF und WebP exportieren, z. B.
 *        public/assets/photos/region-drachenfels.avif
 *        public/assets/photos/region-drachenfels.webp
 *        public/assets/photos/region-drachenfels.jpg   (Fallback für alte Browser)
 *      Optional zusätzlich in mehreren Breiten (1200/1800/2400) für srcset.
 *
 *   2. Hier unten in `photos` den passenden Eintrag ergänzen.
 *
 *   3. Fertig – <picture> liefert dann automatisch AVIF → WebP → JPG,
 *      die SVG bleibt als letzter Fallback bestehen.
 *
 * Solange kein Eintrag existiert, wird ausschließlich die SVG ausgeliefert.
 * ============================================================================
 */

export interface PhotoSet {
  /** Pfad zur AVIF-Datei bzw. srcset-String bei mehreren Breiten. */
  avif?: string;
  /** Pfad zur WebP-Datei bzw. srcset-String. */
  webp?: string;
  /** Raster-Fallback (JPG/PNG). Ohne Angabe bleibt die SVG der Fallback. */
  fallback?: string;
  /** Natürliche Maße – verhindern Layout-Shift (CLS). */
  width?: number;
  height?: number;
  /** sizes-Attribut, z. B. "(max-width: 899px) 100vw, 44vw" */
  sizes?: string;
}

/**
 * name → Fotosatz. Aktuell bewusst leer: es liegen noch keine echten Fotos vor.
 * Beispiel für später:
 *
 *   'region-drachenfels': {
 *     avif: '/assets/photos/region-drachenfels-1200.avif 1200w, /assets/photos/region-drachenfels-2400.avif 2400w',
 *     webp: '/assets/photos/region-drachenfels-1200.webp 1200w, /assets/photos/region-drachenfels-2400.webp 2400w',
 *     fallback: '/assets/photos/region-drachenfels-1200.jpg',
 *     width: 2400, height: 1543,
 *     sizes: '(max-width: 899px) 100vw, 60vw',
 *   },
 */
export const photos: Record<string, PhotoSet> = {};

/** Maße der SVG-Illustrationen – für width/height am <img>. */
const SVG_DIMENSIONS: Record<string, { width: number; height: number }> = {
  hero: { width: 1920, height: 1080 },
  manifest: { width: 1920, height: 1080 },
  'panel-city': { width: 1000, height: 1250 },
  'region-drachenfels': { width: 1400, height: 900 },
  'region-ennert': { width: 1100, height: 1000 },
  'region-waldau': { width: 1400, height: 820 },
  'region-heisterbach': { width: 1400, height: 900 },
  'region-ziepchensplatz': { width: 1400, height: 900 },
};

export interface ResolvedMedia {
  svg: string;
  photo: PhotoSet | null;
  width: number;
  height: number;
}

export function resolveMedia(name: string): ResolvedMedia {
  const photo = photos[name] ?? null;
  const dim = SVG_DIMENSIONS[name] ?? { width: 1600, height: 1000 };
  return {
    svg: `/assets/graphics/${name}.svg`,
    photo,
    width: photo?.width ?? dim.width,
    height: photo?.height ?? dim.height,
  };
}
