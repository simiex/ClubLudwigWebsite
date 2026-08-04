/**
 * ============================================================================
 * SUPABASE-CLIENT
 * ============================================================================
 * Die Website ist statisch (Cloudflare Pages). Auth und Datenzugriff laufen
 * deshalb vollständig im Browser gegen Supabase – abgesichert über Row Level
 * Security, nicht über einen eigenen Server.
 *
 * Der Publishable Key gehört ins Frontend und ist bewusst öffentlich. Er
 * erlaubt für sich genommen gar nichts: Was sichtbar ist, entscheiden
 * ausschließlich die RLS-Policies in der Datenbank.
 *
 * NIEMALS den Service-Role-Key hier eintragen – der umgeht RLS komplett.
 * ============================================================================
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://glkugldixsgtiqwdjouj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3qcl4FGcXKcET-GbXb2uqA_UBeAg0r9';

let client: SupabaseClient | null = null;

/** Singleton – mehrere Instanzen würden sich beim Session-Handling stören. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'clubludwig.auth',
      },
    });
  }
  return client;
}

/* -------------------------------------------------------------------------- */
/* Typen (spiegeln das Datenbankschema)                                        */
/* -------------------------------------------------------------------------- */

export type EventKind = 'tour' | 'virtual' | 'challenge';
export type EventStatusDb =
  | 'offen'
  | 'wenige-plaetze'
  | 'ausgebucht'
  | 'abgesagt'
  | 'beendet'
  | 'draft';
export type RegistrationStatus = 'angemeldet' | 'warteliste' | 'storniert';

export interface DbEvent {
  id: string;
  slug: string;
  title: string;
  kind: EventKind;
  venue_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  meeting_point: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  duration_hours: number | null;
  terrain: string | null;
  difficulty: string | null;
  fitness: string | null;
  cost: string | null;
  dogs_allowed: boolean | null;
  status: EventStatusDb;
  description: string;
  registration_url: string | null;
  usc_booking: boolean;
  capacity: number | null;
}

export interface DashboardUpcoming {
  event_id: string;
  slug: string;
  title: string;
  kind: EventKind;
  venue_id: string | null;
  starts_at: string | null;
  distance_km: number | null;
  status: EventStatusDb;
  registration_url: string | null;
  usc_booking: boolean;
  registration_status: RegistrationStatus;
}

export interface DashboardPast {
  event_id: string;
  slug: string;
  title: string;
  kind: EventKind;
  venue_id: string | null;
  starts_at: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  method: 'code' | 'organisator' | 'usc';
  confirmed_at: string;
}

export type StampSource = 'tour' | 'shop' | 'empfehlung' | 'aktion';

export interface StampItem {
  label: string;
  source: StampSource;
  date: string;
}

export interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface Dashboard {
  profile: Profile | null;
  referral_code: string;
  stamps: StampItem[];
  upcoming: DashboardUpcoming[];
  past: DashboardPast[];
  totals: { distance_km: number; elevation_m: number };
}

/* -------------------------------------------------------------------------- */
/* Hilfsfunktionen                                                             */
/* -------------------------------------------------------------------------- */

export async function getDashboard(): Promise<Dashboard> {
  const { data, error } = await getSupabase().rpc('my_dashboard');
  if (error) throw error;
  return data as Dashboard;
}

export async function registerForEvent(eventId: string) {
  const { data, error } = await getSupabase().rpc('register_for_event', { p_event_id: eventId });
  if (error) throw error;
  return (data as Array<{ registration_status: RegistrationStatus }>)[0];
}

export async function cancelRegistration(eventId: string) {
  const { error } = await getSupabase().rpc('cancel_registration', { p_event_id: eventId });
  if (error) throw error;
}

export interface RedeemResult {
  event_id: string;
  event_title: string;
  already_had: boolean;
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  const { data, error } = await getSupabase().rpc('redeem_event_code', { p_code: code });
  if (error) throw error;
  return (data as RedeemResult[])[0];
}

/** Kommende, öffentlich sichtbare Termine – auch ohne Login abrufbar. */
export async function fetchUpcomingEvents(): Promise<DbEvent[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .neq('status', 'draft')
    .neq('status', 'beendet')
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

/* -------------------------------------------------------------------------- */
/* Profil                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateProfile(fields: {
  displayName?: string | null;
  username?: string | null;
  /** '' entfernt das Bild, null lässt es unverändert. */
  avatarUrl?: string | null;
}): Promise<Profile> {
  const { data, error } = await getSupabase().rpc('update_my_profile', {
    p_display_name: fields.displayName ?? null,
    p_username: fields.username ?? null,
    p_avatar_url: fields.avatarUrl ?? null,
  });
  if (error) throw error;
  return data as Profile;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Lädt ein Profilbild hoch und gibt die öffentliche URL zurück.
 *
 * Dateiname ist immer `avatars/<user-id>.<endung>` – dieselbe Konvention wie
 * in der alten App, und zugleich der Eigentumsnachweis für die
 * Storage-Policies. Ein Cache-Buster am Ende sorgt dafür, dass ein neues Bild
 * sofort sichtbar wird.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Nicht angemeldet');

  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error('Bitte ein Bild als JPG, PNG oder WebP wählen.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Das Bild ist größer als 5 MB.');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpeg';
  const path = `avatars/${user.id}.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatar(): Promise<void> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Nicht angemeldet');
  // Endung ist nicht bekannt – alle möglichen entfernen, Fehler sind egal
  await supabase.storage
    .from('avatars')
    .remove(['jpeg', 'jpg', 'png', 'webp', 'JPEG'].map((e) => `avatars/${user.id}.${e}`));
  await updateProfile({ avatarUrl: '' });
}

/**
 * Löscht das eigene Konto samt aller zugehörigen Daten (Art. 17 DSGVO).
 *
 * Das Profilbild muss zuerst über die Storage-API weg – direktes Löschen in
 * storage.objects ist serverseitig gesperrt. Danach räumt delete_my_account()
 * die Datenbank ab; die Session wird lokal beendet, weil das Konto dahinter
 * nicht mehr existiert.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Nicht angemeldet');

  // Fehler hier sind nicht kritisch – ohne Bild gibt es nichts zu löschen
  try {
    await supabase.storage
      .from('avatars')
      .remove(['jpeg', 'jpg', 'png', 'webp', 'JPEG'].map((e) => `avatars/${user.id}.${e}`));
  } catch {
    /* ignorieren */
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  await supabase.auth.signOut();
}
