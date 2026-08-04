/**
 * ============================================================================
 * SONNENSTAND ÜBER BONN
 * ============================================================================
 * Berechnet Höhe und Azimut der Sonne sowie die Tageszeiten (Dämmerung,
 * Aufgang, goldene Stunde, Untergang) für einen beliebigen Zeitpunkt.
 *
 * Verfahren nach den NOAA-Näherungsformeln – genau auf etwa eine Minute,
 * völlig ausreichend und ohne jede Netzwerkabfrage. Läuft rein im Browser.
 * ============================================================================
 */

/** Bonn, Hofgarten. */
export const BONN = { lat: 50.7339, lng: 7.1017 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

/* --- Himmelsmechanik ------------------------------------------------------ */

const OBLIQUITY = 23.4397 * RAD;

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  // Mittelpunktsgleichung + Länge des Perihels
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

function declination(l: number): number {
  return Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
}

function rightAscension(l: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l));
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

export interface SunPosition {
  /** Höhe über dem Horizont in Grad (negativ = unter dem Horizont). */
  altitude: number;
  /** Azimut in Grad, 0 = Norden, 90 = Osten. */
  azimuth: number;
}

export function getSunPosition(date: Date, lat = BONN.lat, lng = BONN.lng): SunPosition {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  );
  const azimuth = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  );

  return {
    altitude: altitude / RAD,
    // atan2 liefert Süd=0; auf Nord=0 drehen
    azimuth: (azimuth / RAD + 180) % 360,
  };
}

/* --- Tageszeiten ---------------------------------------------------------- */

const J0 = 0.0009;

function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI));
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return J0 + (Ht + lw) / (2 * Math.PI) + n;
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}

function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  );
}

/** Zeitpunkt, zu dem die Sonne die Höhe `h` (in Grad) erreicht. */
function getTime(
  h: number,
  date: Date,
  lat: number,
  lng: number,
  rising: boolean
): Date | null {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);

  const cosH =
    (Math.sin(h * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  // In Bonn nie der Fall, aber sauber abfangen (Polartag/-nacht)
  if (cosH < -1 || cosH > 1) return null;

  const H = hourAngle(h * RAD, phi, dec);
  const Jset = solarTransitJ(approxTransit(H, lw, n), M, L);
  return fromJulian(rising ? Jnoon - (Jset - Jnoon) : Jset);
}

export interface SunTimes {
  /** Beginn der bürgerlichen Dämmerung (-6°) */
  dawn: Date | null;
  sunrise: Date | null;
  /** Ende der goldenen Stunde am Morgen (+6°) */
  goldenEnd: Date | null;
  /** Beginn der goldenen Stunde am Abend (+6°) */
  goldenStart: Date | null;
  sunset: Date | null;
  /** Ende der bürgerlichen Dämmerung (-6°) */
  dusk: Date | null;
  solarNoon: Date;
}

export function getSunTimes(date: Date, lat = BONN.lat, lng = BONN.lng): SunTimes {
  // Sonnenhöchststand direkt aus dem Transit – über getTime() nicht lösbar,
  // weil dort die Höhe 90° außerhalb des Wertebereichs von acos liegt.
  const lw = RAD * -lng;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const solarNoon = fromJulian(solarTransitJ(ds, M, L));

  // -0.833° berücksichtigt Refraktion und den Sonnenradius
  return {
    dawn: getTime(-6, date, lat, lng, true),
    sunrise: getTime(-0.833, date, lat, lng, true),
    goldenEnd: getTime(6, date, lat, lng, true),
    goldenStart: getTime(6, date, lat, lng, false),
    sunset: getTime(-0.833, date, lat, lng, false),
    dusk: getTime(-6, date, lat, lng, false),
    solarNoon,
  };
}

/* --- Phasen --------------------------------------------------------------- */

export type SkyPhase = 'night' | 'dawn' | 'golden' | 'day' | 'dusk';

/** Grobe Einordnung der aktuellen Lichtstimmung anhand der Sonnenhöhe. */
export function getPhase(altitude: number, rising: boolean): SkyPhase {
  if (altitude < -6) return 'night';
  if (altitude < -0.833) return rising ? 'dawn' : 'dusk';
  if (altitude < 6) return 'golden';
  return 'day';
}
