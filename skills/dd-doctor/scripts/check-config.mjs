#!/usr/bin/env node

/**
 * check-config.mjs
 * Collects setup status, merged config, and config file paths for dd-doctor diagnostics.
 * Output: JSON with { setup, config, paths } fields.
 *
 * Usage:
 *   node check-config.mjs [--cwd <path>]
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadConfig,
  getConfigFile,
  findProjectRoot,
  getProjectConfigFile,
  getProjectLocalConfigFile
} from '../../../scripts/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse --cwd argument
function parseCwd(args) {
  const idx = args.indexOf('--cwd');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.cwd();
}

const cwd = parseCwd(process.argv.slice(2));
const config = loadConfig(cwd);

// Extract setup metadata from _meta field
const setup = config._meta?.setupCompleted
  ? { completed: true, version: config._meta.setupVersion || null, date: config._meta.setupDate || null }
  : { completed: false };

// Config file paths and existence
const globalPath = getConfigFile();
const projectRoot = findProjectRoot(cwd);
const projectPath = projectRoot ? getProjectConfigFile(projectRoot) : null;
const projectLocalPath = projectRoot ? getProjectLocalConfigFile(projectRoot) : null;

const result = {
  setup,
  config,
  paths: {
    global: { path: globalPath, exists: existsSync(globalPath) },
    project: { path: projectPath, exists: projectPath ? existsSync(projectPath) : false },
    projectLocal: { path: projectLocalPath, exists: projectLocalPath ? existsSync(projectLocalPath) : false }
  }
};

console.log(JSON.stringify(result, null, 2));
