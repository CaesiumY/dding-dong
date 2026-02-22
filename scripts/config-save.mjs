#!/usr/bin/env node
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

const { saveConfig, findProjectRoot, getConfigFile, getProjectConfigFile, getProjectLocalConfigFile } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));

// 인자 파싱
const args = process.argv.slice(2);
const configJson = args[0];

function parseFlag(name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

const scope = parseFlag('--scope') || 'global';
const cwd = parseFlag('--cwd') || process.cwd();

// JSON 파싱
let config;
try {
  config = JSON.parse(configJson);
} catch (e) {
  process.stdout.write(JSON.stringify({ error: 'invalid_json', message: e.message }) + '\n');
  process.exit(0);
}

// 스코프별 저장
if (scope === 'project' || scope === 'local') {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    process.stdout.write(JSON.stringify({ error: 'no_project_root' }) + '\n');
    process.exit(0);
  }
  saveConfig(config, scope, projectRoot);
  const pathFn = scope === 'project' ? getProjectConfigFile : getProjectLocalConfigFile;
  process.stdout.write(JSON.stringify({ success: true, scope, path: pathFn(projectRoot) }) + '\n');
} else {
  saveConfig(config, 'global');
  process.stdout.write(JSON.stringify({ success: true, scope: 'global', path: getConfigFile() }) + '\n');
}
