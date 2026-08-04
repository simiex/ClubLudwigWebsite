#!/usr/bin/env node
/**
 * Erzeugt den SHA-256-Hash für einen Tourcode.
 *
 *   node scripts/hash-code.mjs DRACHEN26
 *
 * Der Code wird vor dem Hashen normalisiert (getrimmt, Großbuchstaben) –
 * genauso wie später die Eingabe im Browser. Groß-/Kleinschreibung und
 * Leerzeichen spielen für die Nutzer:innen also keine Rolle.
 */
import { createHash } from 'node:crypto';

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Aufruf: node scripts/hash-code.mjs <TOURCODE>');
  process.exit(1);
}

const normalized = input.trim().toUpperCase().replace(/\s+/g, '');
const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');

console.log(`\n  Code:  ${normalized}`);
console.log(`  Hash:  ${hash}\n`);
console.log('  In src/config/stempelheft.ts eintragen:\n');
console.log(`  { hash: '${hash}', label: '…', venueId: '…' },\n`);
