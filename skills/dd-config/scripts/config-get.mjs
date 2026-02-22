#!/usr/bin/env node

/**
 * config-get.mjs
 * Retrieve a single config value by dotted key path.
 *
 * Usage:
 *   node config-get.mjs <key> [--cwd <path>]
 *
 * Output (JSON):
 *   { "key": "sound.volume", "value": 0.7 }
 *   { "error": "not_found", "key": "sound.nonexistent" }
 *   { "error": "no_key" }
 */

import { loadConfig } from '../../../scripts/core/config.mjs';

// Parse arguments
const args = process.argv.slice(2);
const cwdIdx = args.indexOf('--cwd');
let cwd = process.cwd();
let key = null;

if (cwdIdx !== -1) {
  cwd = args[cwdIdx + 1] || cwd;
  args.splice(cwdIdx, 2);
}
key = args[0] || null;

if (!key) {
  console.error(JSON.stringify({ error: 'no_key' }));
  process.exit(1);
}

const config = loadConfig(cwd);

// Resolve dotted key path (supports dotted key names like "task.complete")
const parts = key.split('.');
let cur = config;
let i = 0;
while (i < parts.length) {
  if (cur == null || typeof cur !== 'object') { cur = undefined; break; }
  if (parts[i] in cur) { cur = cur[parts[i]]; i++; }
  else {
    let ok = false;
    for (let j = i + 2; j <= parts.length; j++) {
      const c = parts.slice(i, j).join('.');
      if (c in cur) { cur = cur[c]; i = j; ok = true; break; }
    }
    if (!ok) { cur = undefined; break; }
  }
}

if (cur === undefined) {
  console.error(JSON.stringify({ error: 'not_found', key }));
  process.exit(1);
}

console.log(JSON.stringify({ key, value: cur }));
