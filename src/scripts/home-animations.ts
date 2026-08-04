/**
 * Scroll-Animationen der Startseite (GSAP + ScrollTrigger).
 *
 * Desktop (ab 900px, ohne prefers-reduced-motion):
 *  - Hero-Pinning: Inhalt zieht weg, das Medium bleibt und wird ruhiger
 *  - dezente Parallax-Bewegung auf den Medienflächen
 *
 * Alle Breakpoints (ohne prefers-reduced-motion):
 *  - einmalige Text-Reveals
 *
 * Mobil entfallen Pinning und Parallax komplett; bei
 * prefers-reduced-motion läuft gar keine Animation.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initHomeAnimations(): void {
  void import('./sun-arc').then((m) => m.initSunArc());
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    // Hero: Inhalt zieht nach oben weg, das Bild bleibt und beruhigt sich.
    gsap
      .timeline({
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      })
      .to('[data-hero-content]', { yPercent: -35, autoAlpha: 0, ease: 'none', duration: 0.4 }, 0)
      .to('[data-hero-hint]', { autoAlpha: 0, duration: 0.12 }, 0)
      .to('[data-hero-media]', { scale: 1.06, ease: 'none', duration: 1 }, 0)
      .to('[data-hero-scrim]', { opacity: 0.55, duration: 0.6 }, 0.4);

    // Dezente Parallax-Bewegung auf Medienflächen.
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      gsap.fromTo(
        el,
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        }
      );
    });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 26,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  });
}

