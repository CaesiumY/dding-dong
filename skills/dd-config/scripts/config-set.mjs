#!/usr/bin/env node

/**
 * config-set.mjs
 * Set a config value by dotted key path with scope support.
 *
 * Usage:
 *   node config-set.mjs <key> <value> [--scope global|project|local] [--cwd <path>]
 *
 * Output (JSON):
 *   { "success": true, "key": "sound.volume", "oldValue": 0.7, "newValue": 0.5, "scope": "global" }
 *   { "error": "invalid_key", "key": "nonexistent", "validKeys": [...] }
 *   { "error": "object_key", "key": "sound" }
 *   { "error": "no_project_root" }
 */

import { readFileSync } from 'node:fs';
import {
  loadConfig,
  getDefaultConfig,
  saveConfig,
  getConfigFile,
  findProjectRoot,
  getProjectConfigFile,
  getProjectLocalConfigFile
} from '../../../scripts/core/config.mjs';

// Parse arguments
const rawArgs = process.argv.slice(2);
let key = null;
let value = undefined;
let scope = 'global';
let cwd = process.cwd();

const positional = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--scope' && rawArgs[i + 1]) { scope = rawArgs[++i]; }
  else if (rawArgs[i] === '--cwd' && rawArgs[i + 1]) { cwd = rawArgs[++i]; }
  else { positional.push(rawArgs[i]); }
}
key = positional[0] || null;
value = positional[1];

if (!key || value === undefined) {
  console.error(JSON.stringify({ error: 'usage', message: 'Usage: config-set.mjs <key> <value> [--scope global|project|local] [--cwd <path>]' }));
  process.exit(1);
}

// Resolve dotted key path against an object (supports dotted key names)
function resolvePath(obj, path) {
  const parts = path.split('.');
  const segs = [];
  let cur = obj, i = 0;
  while (i < parts.length) {
    if (cur == null || typeof cur !== 'object') return null;
    if (parts[i] in cur) { segs.push(parts[i]); cur = cur[parts[i]]; i++; }
    else {
      let ok = false;
      for (let j = i + 2; j <= parts.length; j++) {
        const c = parts.slice(i, j).join('.');
        if (c in cur) { segs.push(c); cur = cur[c]; i = j; ok = true; break; }
      }
      if (!ok) return null;
    }
  }
  return { value: cur, segments: segs };
}

// Collect all leaf keys for error messages
function collectKeys(obj, prefix) {
  let r = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const f = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) r.push(...collectKeys(v, f));
    else r.push(f);
  }
  return r;
}

// Validate key against DEFAULT_CONFIG
const defaults = getDefaultConfig();
const resolved = resolvePath(defaults, key);
if (!resolved) {
  const validKeys = collectKeys(defaults, '');
  console.error(JSON.stringify({ error: 'invalid_key', key, validKeys }));
  process.exit(1);
}
if (resolved.value && typeof resolved.value === 'object' && !Array.isArray(resolved.value)) {
  console.error(JSON.stringify({ error: 'object_key', key }));
  process.exit(1);
}

// Auto-convert value types
if (value === 'true') value = true;
else if (value === 'false') value = false;
else if (!isNaN(value) && value !== '') value = Number(value);

// Get old value from merged config
const merged = loadConfig(cwd);
const oldRes = resolvePath(merged, key);
const oldValue = oldRes ? oldRes.value : null;

// Determine config file path by scope
const projectRoot = findProjectRoot(cwd);
let configFile;
if (scope === 'project' || scope === 'local') {
  if (!projectRoot) {
    console.error(JSON.stringify({ error: 'no_project_root' }));
    process.exit(1);
  }
  configFile = scope === 'project' ? getProjectConfigFile(projectRoot) : getProjectLocalConfigFile(projectRoot);
} else {
  configFile = getConfigFile();
}

// Load existing config file
let config = {};
try { config = JSON.parse(readFileSync(configFile, 'utf8')); } catch {}
const meta = config._meta; delete config._meta;

// Set value using resolved segments (safe for dotted key names)
const segs = resolved.segments;
let obj = config;
for (let i = 0; i < segs.length - 1; i++) {
  if (!obj[segs[i]] || typeof obj[segs[i]] !== 'object') obj[segs[i]] = {};
  obj = obj[segs[i]];
}
obj[segs[segs.length - 1]] = value;

// Restore _meta (global scope only)
if (meta && scope === 'global') config._meta = meta;

saveConfig(config, scope, projectRoot);
console.log(JSON.stringify({ success: true, key, oldValue: oldValue !== undefined ? oldValue : null, newValue: value, scope }));
