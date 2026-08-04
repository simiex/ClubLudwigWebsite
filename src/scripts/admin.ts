/**
 * Prüfseite für die Clubleitung: Nachweise sichten, abhaken, verwerfen.
 * Alle Funktionen prüfen serverseitig auf Adminrechte – diese Seite ist
 * nur die Oberfläche dazu, keine Absicherung.
 */
import { getSupabase } from '../lib/supabase';
import { proofLink } from '../lib/challenges';

interface PendingLog {
  log_id: string;
  nachweis: string;
  wert: number;
  datum: string;
  notiz: string | null;
  erstellt: string;
  geprueft: boolean;
  person: string;
  avatar: string | null;
  challenge: string;
  metric: string;
  summe: number;
  ziel: number;
}

interface Overview {
  id: string;
  slug: string;
  title: string;
  goal: number;
  metric: string;
  starts_on: string;
  ends_on: string;
  shop_code: string | null;
  prize_count: number;
  prize_label: string | null;
  drawn_at: string | null;
  teilnehmer: number;
  finisher: number;
  offen: number;
  gewinner: Array<{ name: string; groesse: string | null }>;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function initAdmin(): void {
  const root = document.querySelector<HTMLElement>('[data-admin]');
  if (!root) return;
  const el = root;
  const supabase = getSupabase();

  const views = {
    loading: el.querySelector<HTMLElement>('[data-view="loading"]'),
    denied: el.querySelector<HTMLElement>('[data-view="denied"]'),
    app: el.querySelector<HTMLElement>('[data-view="app"]'),
  };
  const ovEl = el.querySelector<HTMLElement>('[data-overview]');
  const logsEl = el.querySelector<HTMLElement>('[data-logs]');
  const msgEl = el.querySelector<HTMLElement>('[data-msg]');
  const allCb = el.querySelector<HTMLInputElement>('[data-show-all]');

  const lightbox = document.querySelector<HTMLElement>('[data-lightbox]');
  const lightboxImg = document.querySelector<HTMLImageElement>('[data-lightbox-img]');

  function show(v: 'loading' | 'denied' | 'app') {
    for (const [name, node] of Object.entries(views)) node?.toggleAttribute('hidden', name !== v);
  }

  function setMsg(text: string, tone: 'ok' | 'error' | 'info' = 'info') {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.dataset.tone = tone;
  }

  /* ------------------------------------------------------------ Übersicht */

  async function loadOverview() {
    const { data, error } = await supabase.rpc('admin_challenge_overview');
    if (error) throw error;
    const list = (data ?? []) as Overview[];
    if (!ovEl) return;

    ovEl.innerHTML = list
      .map((c) => {
        const vorbei = new Date().toISOString().slice(0, 10) > c.ends_on;
        return `<article class="ovc">
          <div class="ovc__top">
            <h3>${esc(c.title)}</h3>
            <span class="ovc__period">${esc(fmtDate(c.starts_on))} – ${esc(fmtDate(c.ends_on))}</span>
          </div>
          <div class="ovc__stats">
            <span class="ovc__stat"><b>${c.teilnehmer}</b><span>Dabei</span></span>
            <span class="ovc__stat"><b>${c.finisher}</b><span>Am Ziel</span></span>
            <span class="ovc__stat"><b>${c.offen}</b><span>Ungeprüft</span></span>
          </div>
          ${
            c.shop_code
              ? `<p class="ovc__code">Gutschein für alle Finisher: <b>${esc(c.shop_code)}</b></p>`
              : ''
          }
          ${
            c.prize_count > 0
              ? c.drawn_at
                ? `<p class="ovc__code">Ziehung am ${esc(fmtDate(c.drawn_at))} –
                     ${c.gewinner.length} × ${esc(c.prize_label ?? 'Gewinn')}</p>
                   <ul class="winners">${c.gewinner
                     .map(
                       (g) =>
                         `<li>${esc(g.name)}${g.groesse ? ` · ${esc(g.groesse)}` : ' · Größe fehlt'}</li>`
                     )
                     .join('')}</ul>`
                : `<div class="ovc__draw">
                     <button class="ok" type="button" data-draw="${esc(c.id)}" ${
                       vorbei ? '' : 'disabled title="Erst nach Ende der Challenge"'
                     }>
                       ${c.prize_count} × ${esc(c.prize_label ?? 'Preis')} auslosen
                     </button>
                   </div>`
              : ''
          }
        </article>`;
      })
      .join('');

    ovEl.querySelectorAll<HTMLButtonElement>('[data-draw]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (
          !window.confirm(
            'Jetzt auslosen? Die Ziehung lässt sich nicht wiederholen – das Ergebnis steht danach fest.'
          )
        ) {
          return;
        }
        btn.disabled = true;
        try {
          const { data, error } = await supabase.rpc('draw_challenge_winners', {
            p_challenge_id: btn.dataset.draw!,
          });
          if (error) throw error;
          setMsg(`Gezogen: ${(data as { gezogen: number }).gezogen} Gewinner.`, 'ok');
          await loadOverview();
        } catch (err) {
          btn.disabled = false;
          setMsg((err as Error).message, 'error');
        }
      });
    });
  }

  /* -------------------------------------------------------------- Einträge */

  async function loadLogs() {
    const { data, error } = await supabase.rpc('admin_pending_logs', {
      p_alle: allCb?.checked ?? false,
    });
    if (error) throw error;
    const list = (data ?? []) as PendingLog[];
    if (!logsEl) return;

    if (list.length === 0) {
      logsEl.innerHTML = `<p class="leer">${
        allCb?.checked ? 'Noch keine Einträge vorhanden.' : 'Alles geprüft. Nichts zu tun.'
      }</p>`;
      return;
    }

    logsEl.innerHTML = list
      .map(
        (l) => `<div class="row${l.geprueft ? ' is-checked' : ''}" data-row="${esc(l.log_id)}">
          <button class="thumb" type="button" data-proof="${esc(l.nachweis)}"
                  aria-label="Nachweis von ${esc(l.person)} vergrößern"></button>
          <div>
            <p class="row__who">${esc(l.person)}</p>
            <p class="row__what">
              <b>${esc(String(l.wert).replace('.', ','))} ${esc(l.metric)}</b>
              am ${esc(fmtDate(l.datum))} · ${esc(l.challenge)}
              · Stand ${esc(String(l.summe).replace('.', ','))}/${esc(String(l.ziel).replace('.0', ''))}
            </p>
            ${l.notiz ? `<p class="row__note">${esc(l.notiz)}</p>` : ''}
          </div>
          <div class="row__act">
            ${
              l.geprueft
                ? `<button class="undo" type="button" data-uncheck="${esc(l.log_id)}">Haken zurück</button>`
                : `<button class="ok" type="button" data-check="${esc(l.log_id)}">Passt</button>
                   <button class="no" type="button" data-reject="${esc(l.log_id)}">Verwerfen</button>`
            }
          </div>
        </div>`
      )
      .join('');

    // Vorschaubilder brauchen signierte Links (privater Bucket)
    logsEl.querySelectorAll<HTMLButtonElement>('[data-proof]').forEach(async (btn) => {
      const url = await proofLink(btn.dataset.proof!);
      if (url) {
        btn.innerHTML = `<img src="${esc(url)}" alt="" loading="lazy" />`;
        btn.addEventListener('click', () => {
          if (lightboxImg) lightboxImg.src = url;
          lightbox?.removeAttribute('hidden');
        });
      } else {
        btn.textContent = '?';
      }
    });

    const wirken = async (fn: () => Promise<void>, btn: HTMLButtonElement, text: string) => {
      btn.disabled = true;
      try {
        await fn();
        setMsg(text, 'ok');
        await Promise.all([loadLogs(), loadOverview()]);
      } catch (err) {
        btn.disabled = false;
        setMsg((err as Error).message, 'error');
      }
    };

    logsEl.querySelectorAll<HTMLButtonElement>('[data-check]').forEach((btn) =>
      btn.addEventListener('click', () =>
        wirken(
          async () => {
            const { error } = await supabase.rpc('admin_check_log', {
              p_log_id: btn.dataset.check!,
              p_ok: true,
            });
            if (error) throw error;
          },
          btn,
          'Abgehakt.'
        )
      )
    );

    logsEl.querySelectorAll<HTMLButtonElement>('[data-uncheck]').forEach((btn) =>
      btn.addEventListener('click', () =>
        wirken(
          async () => {
            const { error } = await supabase.rpc('admin_check_log', {
              p_log_id: btn.dataset.uncheck!,
              p_ok: false,
            });
            if (error) throw error;
          },
          btn,
          'Haken entfernt.'
        )
      )
    );

    logsEl.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!window.confirm('Eintrag verwerfen? Er wird gelöscht und die Summe angepasst.')) return;
        return wirken(
          async () => {
            const { error } = await supabase.rpc('admin_reject_log', {
              p_log_id: btn.dataset.reject!,
            });
            if (error) throw error;
          },
          btn,
          'Eintrag verworfen.'
        );
      })
    );
  }

  allCb?.addEventListener('change', () => void loadLogs());

  lightbox?.addEventListener('click', () => lightbox.setAttribute('hidden', ''));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') lightbox?.setAttribute('hidden', '');
  });

  /* --------------------------------------------------------------- Start */

  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      show('denied');
      return;
    }
    try {
      // Der erste Aufruf entscheidet: Wer kein Admin ist, bekommt einen Fehler.
      await loadOverview();
      show('app');
      await loadLogs();
    } catch (err) {
      console.error('[admin]', err);
      show('denied');
    }
  })();
}
