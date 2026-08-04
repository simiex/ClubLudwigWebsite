/**
 * ============================================================================
 * VIRTUELLE CHALLENGES
 * ============================================================================
 * Zeitraum statt Termin, Kilometerziel statt Strecke, laufender Fortschritt
 * statt einmaliger Teilnahme. Wer sein Ziel erreicht, bekommt automatisch
 * einen Stempel – dieselbe Mechanik wie bei echten Touren.
 * ============================================================================
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, getSupabase } from './supabase';
import fallback from '../data/challenges.json';

export type Metric = 'km' | 'hm' | 'touren';

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  metric: Metric;
  goal: number;
  starts_on: string;
  ends_on: string;
  awards_stamp: boolean;
  status: 'geplant' | 'laufend' | 'beendet' | 'entwurf';
}

export const METRIC_LABEL: Record<Metric, string> = {
  km: 'Kilometer',
  hm: 'Höhenmeter',
  touren: 'Touren',
};

export const METRIC_SHORT: Record<Metric, string> = {
  km: 'km',
  hm: 'hm',
  touren: 'Touren',
};

export function formatAmount(value: number, metric: Metric): string {
  const n = Number(value);
  const s = Number.isInteger(n) ? n.toLocaleString('de-DE') : n.toLocaleString('de-DE');
  return `${s} ${METRIC_SHORT[metric]}`;
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** "1. – 30. September 2026" bzw. monatsübergreifend ausgeschrieben. */
export function formatPeriod(c: Challenge): string {
  const a = new Date(`${c.starts_on}T12:00:00`);
  const b = new Date(`${c.ends_on}T12:00:00`);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}. – ${b.getDate()}. ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  }
  return `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** Zustand aus dem Datum, nicht aus dem Statusfeld – das kann veralten. */
export function phase(c: Challenge, now = new Date()): 'kommend' | 'laufend' | 'vorbei' {
  const heute = now.toISOString().slice(0, 10);
  if (heute < c.starts_on) return 'kommend';
  if (heute > c.ends_on) return 'vorbei';
  return 'laufend';
}

/** Verbleibende Tage – null, wenn die Challenge noch nicht läuft. */
export function daysLeft(c: Challenge, now = new Date()): number | null {
  if (phase(c, now) !== 'laufend') return null;
  const ende = new Date(`${c.ends_on}T23:59:59`);
  return Math.max(0, Math.ceil((ende.getTime() - now.getTime()) / 86400000));
}

/** Build-Zeit: alle sichtbaren Challenges. */
export async function loadChallenges(): Promise<Challenge[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cl_challenges?select=*&status=neq.entwurf&order=starts_on.asc`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as Challenge[];
    console.log(`[challenges] ${rows.length} Challenge(s) aus Supabase geladen.`);
    return rows;
  } catch (err) {
    console.warn(
      `[challenges] ⚠  Supabase beim Build nicht erreichbar (${(err as Error).message}).` +
        ` Fallback auf src/data/challenges.json.`
    );
    return fallback as Challenge[];
  }
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

export interface ChallengeLog {
  id: string;
  datum: string;
  wert: number;
  notiz: string | null;
}

export interface Board {
  challenge: Challenge;
  teilnehmer: number;
  mein_stand: { dabei: boolean; summe: number; geschafft: boolean; logs: ChallengeLog[] } | null;
  rangliste: Array<{
    name: string;
    avatar: string | null;
    summe: number;
    geschafft: boolean;
    ich: boolean;
  }>;
}

export async function getBoard(slug: string): Promise<Board | null> {
  const { data, error } = await getSupabase().rpc('challenge_board', { p_slug: slug });
  if (error) throw error;
  return data as Board | null;
}

export async function joinChallenge(id: string) {
  const { error } = await getSupabase().rpc('join_challenge', { p_challenge_id: id });
  if (error) throw error;
}

export async function leaveChallenge(id: string) {
  const { error } = await getSupabase().rpc('leave_challenge', { p_challenge_id: id });
  if (error) throw error;
}

export async function logProgress(
  id: string,
  amount: number,
  date: string,
  proofUrl: string,
  note?: string
) {
  const { data, error } = await getSupabase().rpc('log_challenge_progress', {
    p_challenge_id: id,
    p_amount: amount,
    p_date: date,
    p_note: note ?? null,
    p_proof_url: proofUrl,
  });
  if (error) throw error;
  return data as { summe: number; ziel: number; geschafft: boolean };
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Lädt den Nachweis-Screenshot hoch und gibt den Pfad zurück.
 * Der Bucket ist nicht öffentlich – Belege sehen nur die Person selbst
 * und die Clubleitung.
 */
export async function uploadProof(file: File): Promise<string> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Nicht angemeldet');

  if (!PROOF_TYPES.includes(file.type)) {
    throw new Error('Bitte einen Screenshot als JPG, PNG oder WebP hochladen.');
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('Der Screenshot ist größer als 5 MB.');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const pfad = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('challenge-proofs')
    .upload(pfad, file, { contentType: file.type });
  if (error) throw error;
  return pfad;
}

/** Zeitlich begrenzter Link auf einen Nachweis (Bucket ist privat). */
export async function proofLink(pfad: string): Promise<string | null> {
  const { data } = await getSupabase().storage
    .from('challenge-proofs')
    .createSignedUrl(pfad, 300);
  return data?.signedUrl ?? null;
}

export interface MyChallenge {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  metric: Metric;
  goal: number;
  starts_on: string;
  ends_on: string;
  dabei: boolean;
  summe: number;
  geschafft: boolean;
  shop_code: string | null;
  prize_count: number;
  prize_label: string | null;
  shirt_size: string | null;
  is_winner: boolean;
  drawn: boolean;
}

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export async function setShirtSize(challengeId: string, size: string | null) {
  const { error } = await getSupabase().rpc('set_shirt_size', {
    p_challenge_id: challengeId,
    p_size: size,
  });
  if (error) throw error;
}

export async function getMyChallenges(): Promise<MyChallenge[]> {
  const { data, error } = await getSupabase().rpc('my_challenges');
  if (error) throw error;
  return (data ?? []) as MyChallenge[];
}

export async function deleteLog(logId: string) {
  const { error } = await getSupabase().rpc('delete_challenge_log', { p_log_id: logId });
  if (error) throw error;
}
