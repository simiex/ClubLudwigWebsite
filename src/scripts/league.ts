/**
 * Monatsliga: Schritt-Rangleiste mit Treppchen.
 */
import { getSupabase } from '../lib/supabase';

interface Eintrag {
  name: string;
  avatar: string | null;
  schritte: number;
  tage: number;
  schnitt: number;
  ich: boolean;
}

interface Liga {
  monat: string;
  gesamt: number;
  tage_uebrig: number;
  liste: Eintrag[];
  mein_stand: { summe: number; tage: number; heute: number } | null;
  monate: string[];
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

function monatName(key: string): string {
  const [j, m] = key.split('-');
  return `${MONATE[Number(m) - 1]} ${j}`;
}

function initialen(name: string): string {
  const t = name.trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return '?';
  if (t.length === 1) return t[0]!.slice(0, 2).toUpperCase();
  return (t[0]![0]! + t[t.length - 1]![0]!).toUpperCase();
}

function gesicht(e: Eintrag): string {
  return e.avatar
    ? `<span class="face"><img src="${esc(e.avatar)}" alt="" loading="lazy" /></span>`
    : `<span class="face">${esc(initialen(e.name))}</span>`;
}

export function initLeague(): void {
  const root = document.querySelector<HTMLElement>('[data-league]');
  if (!root) return;
  const el = root;
  const supabase = getSupabase();

  const loading = el.querySelector<HTMLElement>('[data-view="loading"]');
  const board = el.querySelector<HTMLElement>('[data-view="board"]');
  const select = el.querySelector<HTMLSelectElement>('[data-month-select]');
  const restEl = el.querySelector<HTMLElement>('[data-rest]');
  const podium = el.querySelector<HTMLElement>('[data-podium]');
  const liste = el.querySelector<HTMLElement>('[data-rest-list]');
  const leer = el.querySelector<HTMLElement>('[data-empty]');
  const total = el.querySelector<HTMLElement>('[data-total]');
  const ctaText = el.querySelector<HTMLElement>('[data-cta-text]');



  const zahl = (n: number) => Number(n).toLocaleString('de-DE');

  function render(d: Liga) {
    // Monatswahl füllen
    if (select && select.options.length === 0) {
      const monate = d.monate.length > 0 ? d.monate : [d.monat];
      if (!monate.includes(d.monat)) monate.unshift(d.monat);
      select.innerHTML = monate
        .map((m) => `<option value="${esc(m)}"${m === d.monat ? ' selected' : ''}>${esc(monatName(m))}</option>`)
        .join('');
    }

    if (restEl) {
      restEl.textContent =
        d.tage_uebrig > 0
          ? `Noch ${d.tage_uebrig} ${d.tage_uebrig === 1 ? 'Tag' : 'Tage'} in diesem Monat`
          : 'Monat abgeschlossen';
    }

    const top = d.liste.slice(0, 3);
    const rest = d.liste.slice(3);

    if (podium) {
      podium.innerHTML = top
        .map(
          (e, i) => `<li class="p${i + 1}${e.ich ? ' is-me' : ''}">
            ${i === 0 ? '<svg class="halo" viewBox="0 0 1200 1200" aria-hidden="true"><use href="#cl-sun"/></svg>' : ''}
            <span class="rank">${i === 0 ? 'Führung' : `Platz ${i + 1}`}</span>
            ${gesicht(e)}
            <span class="body">
              <span class="name">${esc(e.name)}</span>
              <span class="steps">${zahl(e.schritte)}</span>
              <span class="sub">${zahl(e.schnitt)} ⌀ · ${e.tage} Tage</span>
            </span>
          </li>`
        )
        .join('');
    }

    if (liste) {
      liste.innerHTML = rest
        .map(
          (e, i) => `<li class="${e.ich ? 'is-me' : ''}">
            <span class="r">${i + 4}</span>
            ${gesicht(e)}
            <span class="n">${esc(e.name)}</span>
            <span class="avg">${zahl(e.schnitt)} ⌀</span>
            <span class="s">${zahl(e.schritte)}</span>
          </li>`
        )
        .join('');
    }

    leer?.toggleAttribute('hidden', d.liste.length > 0);
    if (total) total.textContent = zahl(d.gesamt);

    if (ctaText && d.mein_stand) {
      ctaText.textContent =
        d.mein_stand.summe > 0
          ? `Dein Stand: ${zahl(d.mein_stand.summe)} Schritte an ${d.mein_stand.tage} Tagen.`
          : 'Du hast diesen Monat noch nichts eingetragen.';
    }

    loading?.setAttribute('hidden', '');
    board?.removeAttribute('hidden');
  }


  async function load(monat?: string) {
    try {
      const { data, error } = await supabase.rpc('step_league', { p_monat: monat ?? null });
      if (error) throw error;
      render(data as Liga);
    } catch (err) {
      console.error('[liga]', err);
      loading?.setAttribute('hidden', '');
      board?.removeAttribute('hidden');
      leer?.removeAttribute('hidden');
    }
  }

  select?.addEventListener('change', () => void load(select.value));


  void load();
}
