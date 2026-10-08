// Builds dist/ledger-deck/ : the app plus the embed files, ready to copy into a website's public folder.
// Run: node scripts/package-module.mjs   (then zip dist/ledger-deck if you want one file)
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'ledger-deck');
const SHIP = ['index.html', 'privacy.html', 'manifest.webmanifest', 'sw.js', 'LICENSE', '.nojekyll', 'css', 'js', 'icons', 'vendor', 'embed'];

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of SHIP) cpSync(join(root, f), join(out, f), { recursive: true });
console.log('Packaged to', out);
