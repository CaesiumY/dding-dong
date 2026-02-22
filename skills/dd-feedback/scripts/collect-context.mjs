#!/usr/bin/env node

/**
 * collect-context.mjs
 * Collects repository info and environment details for dd-feedback skill.
 * Output: JSON with { repository, environment } fields.
 *
 * Usage:
 *   node collect-context.mjs [--cwd <path>]
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAll } from '../../../scripts/core/platform.mjs';
import { loadConfig } from '../../../scripts/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');

// Parse --cwd argument
function parseCwd(args) {
  const idx = args.indexOf('--cwd');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.cwd();
}

function collectRepository() {
  try {
    const pluginJsonPath = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
    const repo = pluginJson.repository?.replace('https://github.com/', '') || null;
    return repo;
  } catch {
    return null;
  }
}

function collectEnvironment(cwd) {
  try {
    const env = detectAll();
    const config = loadConfig(cwd);
    return {
      platform: env.platform,
      audioPlayer: env.audioPlayer?.name || 'none',
      notifier: env.notifier?.name || 'none',
      soundPack: config.sound?.pack || 'default',
      volume: config.sound?.volume ?? 'unknown',
      language: config.language || 'unknown',
      nodeVersion: process.version
    };
  } catch (e) {
    return { error: e.message };
  }
}

const cwd = parseCwd(process.argv.slice(2));
const result = {
  repository: collectRepository(),
  environment: collectEnvironment(cwd)
};

console.log(JSON.stringify(result, null, 2));
