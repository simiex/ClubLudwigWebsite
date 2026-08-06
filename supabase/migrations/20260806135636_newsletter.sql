-- ============================================================================
-- NEWSLETTER – Wochenmail mit den Märschen der laufenden Woche
-- ============================================================================
-- Zwei Tabellen:
--   newsletter_subscribers  Empfängerliste inkl. Double-Opt-in-Nachweis
--   newsletter_sends        Versandprotokoll (verhindert Doppelversand)
--
-- Beide Tabellen sind für den anon-Key komplett gesperrt. Jeder Zugriff läuft
-- ausschließlich über die Edge Functions mit Service-Role-Key.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Empfänger
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  -- Kleinschreibung als eindeutiger Schlüssel: "Simon@" und "simon@" sind
  -- dieselbe Person, sollen sich aber nicht doppelt eintragen können.
  email_normalized  text generated always as (lower(trim(email))) stored,

  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unsubscribed', 'bounced')),

  confirm_token     text,
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),

  -- Double-Opt-in-Nachweis (§ 7 UWG / Art. 7 DSGVO): wer, wann, von wo
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz,
  unsubscribed_at   timestamptz,
  signup_ip         inet,
  signup_user_agent text,
  confirm_ip        inet,
  source            text default 'website',

  last_sent_at      timestamptz,
  send_failures     smallint not null default 0
);

create unique index if not exists newsletter_subscribers_email_uidx
  on public.newsletter_subscribers (email_normalized);

create unique index if not exists newsletter_subscribers_confirm_uidx
  on public.newsletter_subscribers (confirm_token)
  where confirm_token is not null;

create unique index if not exists newsletter_subscribers_unsub_uidx
  on public.newsletter_subscribers (unsubscribe_token);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

-- ---------------------------------------------------------------------------
-- Versandprotokoll
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_sends (
  id            uuid primary key default gen_random_uuid(),
  -- Montag der versendeten Woche, z. B. 2026-08-10 – zugleich Sperre gegen
  -- versehentlichen Doppelversand (unique).
  week_start    date not null unique,
  subject       text not null,
  march_count   integer not null default 0,
  event_count   integer not null default 0,
  recipients    integer not null default 0,
  failed        integer not null default 0,
  sent_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: alles dicht. Nur Service Role (Edge Functions) kommt rein.
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_sends       enable row level security;

revoke all on public.newsletter_subscribers from anon, authenticated;
revoke all on public.newsletter_sends       from anon, authenticated;

-- Bewusst KEINE Policies: ohne Policy sieht anon/authenticated null Zeilen.
-- Service Role umgeht RLS ohnehin.

-- ---------------------------------------------------------------------------
-- Aufräumen: unbestätigte Anmeldungen nach 14 Tagen löschen (Datenminimierung)
-- ---------------------------------------------------------------------------
create or replace function public.newsletter_purge_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.newsletter_subscribers
   where status = 'pending'
     and created_at < now() - interval '14 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.newsletter_purge_stale() from anon, authenticated;

-- ============================================================================
-- CRON – Montag 07:00 Europe/Berlin
-- ============================================================================
-- pg_cron rechnet in UTC. Berlin ist im Sommer UTC+2, im Winter UTC+1.
-- Deshalb zwei Jobs: die Edge Function selbst prüft die lokale Stunde und
-- bricht ab, wenn sie zur falschen Zeit gestartet wurde (siehe index.ts).
-- ----------------------------------------------------------------------------
-- VOR dem Ausführen einmal im SQL-Editor setzen (Dashboard → SQL):
--
--   select vault.create_secret('https://<project>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',            'service_role_key');
--
-- ============================================================================

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

create or replace function public.newsletter_trigger_weekly()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  perform net.http_post(
    url     := v_url || '/functions/v1/newsletter-weekly',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 120000
  );
end;
$$;

-- 05:00 UTC (= 07:00 Sommerzeit) und 06:00 UTC (= 07:00 Winterzeit).
-- Der zweite Lauf findet die Woche bereits in newsletter_sends und beendet
-- sich sofort – es geht also nie eine Mail doppelt raus.
select cron.schedule(
  'newsletter-weekly-sommer',
  '0 5 * * 1',
  $$select public.newsletter_trigger_weekly();$$
);

select cron.schedule(
  'newsletter-weekly-winter',
  '0 6 * * 1',
  $$select public.newsletter_trigger_weekly();$$
);

-- Wöchentliches Aufräumen der Karteileichen
select cron.schedule(
  'newsletter-purge-stale',
  '30 3 * * 1',
  $$select public.newsletter_purge_stale();$$
);
