/**
 * Belebt den Sonnenbogen im Hero und färbt die Seite nach der echten
 * Tageszeit über Bonn ein.
 */
import { getPhase, getSunPosition, getSunTimes, type SkyPhase } from '../lib/sun-position';

const PHASE_LABEL: Record<SkyPhase, string> = {
  night: 'Nacht über Bonn',
  dawn: 'Dämmerung',
  golden: 'Goldene Stunde',
  day: 'Tageslicht',
  dusk: 'Blaue Stunde',
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** "3 Std 14 Min" – ohne führende Nullen, ohne Sekundenkram. */
function fmtSpan(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
}

export function initSunArc(): void {
  const arcRoot = document.querySelector<HTMLElement>('[data-sun-arc]');
  if (!arcRoot) return;
  const arc = arcRoot; // nach dem Guard nicht mehr null

  const phaseEl = arc.querySelector<HTMLElement>('[data-arc-phase]');
  const windowEl = arc.querySelector<HTMLElement>('[data-arc-window]');
  const riseEl = arc.querySelector<SVGTextElement>('[data-arc-rise]');
  const setEl = arc.querySelector<SVGTextElement>('[data-arc-set]');
  const sunEl = arc.querySelector<SVGGElement>('[data-arc-sun]');
  const doneEl = arc.querySelector<SVGPathElement>('[data-arc-done]');
  const titleEl = arc.querySelector<SVGTitleElement>('[data-arc-title]');

  // Geometrie des Bogens (muss zum SVG in SunArc.astro passen)
  const CX = 130;
  const CY = 74;
  // Ellipse statt Kreis, damit der Bogen in die Zeichenfläche passt
  const RX = 112;
  const RY = 52;
  const START = 180; // Sonnenaufgang links
  const END = 0; // Sonnenuntergang rechts

  const trackLength = doneEl ? doneEl.getTotalLength() : 0;
  doneEl?.style.setProperty('stroke-dasharray', String(trackLength));

  function update() {
    const now = new Date();
    const times = getSunTimes(now);
    const pos = getSunPosition(now);
    const { sunrise, sunset } = times;
    if (!sunrise || !sunset) return;

    const rising = now < times.solarNoon;
    const phase = getPhase(pos.altitude, rising);
    const isDay = now >= sunrise && now <= sunset;

    /* --- Position auf dem Bogen ------------------------------------------ */
    // Anteil des Tages, der vorbei ist (0 = Aufgang, 1 = Untergang)
    let t: number;
    if (isDay) {
      t = (now.getTime() - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime());
    } else {
      // Nachts steht die Sonne am jeweiligen Ende, leicht unter dem Horizont
      t = now > sunset ? 1 : 0;
    }
    t = Math.min(1, Math.max(0, t));

    const angle = ((START + (END - START) * t) * Math.PI) / 180;
    const x = CX + RX * Math.cos(angle);
    // Nachts unter die Horizontlinie schieben
    const y = CY - RY * Math.sin(angle) + (isDay ? 0 : 7);
    sunEl?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

    doneEl?.style.setProperty(
      'stroke-dashoffset',
      String(trackLength * (1 - (isDay ? t : t === 1 ? 1 : 0)))
    );

    arc.toggleAttribute('data-below', !isDay);

    /* --- Texte ------------------------------------------------------------ */
    if (phaseEl) phaseEl.textContent = PHASE_LABEL[phase];
    if (riseEl) riseEl.textContent = fmtTime(sunrise);
    if (setEl) setEl.textContent = fmtTime(sunset);

    if (windowEl) {
      if (isDay) {
        windowEl.textContent = `Noch ${fmtSpan(sunset.getTime() - now.getTime())} Licht · Sonnenuntergang ${fmtTime(sunset)}`;
      } else {
        // Nach Sonnenuntergang zählt der Aufgang von morgen
        const nextRise =
          now > sunset ? getSunTimes(new Date(now.getTime() + 86400000)).sunrise : sunrise;
        if (nextRise) {
          windowEl.textContent = `Sonnenaufgang ${fmtTime(nextRise)} · in ${fmtSpan(nextRise.getTime() - now.getTime())}`;
        }
      }
    }

    if (titleEl) {
      titleEl.textContent = `Sonnenstand über Bonn: ${PHASE_LABEL[phase]}, Sonnenaufgang ${fmtTime(
        sunrise
      )}, Sonnenuntergang ${fmtTime(sunset)}.`;
    }

    // Phase nach außen geben – die Seite tönt sich danach
    document.documentElement.dataset.sky = phase;
  }

  update();
  arc.removeAttribute('hidden');

  // Minütlich reicht: der Bogen bewegt sich langsamer als jede Animation
  window.setInterval(update, 60000);
}
