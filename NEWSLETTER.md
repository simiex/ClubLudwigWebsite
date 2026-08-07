# Newsletter – Der Wochenmarsch

Wöchentliche Mail, montags um 07:00 Uhr (Europe/Berlin), mit allen Märschen und
Club-Ludwig-Touren der laufenden Woche plus einem Ausblick auf vier Wochen.

## Was wo liegt

```
supabase/
  migrations/20260806120000_newsletter.sql   Tabellen, RLS, Cron
  config.toml                                JWT-Einstellungen der Functions
  functions/
    _shared/config.ts        Secrets, CORS, kleine Helfer
    _shared/marches.ts       Typen, Datumsformate, Wochenlogik
    _shared/mailer.ts        Versand über Resend (einzeln + Batch)
    _shared/templates.ts     HTML- und Textvorlagen
    newsletter-subscribe/    Anmeldung + Bestätigungsmail
    newsletter-confirm/      Klick auf den Bestätigungslink + Erstausgabe
    newsletter-unsubscribe/  Abmeldung (auch One-Click aus Gmail)
    newsletter-weekly/       Der eigentliche Versand (Cron)
src/
  components/NewsletterSignup.astro   Anmeldeformular (band | compact)
  pages/newsletter/index.astro        Landing- und Statusseite
scripts/newsletter-preview.ts         Vorschau lokal rendern, ohne Versand
```

Eingebunden ist das Formular im Footer (jede Seite), auf `/maersche/` und auf
`/newsletter/`. Die Datenschutzerklärung hat einen neuen Abschnitt
`#newsletter`.

## Einrichtung – einmalig

### 1. Resend

1. Account auf [resend.com](https://resend.com) anlegen.
2. Domain `clubludwig.de` hinzufügen, die drei DNS-Einträge (SPF, DKIM, DMARC)
   bei Cloudflare eintragen und verifizieren lassen.
3. API-Key erzeugen (Sending access genügt).

Ohne verifizierte Domain landet der Newsletter im Spam – dieser Schritt lohnt
die Viertelstunde.

### 2. Datenbank

Die Migration im Supabase-SQL-Editor ausführen (oder `supabase db push`).
Vorher die beiden Vault-Secrets setzen, die der Cronjob braucht:

```sql
select vault.create_secret('https://glkugldixsgtiqwdjouj.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```

### 3. Secrets der Edge Functions

Dashboard → Edge Functions → Secrets:

| Name                  | Wert                                       |
| --------------------- | ------------------------------------------ |
| `RESEND_API_KEY`      | Key aus Schritt 1                          |
| `NEWSLETTER_FROM`     | `Club Ludwig <post@clubludwig.de>`         |
| `NEWSLETTER_REPLY_TO` | `simon@clubludwig.de`                      |
| `SITE_URL`            | `https://clubludwig.de`                    |

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase selbst.

### 4. Functions deployen

```bash
supabase functions deploy newsletter-subscribe   --no-verify-jwt
supabase functions deploy newsletter-confirm     --no-verify-jwt
supabase functions deploy newsletter-unsubscribe --no-verify-jwt
supabase functions deploy newsletter-weekly
```

### 5. Website deployen

Normaler Push – Cloudflare baut neu.

## Testen

**Mail lokal ansehen, ohne irgendetwas zu verschicken:**

```bash
npm run newsletter:preview              # kommende Woche
npm run newsletter:preview 2026-09-14   # bestimmter Montag
open .preview/newsletter.html
```

**Echte Testmail an eine Adresse (ändert nichts in der Datenbank):**

```bash
curl -X POST https://glkugldixsgtiqwdjouj.supabase.co/functions/v1/newsletter-weekly \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test_to":"simon@clubludwig.de"}'
```

**Versand außer der Reihe an alle:** `{"force":true}` statt `test_to`.

## Betrieb

Wer ist im Verteiler:

```sql
select status, count(*) from newsletter_subscribers group by status;
```

Versandhistorie:

```sql
select * from newsletter_sends order by week_start desc limit 12;
```

### Sicherungen im System

- **Doppelversand:** `newsletter_sends.week_start` ist unique. Ein zweiter Lauf
  in derselben Woche beendet sich sofort.
- **Sommer-/Winterzeit:** pg_cron rechnet in UTC, deshalb sind zwei Jobs
  eingetragen (05:00 und 06:00 UTC). Die Function bricht ab, wenn es in Berlin
  noch vor 7 Uhr ist – so trifft immer genau einer der beiden.
- **Einzelne kaputte Adresse:** Der Versand läuft in Paketen zu 100. Fällt ein
  Paket durch, gehen die übrigen trotzdem raus, und die betroffenen Adressen
  stehen im Log.

## Rechtliches

- **Double Opt-in.** Ohne Klick auf den Bestätigungslink wird nichts versendet.
- **Nachweis** der Einwilligung: Zeitpunkt, IP und Browserkennung bei Anmeldung
  und Bestätigung stehen in der Tabelle.
- **Abmeldung** in jeder Mail, zusätzlich über den `List-Unsubscribe`-Header
  (Abmeldebutton direkt in Gmail und Apple Mail).
- **Kein Tracking.** Keine Zählpixel, keine Klickmessung – deshalb braucht es
  auch keine gesonderte Einwilligung dafür.
- Unbestätigte Anmeldungen werden nach 14 Tagen automatisch gelöscht.

Offen: In der Datenschutzerklärung steht Resend als Auftragsverarbeiter. Den
AV-Vertrag musst du im Resend-Dashboard noch abschließen (Settings → Legal).

## Stellschrauben

| Was                          | Wo                                                       |
| ---------------------------- | -------------------------------------------------------- |
| Sendezeit                    | `cron.schedule(...)` in der Migration                     |
| Länge des Ausblicks          | `OUTLOOK_DAYS` / `OUTLOOK_MAX` in `newsletter-weekly`     |
| Betreffzeile                 | `weeklySubject()` in `_shared/templates.ts`               |
| Farben und Layout der Mail   | Konstanten oben in `_shared/templates.ts`                 |
| Texte am Formular            | Props von `<NewsletterSignup />`                          |
