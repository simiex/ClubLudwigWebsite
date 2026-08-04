/**
 * ============================================================================
 * STEMPELHEFT
 * ============================================================================
 * Wer mitwandert, sammelt Stempel. Bei `STAMP_GOAL` Stempeln gibt es die
 * Prämie.
 *
 * WIE ES FUNKTIONIERT
 *   Am Ende jeder Tour nennt ihr einen Tourcode. Wer eingeloggt ist, tippt
 *   ihn in „Mein Club“ ein und bekommt den Stempel. Der Stand hängt am
 *   Konto, nicht am Gerät.
 *
 * SICHERHEIT
 *   Die Code-Hashes liegen in Supabase (`event_codes`) und sind per RLS für
 *   Clients gesperrt. Geprüft wird serverseitig in `redeem_event_code()`;
 *   `event_attendance` ist für normale Konten schreibgeschützt. Teilnahmen
 *   lassen sich aus dem Browser heraus also weder auslesen noch erfinden.
 * ============================================================================
 */

/** Anzahl Stempel bis zur Prämie. */
export const STAMP_GOAL = 5;

/** Ausgeschriebenes Zahlwort für Überschriften – hängt an STAMP_GOAL. */
const NUMBER_WORDS: Record<number, string> = {
  3: 'Drei',
  4: 'Vier',
  5: 'Fünf',
  6: 'Sechs',
  7: 'Sieben',
  8: 'Acht',
  9: 'Neun',
  10: 'Zehn',
};

export const STAMP_GOAL_WORD = NUMBER_WORDS[STAMP_GOAL] ?? String(STAMP_GOAL);

export const reward = {
  title: 'Club-Ludwig-Shirt',
  description:
    'Fünf Stempel, ein Shirt. Sammeln kannst du sie beim Mitwandern, über Bestellungen im Shop und über deinen Empfehlungscode.',
  /** Verweis auf den Shop, damit man sieht, worum es geht. */
  shopUrl: 'https://www.clubludwig.shop',
} as const;

/**
 * ============================================================================
 * HINWEIS: Die Tourcodes liegen NICHT mehr hier.
 * ============================================================================
 * Seit der Umstellung auf Konten stehen sie als SHA-256-Hashes in der Tabelle
 * `event_codes` in Supabase und sind für Clients per RLS komplett gesperrt.
 * Geprüft wird serverseitig über die Funktion `redeem_event_code()`.
 *
 * Neuen Code anlegen:
 *   node scripts/hash-code.mjs DRACHEN26
 * Ergebnis in Supabase eintragen:
 *   insert into event_codes (event_id, code_hash) values ('<event-uuid>', '<hash>');
 * ============================================================================
 */
