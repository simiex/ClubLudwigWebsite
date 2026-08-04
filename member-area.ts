/**
 * Mitgliederbereich – Anmelden/Registrieren (E-Mail + Passwort) und Dashboard
 * im Stil einer Event-Plattform: Begrüßung, Empfehlungs-Box, Eventtabellen,
 * Stempelheft. Alles läuft im Browser gegen Supabase; die Absicherung liegt
 * in RLS, nicht in diesem Skript.
 */
import {
  getSupabase,
  getDashboard,
  cancelRegistration,
  redeemCode,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  deleteAccount,
} from '../lib/supabase';
import type { Dashboard, DashboardPast, DashboardUpcoming, Profile, StampItem } from '../lib/supabase';
import { STAMP_GOAL } from '../config/stempelheft';
import {
  getMyChallenges,
  logProgress,
  uploadProof,
  setShirtSize,
  SHIRT_SIZES,
  METRIC_SHORT,
  type MyChallenge,
} from '../lib/challenges';

const KIND_LABEL: Record<string, string> = {
  tour: 'Tour',
  virtual: 'Virtuell',
  challenge: 'Challenge',
};

const REG_LABEL: Record<string, string> = {
  angemeldet: 'Angemeldet',
  warteliste: 'Warteliste',
  storniert: 'Storniert',
};

const SOURCE_LABEL: Record<string, string> = {
  tour: 'Tour',
  shop: 'Shop',
  empfehlung: 'Empfehlung',
  aktion: 'Aktion',
};

/**
 * Beschriftung auf dem Stempel. Stempel aus virtuellen Challenges tragen das
 * als Präfix in der Notiz – dann steht das auf dem Stempel statt "Aktion".
 */
function stampLabel(stamp: StampItem): string {
  if (stamp.label?.startsWith('Virtuelle Challenge:')) return 'Challenge';
  return SOURCE_LABEL[stamp.source] ?? stamp.source;
}

/** Vollständige Beschreibung für den Titel-Tooltip. */
function stampTitle(stamp: StampItem): string {
  const datum = new Date(stamp.date).toLocaleDateString('de-DE');
  return `${stamp.label} · ${datum}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Termin folgt';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

export function initMemberArea(): void {
  const root = document.querySelector<HTMLElement>('[data-member]');
  if (!root) return;
  const el = root;

  const supabase = getSupabase();

  const viewLoading = el.querySelector<HTMLElement>('[data-view="loading"]');
  const viewLogin = el.querySelector<HTMLElement>('[data-view="login"]');
  const viewArea = el.querySelector<HTMLElement>('[data-view="area"]');

  const loginForm = el.querySelector<HTMLFormElement>('[data-login-form]');
  const signupForm = el.querySelector<HTMLFormElement>('[data-signup-form]');
  const loginMsg = el.querySelector<HTMLElement>('[data-login-msg]');
  const authTabs = [...el.querySelectorAll<HTMLButtonElement>('[data-auth-tab]')];
  const forgotBtn = el.querySelector<HTMLButtonElement>('[data-forgot]');
  const logoutBtn = el.querySelector<HTMLButtonElement>('[data-logout]');
  const greeting = el.querySelector<HTMLElement>('[data-greeting]');

  const codeForm = el.querySelector<HTMLFormElement>('[data-code-form]');
  const codeInput = el.querySelector<HTMLInputElement>('[data-code-input]');
  const codeMsg = el.querySelector<HTMLElement>('[data-code-msg]');

  const counter = el.querySelector<HTMLElement>('[data-counter]');
  const bar = el.querySelector<HTMLElement>('[data-progress-bar]');
  const slotsWrap = el.querySelector<HTMLElement>('[data-slots]');
  const upcomingBody = el.querySelector<HTMLElement>('[data-upcoming]');
  const pastWrap = el.querySelector<HTMLElement>('[data-past]');
  const pastToggle = el.querySelector<HTMLButtonElement>('[data-past-toggle]');
  const rewardBox = el.querySelector<HTMLElement>('[data-reward]');
  const refCodeEl = el.querySelector<HTMLElement>('[data-ref-code]');
  const profileForm = el.querySelector<HTMLFormElement>('[data-profile-form]');
  const profileName = el.querySelector<HTMLInputElement>('[data-profile-name]');
  const profileUser = el.querySelector<HTMLInputElement>('[data-profile-username]');
  const profileMsg = el.querySelector<HTMLElement>('[data-profile-msg]');
  const avatarWrap = el.querySelector<HTMLElement>('[data-avatar-wrap]');
  const avatarImg = el.querySelector<HTMLImageElement>('[data-avatar]');
  const avatarInitials = el.querySelector<HTMLElement>('[data-avatar-initials]');
  const avatarInput = el.querySelector<HTMLInputElement>('[data-avatar-input]');
  const avatarRemove = el.querySelector<HTMLButtonElement>('[data-avatar-remove]');
  const challengesWrap = el.querySelector<HTMLElement>('[data-challenges]');
  const stepsWrap = el.querySelector<HTMLElement>('[data-steps]');
  const adminLink = el.querySelector<HTMLElement>('[data-admin-link]');
  const deleteBtn = el.querySelector<HTMLButtonElement>('[data-delete-account]');
  const deleteMsg = el.querySelector<HTMLElement>('[data-delete-msg]');
  const refCopyBtn = el.querySelector<HTMLButtonElement>('[data-ref-copy]');

  function show(view: 'loading' | 'login' | 'area') {
    viewLoading?.toggleAttribute('hidden', view !== 'loading');
    viewLogin?.toggleAttribute('hidden', view !== 'login');
    viewArea?.toggleAttribute('hidden', view !== 'area');
  }

  function setMsg(target: HTMLElement | null, text: string, tone: 'ok' | 'error' | 'info') {
    if (!target) return;
    target.textContent = text;
    target.dataset.tone = tone;
  }

  /* ---------------------------------------------------------------- Login */

  function switchTab(which: 'login' | 'signup') {
    authTabs.forEach((tab) => {
      const active = tab.dataset.authTab === which;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    loginForm?.toggleAttribute('hidden', which !== 'login');
    signupForm?.toggleAttribute('hidden', which !== 'signup');
    setMsg(loginMsg, '', 'info');
  }

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.authTab as 'login' | 'signup'));
  });

  /**
   * Supabase liefert bei Serverfehlern (z. B. defekter SMTP-Zugang) ein leeres
   * message-Feld. Dann statt "{}" den Statuscode und einen brauchbaren Hinweis
   * zeigen – und die Rohdaten in die Konsole, fürs Debuggen.
   */
  function describeError(error: unknown): string {
    const e = error as { message?: string; status?: number; code?: string; name?: string };
    console.error('[club-ludwig] Auth-Fehler:', error);
    const msg = typeof e?.message === 'string' ? e.message.trim() : '';
    if (msg) return msg;
    if (e?.status === 500) {
      return 'Serverfehler beim Anlegen des Kontos. Häufigste Ursache: Der E-Mail-Versand ' +
        'ist nicht korrekt eingerichtet. Bitte melde dich kurz bei uns.';
    }
    if (e?.status) return `Unerwarteter Fehler (Status ${e.status}).`;
    if (e?.code) return `Unerwarteter Fehler (${e.code}).`;
    return 'Unerwarteter Fehler. Bitte versuch es später noch einmal.';
  }

  function friendlyAuthError(message: string): string {
    if (/invalid login credentials/i.test(message)) {
      return 'E-Mail oder Passwort stimmt nicht.';
    }
    if (/already registered/i.test(message)) {
      return 'Für diese Adresse gibt es schon ein Konto – melde dich links an.';
    }
    if (/password should be at least/i.test(message)) {
      return 'Das Passwort muss mindestens 8 Zeichen haben.';
    }
    if (/rate limit/i.test(message)) {
      return 'Zu viele Versuche kurz hintereinander – warte einen Moment.';
    }
    if (/email not confirmed/i.test(message)) {
      return 'Bitte bestätige zuerst deine E-Mail-Adresse – wir haben dir einen Link geschickt.';
    }
    if (/error sending|smtp|confirmation email/i.test(message)) {
      return 'Die Bestätigungsmail konnte nicht verschickt werden. Bitte melde dich kurz bei uns.';
    }
    return `Das hat nicht geklappt: ${message}`;
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el.querySelector<HTMLInputElement>('[data-login-email]')?.value.trim();
    const password = el.querySelector<HTMLInputElement>('[data-login-password]')?.value;
    if (!email || !password) {
      setMsg(loginMsg, 'Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    const btn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setMsg(loginMsg, 'Anmeldung läuft …', 'info');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (btn) btn.disabled = false;
    if (error) {
      setMsg(loginMsg, friendlyAuthError(describeError(error)), 'error');
      return;
    }
    // onAuthStateChange übernimmt ab hier.
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el.querySelector<HTMLInputElement>('[data-signup-name]')?.value.trim();
    const email = el.querySelector<HTMLInputElement>('[data-signup-email]')?.value.trim();
    const password = el.querySelector<HTMLInputElement>('[data-signup-password]')?.value;
    if (!email || !password) {
      setMsg(loginMsg, 'Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    const btn = signupForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setMsg(loginMsg, 'Konto wird erstellt …', 'info');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/mein-club/`,
        data: name ? { display_name: name } : undefined,
      },
    });

    if (btn) btn.disabled = false;
    if (error) {
      setMsg(loginMsg, friendlyAuthError(describeError(error)), 'error');
      return;
    }

    // Je nach Projekt-Einstellung: Session sofort da (Confirm aus) oder
    // Bestätigungsmail nötig (Confirm an). Beides sauber abfangen.
    if (data.session) {
      // onAuthStateChange übernimmt.
      return;
    }
    setMsg(
      loginMsg,
      'Fast geschafft: Wir haben dir eine Mail geschickt – bitte bestätige deine Adresse, dann kannst du dich anmelden.',
      'ok'
    );
    signupForm.reset();
    switchTab('login');
  });

  forgotBtn?.addEventListener('click', async () => {
    const email = el.querySelector<HTMLInputElement>('[data-login-email]')?.value.trim();
    if (!email) {
      setMsg(loginMsg, 'Trag oben deine E-Mail-Adresse ein, dann schicken wir dir einen Link zum Zurücksetzen.', 'error');
      el.querySelector<HTMLInputElement>('[data-login-email]')?.focus();
      return;
    }
    setMsg(loginMsg, 'Link wird verschickt …', 'info');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/mein-club/passwort/`,
    });
    if (error) {
      setMsg(loginMsg, friendlyAuthError(describeError(error)), 'error');
      return;
    }
    setMsg(loginMsg, 'Falls ein Konto zu dieser Adresse existiert, ist ein Link zum Zurücksetzen unterwegs.', 'ok');
  });

  logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    aktiveSitzung = null;
    show('login');
  });

  /* ------------------------------------------------------------- Rendering */

  function renderGreeting(d: Dashboard, email: string) {
    if (!greeting) return;
    const name = d.profile?.display_name || d.profile?.username || email.split('@')[0];
    greeting.innerHTML =
      `Hi, <span class="hi__name">${esc(name)}</span>!` +
      ` <span class="hi__sub">Schön, dass du wieder dabei bist.</span>`;
  }

  function renderStamps(stamps: StampItem[]) {
    if (!slotsWrap) return;
    const filled = Math.min(stamps.length, STAMP_GOAL);
    slotsWrap.innerHTML = Array.from({ length: STAMP_GOAL }, (_, i) => {
      const stamp = stamps[i];
      return `<li class="slot${stamp ? ' is-filled' : ''}" ${
        stamp
          ? `title="${esc(stampTitle(stamp))}" aria-label="Stempel ${i + 1}: ${esc(stamp.label)}, ${esc(fmtDate(stamp.date))}"`
          : `aria-label="Stempel ${i + 1}: noch offen"`
      }>
        <span class="slot__num">${String(i + 1).padStart(2, '0')}</span>
        <svg class="slot__sun" viewBox="0 0 1200 1200" aria-hidden="true"><use href="#cl-sun"/></svg>
        ${stamp ? `<span class="slot__label">${esc(stampLabel(stamp))}</span>` : ''}
      </li>`;
    }).join('');

    if (counter) counter.textContent = `${filled} / ${STAMP_GOAL}`;
    bar?.style.setProperty('--fill', `${(filled / STAMP_GOAL) * 100}%`);
    rewardBox?.toggleAttribute('hidden', filled < STAMP_GOAL);
  }

  function renderUpcoming(items: DashboardUpcoming[]) {
    if (!upcomingBody) return;
    if (items.length === 0) {
      upcomingBody.innerHTML = `<tr><td class="table__empty" colspan="5">
        Aktuell befinden sich in dieser Ansicht keine Events.
        <a class="link-underline" href="/touren/">Zum Tourenkalender</a></td></tr>`;
      return;
    }
    upcomingBody.innerHTML = items
      .map((e) => {
        const when = e.starts_at
          ? `${fmtDate(e.starts_at)}<br><span class="table__sub">${fmtTime(e.starts_at)} Uhr</span>`
          : 'Termin folgt';
        const dist = e.distance_km
          ? `${String(e.distance_km).replace('.', ',')} km`
          : '–';
        return `<tr>
          <td>
            <span class="table__title">${esc(e.title)}</span><br>
            <span class="tag tag--${esc(e.kind)}">${esc(KIND_LABEL[e.kind] ?? e.kind)}</span>
          </td>
          <td>${when}</td>
          <td>${dist}</td>
          <td><span class="status is-${e.registration_status === 'angemeldet' ? 'go' : 'warn'}">
            ${esc(REG_LABEL[e.registration_status] ?? e.registration_status)}</span></td>
          <td class="table__actions">
            ${
              e.usc_booking && e.registration_url
                ? `<a class="table__link" href="${esc(e.registration_url)}" target="_blank" rel="noopener">USC ↗</a>`
                : ''
            }
            <button class="table__cancel" type="button" data-cancel="${esc(e.event_id)}">Abmelden</button>
          </td>
        </tr>`;
      })
      .join('');

    upcomingBody.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('Anmeldung wirklich zurückziehen?')) return;
        btn.disabled = true;
        try {
          await cancelRegistration(btn.dataset.cancel!);
          await load();
        } catch (err) {
          btn.disabled = false;
          window.alert(`Das hat nicht geklappt: ${(err as Error).message}`);
        }
      });
    });
  }

  function renderPast(items: DashboardPast[]) {
    if (!pastWrap) return;
    if (items.length === 0) {
      pastWrap.innerHTML = `<tr><td class="table__empty" colspan="4">
        Noch keine Teilnahme erfasst. Nach deiner ersten Tour löst du oben den Tourcode ein.</td></tr>`;
      return;
    }
    pastWrap.innerHTML = items
      .map(
        (e) => `<tr>
          <td><span class="table__title">${esc(e.title)}</span><br>
            <span class="tag tag--${esc(e.kind)}">${esc(KIND_LABEL[e.kind] ?? e.kind)}</span></td>
          <td>${fmtDate(e.starts_at ?? e.confirmed_at)}</td>
          <td>${e.distance_km ? `${String(e.distance_km).replace('.', ',')} km` : '–'}</td>
          <td>${e.elevation_m ? `${e.elevation_m} hm` : '–'}</td>
        </tr>`
      )
      .join('');
  }

  pastToggle?.addEventListener('click', () => {
    const target = el.querySelector<HTMLElement>('[data-past-table]');
    if (!target) return;
    const hidden = target.hasAttribute('hidden');
    target.toggleAttribute('hidden', !hidden);
    pastToggle.textContent = hidden ? 'Events ausblenden' : 'Events anzeigen';
    pastToggle.setAttribute('aria-expanded', String(hidden));
  });

  /* -------------------------------------------------------------- Profil */

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }

  function renderProfile(profile: Profile | null, email: string) {
    const name = profile?.display_name || profile?.username || email.split('@')[0] || '';
    if (profileName) profileName.value = profile?.display_name ?? '';
    if (profileUser) profileUser.value = profile?.username ?? '';

    const url = profile?.avatar_url;
    if (avatarImg) {
      if (url) {
        avatarImg.src = url;
        avatarImg.alt = `Profilbild von ${name}`;
        avatarImg.removeAttribute('hidden');
      } else {
        avatarImg.setAttribute('hidden', '');
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
      }
    }
    if (avatarInitials) {
      avatarInitials.textContent = url ? '' : initials(name);
      avatarInitials.toggleAttribute('hidden', Boolean(url));
    }
    avatarRemove?.toggleAttribute('hidden', !url);
  }

  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = profileForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setMsg(profileMsg, 'Wird gespeichert …', 'info');
    try {
      await updateProfile({
        displayName: profileName?.value ?? null,
        username: profileUser?.value ?? null,
      });
      setMsg(profileMsg, 'Gespeichert.', 'ok');
      await load();
    } catch (err) {
      setMsg(profileMsg, (err as Error).message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    avatarWrap?.classList.add('is-busy');
    setMsg(profileMsg, 'Bild wird hochgeladen …', 'info');
    try {
      const url = await uploadAvatar(file);
      await updateProfile({ avatarUrl: url });
      setMsg(profileMsg, 'Profilbild aktualisiert.', 'ok');
      await load();
    } catch (err) {
      setMsg(profileMsg, (err as Error).message, 'error');
    } finally {
      avatarWrap?.classList.remove('is-busy');
      avatarInput.value = '';
    }
  });

  avatarRemove?.addEventListener('click', async () => {
    if (!window.confirm('Profilbild wirklich entfernen?')) return;
    avatarWrap?.classList.add('is-busy');
    try {
      await removeAvatar();
      setMsg(profileMsg, 'Profilbild entfernt.', 'ok');
      await load();
    } catch (err) {
      setMsg(profileMsg, (err as Error).message, 'error');
    } finally {
      avatarWrap?.classList.remove('is-busy');
    }
  });

  /* --------------------------------------------------------- Zielkarten */

  /**
   * Die Eintrage-Formulare liegen zugeklappt unter einem Umschalter.
   * Vorher standen Monatsliga und jede Challenge mit komplett ausgeklapptem
   * Formular untereinander – auf dem Handy waren das mehrere Bildschirm-
   * laengen Eingabefelder, bevor man die naechste Karte ueberhaupt sah.
   * Es ist immer nur eine Karte offen, damit der Ueberblick bleibt.
   */
  function wireGoalToggles(root: HTMLElement) {
    root.querySelectorAll<HTMLButtonElement>('[data-goal-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest<HTMLElement>('.goal-card');
        const body = card?.querySelector<HTMLElement>('[data-goal-body]');
        if (!card || !body) return;

        const open = body.hasAttribute('hidden');

        document.querySelectorAll<HTMLElement>('.goal-card.is-open').forEach((other) => {
          if (other === card) return;
          other.querySelector('[data-goal-body]')?.setAttribute('hidden', '');
          other.querySelector('[data-goal-toggle]')?.setAttribute('aria-expanded', 'false');
          other.classList.remove('is-open');
        });

        body.toggleAttribute('hidden', !open);
        button.setAttribute('aria-expanded', String(open));
        card.classList.toggle('is-open', open);
        if (open) {
          body.querySelector<HTMLInputElement>('input:not([type=file])')?.focus({ preventScroll: true });
        }
      });
    });
  }

  /* ------------------------------------------------------------ Schritte */

  async function renderSteps() {
    if (!stepsWrap) return;
    const supa = getSupabase();
    const { data } = await supa.rpc('step_league');
    const liga = data as {
      tage_uebrig?: number;
      liste?: { summe: number; ich?: boolean }[];
      mein_stand: { summe: number; tage: number; heute: number } | null;
    } | null;
    const stand = liga?.mein_stand ?? { summe: 0, tage: 0, heute: 0 };
    const heute = new Date().toISOString().slice(0, 10);
    const vor31 = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);

    // Die Liga hat kein festes Ziel wie eine Challenge. Damit die Karte
    // trotzdem dieselbe Sprache spricht, misst der Balken den eigenen Stand
    // an der Tabellenspitze und rechts steht der Platz statt des Ziels.
    const liste = liga?.liste ?? [];
    const platz = liste.findIndex((e) => e.ich) + 1;
    const spitze = liste.length ? Math.max(...liste.map((e) => Number(e.summe) || 0)) : 0;
    const anteil = spitze > 0 ? Math.min(100, (Number(stand.summe) / spitze) * 100) : 0;
    const tageUebrig = Number(liga?.tage_uebrig ?? 0);
    const monat = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const zahl = (n: number) => Number(n).toLocaleString('de-DE');

    // Kurz halten: die grosse Zahl bleibt einzeilig wie "20 km" bei den Challenges.
    const rang = platz > 0
      ? `Schritte · Platz ${platz} von ${liste.length}`
      : 'Schritte · noch nicht in der Wertung';

    stepsWrap.innerHTML = `<article class="goal-card steps-card${stand.summe > 0 ? ' is-in' : ''}">
      <div class="chal-card__head">
        <div>
          <h3>Monatsliga</h3>
          <p class="chal-card__sub">Am Monatsende gewinnt, wer am weitesten war.
            <a class="link-underline" href="/liga/">Zur Rangliste</a></p>
        </div>
        <p class="chal-card__period">${esc(monat)}${
          tageUebrig > 0 ? ` · noch ${tageUebrig} ${tageUebrig === 1 ? 'Tag' : 'Tage'}` : ''
        }</p>
      </div>

      <div class="chal-progress">
        <div class="chal-progress__top">
          <span class="chal-progress__now">${zahl(stand.summe)}</span>
          <span class="chal-progress__goal">${rang}</span>
        </div>
        <div class="chal-bar"><i style="width:${anteil}%"></i></div>
      </div>

      <p class="goal__meta">${stand.tage} ${
        stand.tage === 1 ? 'Tag' : 'Tage'
      } erfasst · heute ${zahl(stand.heute)}${spitze > 0 ? ` · Spitze ${zahl(spitze)}` : ''}</p>

      <button class="goal__toggle" type="button" data-goal-toggle aria-expanded="false">
        <span>Schritte eintragen</span><span class="goal__chev" aria-hidden="true"></span>
      </button>
      <form class="chal-form steps-form goal__body" data-goal-body data-steps-form hidden>
        <div class="chal-form__grid">
          <label>
            <span class="lbl">Schritte</span>
            <input type="number" min="0" max="150000" step="1" required placeholder="z. B. 11500" data-st-count />
          </label>
          <label>
            <span class="lbl">Tag</span>
            <input type="date" required min="${vor31}" max="${heute}" value="${heute}" data-st-date />
          </label>
          <label class="chal-form__full">
            <span class="lbl">Nachweis <em>(Screenshot aus Health, Garmin, Fitbit …)</em></span>
            <span class="drop" data-st-drop>
              <span class="drop__icon" aria-hidden="true">↑</span>
              <span class="drop__text" data-st-dropname>
                Screenshot auswählen
                <span class="drop__hint">JPG, PNG oder WebP, max. 5 MB</span>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" required data-st-proof />
            </span>
          </label>
        </div>
        <button class="btn btn--primary chal-form__submit" type="submit">Eintragen</button>
        <p class="chal-msg" data-st-msg data-tone="info" role="status" aria-live="polite"></p>
      </form>
    </article>`;

    wireGoalToggles(stepsWrap);

    const proof = stepsWrap.querySelector<HTMLInputElement>('[data-st-proof]');
    proof?.addEventListener('change', () => {
      const label = stepsWrap.querySelector<HTMLElement>('[data-st-dropname]');
      const datei = proof.files?.[0];
      if (datei && label) {
        label.innerHTML = `${esc(datei.name)}<span class="drop__hint">Bereit zum Hochladen</span>`;
        stepsWrap.querySelector('[data-st-drop]')?.classList.add('has-file');
      }
    });

    stepsWrap.querySelector<HTMLFormElement>('[data-steps-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = stepsWrap.querySelector<HTMLElement>('[data-st-msg]');
      const btn = stepsWrap.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      const anzahl = Number(stepsWrap.querySelector<HTMLInputElement>('[data-st-count]')?.value);
      const datum = stepsWrap.querySelector<HTMLInputElement>('[data-st-date]')?.value;
      const datei = proof?.files?.[0];
      const sag = (t: string, tone: string) => {
        if (msg) {
          msg.textContent = t;
          msg.dataset.tone = tone;
        }
      };
      if (!anzahl || anzahl < 0) return sag('Bitte eine Schrittzahl eintragen.', 'error');
      if (!datum) return sag('Bitte einen Tag wählen.', 'error');
      if (!datei) return sag('Bitte einen Screenshot hochladen.', 'error');

      if (btn) btn.disabled = true;
      sag('Screenshot wird hochgeladen …', 'info');
      try {
        const pfad = await uploadProof(datei);
        const { data: res, error } = await getSupabase().rpc('log_steps', {
          p_steps: anzahl,
          p_date: datum,
          p_proof_url: pfad,
        });
        if (error) throw error;
        const summe = (res as { summe: number }).summe;
        sag(`Eingetragen. Monatsstand: ${Number(summe).toLocaleString('de-DE')} Schritte.`, 'ok');
        await renderSteps();
      } catch (err) {
        sag((err as Error).message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }


  /* --------------------------------------------------------- Challenges */

  function fmtZahl(n: number): string {
    const v = Number(n);
    return v.toLocaleString('de-DE');
  }

  function zeitraum(c: MyChallenge): string {
    const f = (iso: string) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    return `${f(c.starts_on)} – ${f(c.ends_on)}`;
  }

  function renderChallenges(list: MyChallenge[]) {
    if (!challengesWrap) return;
    if (list.length === 0) {
      challengesWrap.innerHTML =
        '<p class="empty">Gerade läuft keine Challenge. Die nächste kündigen wir hier an.</p>';
      return;
    }
    const heute = new Date().toISOString().slice(0, 10);

    challengesWrap.innerHTML = list
      .map((c) => {
        const anteil = Math.min(100, (Number(c.summe) / Number(c.goal)) * 100);
        const laeuft = heute >= c.starts_on && heute <= c.ends_on;
        const rest = Math.max(0, Number(c.goal) - Number(c.summe));
        return `<article class="chal-card goal-card${c.dabei ? ' is-in' : ''}" data-cc="${esc(c.id)}">
          <div class="chal-card__head">
            <div>
              <h3>${esc(c.title)}</h3>
              ${c.subtitle ? `<p class="chal-card__sub">${esc(c.subtitle)}</p>` : ''}
            </div>
            <p class="chal-card__period">${esc(zeitraum(c))}</p>
          </div>

          <div class="chal-progress">
            <div class="chal-progress__top">
              <span class="chal-progress__now">${fmtZahl(c.summe)} ${METRIC_SHORT[c.metric]}</span>
              <span class="chal-progress__goal">von ${fmtZahl(c.goal)} ${METRIC_SHORT[c.metric]}${
                c.geschafft ? '' : ` · noch ${fmtZahl(rest)}`
              }</span>
            </div>
            <div class="chal-bar"><i style="width:${anteil}%"></i></div>
          </div>

          ${
            c.geschafft
              ? `<p class="chal-card__done">✓ Ziel erreicht – Stempel liegt im Heft</p>
                 ${
                   c.shop_code
                     ? `<p class="chal-reward">Dein Gutschein über 20 % im Shop:
                          <b data-cc-code>${esc(c.shop_code)}</b>
                          <button class="chal-copy" type="button" data-cc-copy="${esc(c.shop_code)}">kopieren</button></p>`
                     : ''
                 }
                 ${
                   c.is_winner
                     ? `<p class="chal-reward chal-reward--win">Du hast eines der
                          ${esc(c.prize_label ?? 'Shirts')} gewonnen! Wir melden uns bei dir.</p>`
                     : c.drawn
                       ? '<p class="chal-reward">Die Verlosung ist gelaufen – diesmal hat es nicht geklappt.</p>'
                       : c.prize_count > 0
                         ? `<label class="chal-size">
                              <span class="lbl">Wunschgröße <em>(für die Verlosung von ${c.prize_count} × ${esc(
                                c.prize_label ?? 'Shirt'
                              )})</em></span>
                              <select data-cc-size="${esc(c.id)}">
                                <option value="">Bitte wählen</option>
                                ${SHIRT_SIZES.map(
                                  (g) =>
                                    `<option value="${g}"${c.shirt_size === g ? ' selected' : ''}>${g}</option>`
                                ).join('')}
                              </select>
                            </label>`
                         : ''
                 }`
              : c.prize_count > 0
                ? `<p class="chal-hint">Wer ankommt, bekommt einen Stempel und 20 % im Shop –
                     außerdem verlosen wir ${c.prize_count} × ${esc(c.prize_label ?? 'Shirt')}.</p>`
                : ''
          }

          ${
            laeuft
              ? `<button class="goal__toggle" type="button" data-goal-toggle aria-expanded="false">
                   <span>${c.metric === 'hm' ? 'Höhenmeter' : 'Kilometer'} eintragen</span>
                   <span class="goal__chev" aria-hidden="true"></span>
                 </button>
                 <form class="chal-form goal__body" data-goal-body data-cc-form="${esc(c.id)}" hidden>
                  <div class="chal-form__grid">
                    <label>
                      <span class="lbl">${c.metric === 'hm' ? 'Höhenmeter' : 'Kilometer'}</span>
                      <input type="number" step="0.1" min="0.1" max="500" required
                             placeholder="z. B. 12,5" data-cc-amount />
                    </label>
                    <label>
                      <span class="lbl">Datum</span>
                      <input type="date" required min="${esc(c.starts_on)}"
                             max="${esc(c.ends_on < heute ? c.ends_on : heute)}"
                             value="${esc(heute >= c.starts_on && heute <= c.ends_on ? heute : c.ends_on)}"
                             data-cc-date />
                    </label>
                    <label class="chal-form__full">
                      <span class="lbl">Nachweis <em>(Screenshot aus Komoot, Strava oder Health)</em></span>
                      <span class="drop" data-cc-drop>
                        <span class="drop__icon" aria-hidden="true">↑</span>
                        <span class="drop__text" data-cc-dropname>
                          Screenshot auswählen
                          <span class="drop__hint">JPG, PNG oder WebP, max. 5 MB</span>
                        </span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" required data-cc-proof />
                      </span>
                    </label>
                    <label class="chal-form__full">
                      <span class="lbl">Notiz <em>(optional)</em></span>
                      <input type="text" maxlength="80" placeholder="Wo warst du unterwegs?" data-cc-note />
                    </label>
                  </div>
                  <button class="btn btn--primary chal-form__submit" type="submit">Eintragen</button>
                  <p class="chal-msg" data-cc-msg data-tone="info" role="status" aria-live="polite"></p>
                </form>`
              : `<p class="chal-card__actions"><span class="chal-msg" data-tone="info">${
                  heute < c.starts_on ? 'Startet noch nicht – ab dann kannst du eintragen.' : 'Zeitraum beendet.'
                }</span></p>`
          }
        </article>`;
      })
      .join('');

    wireGoalToggles(challengesWrap);

    // Dateiname anzeigen, sobald etwas gewählt wurde
    challengesWrap.querySelectorAll<HTMLInputElement>('[data-cc-proof]').forEach((input) => {
      input.addEventListener('change', () => {
        const drop = input.closest<HTMLElement>('[data-cc-drop]');
        const label = drop?.querySelector<HTMLElement>('[data-cc-dropname]');
        const datei = input.files?.[0];
        if (datei && label) {
          label.innerHTML = `${esc(datei.name)}<span class="drop__hint">Bereit zum Hochladen</span>`;
          drop?.classList.add('has-file');
        }
      });
    });

    // Wunschgröße speichern
    challengesWrap.querySelectorAll<HTMLSelectElement>('[data-cc-size]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await setShirtSize(sel.dataset.ccSize!, sel.value || null);
        } catch (err) {
          console.error('[challenges]', err);
        }
      });
    });

    // Gutscheincode kopieren
    challengesWrap.querySelectorAll<HTMLButtonElement>('[data-cc-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.ccCopy!);
          btn.textContent = 'kopiert!';
          setTimeout(() => (btn.textContent = 'kopieren'), 2000);
        } catch {
          /* Zwischenablage nicht verfügbar – Code steht ja daneben */
        }
      });
    });

    // Eintragen
    challengesWrap.querySelectorAll<HTMLFormElement>('[data-cc-form]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = form.dataset.ccForm!;
        const msg = form.querySelector<HTMLElement>('[data-cc-msg]');
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        const wert = Number(
          form.querySelector<HTMLInputElement>('[data-cc-amount]')?.value.replace(',', '.')
        );
        const datum = form.querySelector<HTMLInputElement>('[data-cc-date]')?.value;
        const datei = form.querySelector<HTMLInputElement>('[data-cc-proof]')?.files?.[0];
        const notiz = form.querySelector<HTMLInputElement>('[data-cc-note]')?.value;

        const sag = (t: string, tone: string) => {
          if (msg) {
            msg.textContent = t;
            msg.dataset.tone = tone;
          }
        };

        if (!wert || wert <= 0) return sag('Bitte einen Wert größer als 0 eintragen.', 'error');
        if (!datum) return sag('Bitte ein Datum wählen.', 'error');
        if (!datei) return sag('Bitte einen Screenshot als Nachweis hochladen.', 'error');

        if (btn) btn.disabled = true;
        sag('Screenshot wird hochgeladen …', 'info');
        try {
          const pfad = await uploadProof(datei);
          sag('Wird gespeichert …', 'info');
          const res = await logProgress(id, wert, datum, pfad, notiz || undefined);
          sag(
            res.geschafft
              ? 'Ziel erreicht! Der Stempel liegt im Heft.'
              : `Eingetragen. Stand: ${fmtZahl(res.summe)} ${METRIC_SHORT[
                  list.find((x) => x.id === id)?.metric ?? 'km'
                ]}.`,
            'ok'
          );
          await load();
        } catch (err) {
          sag((err as Error).message, 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    });
  }

  /* ------------------------------------------------------- Konto löschen */

  deleteBtn?.addEventListener('click', async () => {
    // Zwei Stufen, weil der Schritt unumkehrbar ist
    if (
      !window.confirm(
        'Konto wirklich löschen? Profil, Anmeldungen, Stempel und Empfehlungscode werden ' +
          'unwiderruflich entfernt.'
      )
    ) {
      return;
    }
    const typed = window.prompt('Zur Bestätigung bitte LÖSCHEN eintippen:');
    if ((typed ?? '').trim().toUpperCase() !== 'LÖSCHEN') {
      setMsg(deleteMsg, 'Abgebrochen – dein Konto bleibt bestehen.', 'info');
      return;
    }

    deleteBtn.disabled = true;
    setMsg(deleteMsg, 'Konto wird gelöscht …', 'info');
    try {
      await deleteAccount();
      window.alert('Dein Konto wurde gelöscht. Schade, dass du gehst – die Touren bleiben offen.');
      window.location.href = '/';
    } catch (err) {
      deleteBtn.disabled = false;
      setMsg(deleteMsg, `Das hat nicht geklappt: ${(err as Error).message}`, 'error');
    }
  });

  /* ------------------------------------------------------------- Referral */

  refCopyBtn?.addEventListener('click', async () => {
    const code = refCodeEl?.textContent?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      refCopyBtn.textContent = 'Kopiert!';
      setTimeout(() => (refCopyBtn.textContent = 'Code kopieren'), 2000);
    } catch {
      refCopyBtn.textContent = code;
    }
  });

  /* ------------------------------------------------------------ Tourcode */

  codeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput?.value.trim();
    if (!code) {
      setMsg(codeMsg, 'Bitte gib den Tourcode ein.', 'error');
      return;
    }
    setMsg(codeMsg, 'Wird geprüft …', 'info');
    try {
      const res = await redeemCode(code);
      if (codeInput) codeInput.value = '';
      if (res.already_had) {
        setMsg(codeMsg, `Für „${res.event_title}“ hast du deinen Stempel schon.`, 'error');
        return;
      }
      setMsg(codeMsg, `Stempel für „${res.event_title}“ gesichert.`, 'ok');
      await load(true);
    } catch (err) {
      const msg = (err as Error).message || '';
      setMsg(
        codeMsg,
        /unbekannt/i.test(msg)
          ? 'Diesen Code kennen wir nicht. Vertippt?'
          : /gültig/i.test(msg)
            ? 'Dieser Code ist nicht mehr gültig.'
            : `Das hat nicht geklappt: ${msg}`,
        'error'
      );
    }
  });

  /* ---------------------------------------------------------------- Laden */

  let currentEmail = '';

  async function load(animateNew = false) {
    try {
      const d = await getDashboard();
      const before = slotsWrap?.querySelectorAll('.slot.is-filled').length ?? 0;

      renderGreeting(d, currentEmail);
      renderProfile(d.profile, currentEmail);
      renderStamps(d.stamps ?? []);
      renderUpcoming(d.upcoming ?? []);
      renderPast(d.past ?? []);
      if (refCodeEl) refCodeEl.textContent = d.referral_code ?? '';

      // Prüfen-Knopf nur für die Clubleitung
      try {
        const { data: istAdmin } = await getSupabase().rpc('is_club_admin');
        adminLink?.toggleAttribute('hidden', !istAdmin);
      } catch {
        /* kein Admin – Knopf bleibt verborgen */
      }

      try {
        await renderSteps();
      } catch (err) {
        console.error('[steps]', err);
      }


      try {
        renderChallenges(await getMyChallenges());
      } catch (err) {
        console.error('[challenges]', err);
      }

      const count = (d.stamps ?? []).length;
      if (animateNew && count > before) {
        const slot = slotsWrap?.querySelectorAll('.slot')[Math.min(count, STAMP_GOAL) - 1];
        slot?.classList.add('is-new');
      }
    } catch (err) {
      setMsg(codeMsg, `Daten konnten nicht geladen werden: ${(err as Error).message}`, 'error');
    }
  }

  /* ------------------------------------------------------------- Session */

  /*
   * getSession() und onAuthStateChange feuern beim Laden beide. Ohne Sperre
   * liefen die Daten-Abrufe parallel – das erzeugte doppelte Schreibvorgänge
   * (z. B. beim Anlegen des Empfehlungscodes) und unnötige Last.
   */
  let aktiveSitzung: string | null = null;
  let laeuft: Promise<void> | null = null;

  async function enter(userId: string, email: string | undefined) {
    if (aktiveSitzung === userId) {
      // Schon eingetreten – auf einen eventuell laufenden Abruf warten
      if (laeuft) await laeuft;
      return;
    }
    aktiveSitzung = userId;
    currentEmail = email ?? '';
    show('area');
    laeuft = (async () => {
      await syncDisplayName();
      await load();
    })();
    await laeuft;
    laeuft = null;
  }

  /**
   * Bei der Registrierung landet der Name in den Auth-Metadaten. Das Profil
   * (profiles.display_name) wird per Trigger angelegt, kennt den Namen aber
   * nicht zwingend – einmalig nachziehen, ohne vorhandene Namen zu überschreiben.
   */
  async function syncDisplayName() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const metaName = (userData.user?.user_metadata as { display_name?: string } | null)
        ?.display_name;
      if (!metaName || !userData.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (profile && !profile.display_name) {
        await supabase.from('profiles').update({ display_name: metaName }).eq('id', userData.user.id);
      }
    } catch {
      // Nicht kritisch – schlimmstenfalls grüßt die Seite mit dem Mail-Präfix.
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      void enter(session.user.id, session.user.email);
    } else {
      aktiveSitzung = null;
      show('login');
    }
  });

  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await enter(data.session.user.id, data.session.user.email);
    } else {
      show('login');
    }
  })();
}
