/**
 * Scroll-Animationen der Startseite (GSAP + ScrollTrigger).
 *
 * Desktop (ab 900px, ohne prefers-reduced-motion):
 *  - Hero-Pinning mit Morph des Hero-Mediums in das Panel-Format der Club-Sektion
 *  - Crossfade der Medienpanels beim Durchscrollen der Club-Prinzipien
 *  - dezente Parallax-Bewegung auf den Medienflächen
 *
 * Alle Breakpoints (ohne prefers-reduced-motion):
 *  - einmalige Text-Reveals
 *
 * Mobil entfallen Pinning, Morphing und Parallax komplett; bei
 * prefers-reduced-motion läuft gar keine Animation.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initHomeAnimations(): void {
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    // Hero: Inhalt ausblenden, danach morpht die Medienfläche in das
    // Format des rechten Sticky-Panels der Club-Sektion.
    gsap.set('[data-hero-media]', { clipPath: 'inset(0% 0% 0% 0% round 0px)' });
    gsap
      .timeline({
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      })
      .to('[data-hero-content]', { yPercent: -35, autoAlpha: 0, ease: 'none', duration: 0.4 }, 0)
      .to('[data-hero-hint]', { autoAlpha: 0, duration: 0.12 }, 0)
      .to(
        '[data-hero-media]',
        { clipPath: 'inset(10% 3.5% 10% 52.5% round 6px)', ease: 'power1.inOut', duration: 0.55 },
        0.42
      )
      .to('[data-hero-scrim]', { opacity: 0.3, duration: 0.55 }, 0.42);

    // Club-Prinzipien: aktives Prinzip steuert den Crossfade der Panels.
    const panels = gsap.utils.toArray<HTMLElement>('[data-panel]');
    gsap.utils.toArray<HTMLElement>('[data-principle]').forEach((el, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (self) => {
          if (self.isActive) {
            panels.forEach((p, j) =>
              gsap.to(p, { autoAlpha: j === i ? 1 : 0, duration: 0.45, overwrite: 'auto' })
            );
          }
        },
      });
      gsap.fromTo(
        el,
        { opacity: 0.15, y: 36 },
        {
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 55%', scrub: true },
        }
      );
      gsap.to(el, {
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'bottom 48%', end: 'bottom 18%', scrub: true },
      });
    });

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
