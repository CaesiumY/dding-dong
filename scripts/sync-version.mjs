#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

const args = process.argv.slice(2);
const subcmd = args[0];

const PLUGIN_JSON = resolve(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
const MARKETPLACE_JSON = resolve(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json');

// --- semver helpers ---

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function bumpSemver(version, level) {
  const v = parseSemver(version);
  if (!v) return null;
  switch (level) {
    case 'major': return `${v.major + 1}.0.0`;
    case 'minor': return `${v.major}.${v.minor + 1}.0`;
    case 'patch': return `${v.major}.${v.minor}.${v.patch + 1}`;
    default: return null;
  }
}

// --- version readers ---

function readSourceVersion() {
  const raw = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8'));
  return raw.version;
}

function readAllVersions() {
  const pluginJson = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8'));
  const marketplaceJson = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
  return {
    'plugin.json:version': pluginJson.version,
    'marketplace.json:version': marketplaceJson.version,
    'marketplace.json:plugins[0].version': marketplaceJson.plugins?.[0]?.version,
  };
}

// --- sync ---

if (subcmd === 'sync') {
  const sourceVersion = readSourceVersion();
  const marketplaceJson = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));

  const changed = [];
  if (marketplaceJson.version !== sourceVersion) {
    changed.push({ field: 'marketplace.json:version', from: marketplaceJson.version, to: sourceVersion });
    marketplaceJson.version = sourceVersion;
  }
  if (marketplaceJson.plugins?.[0] && marketplaceJson.plugins[0].version !== sourceVersion) {
    changed.push({ field: 'marketplace.json:plugins[0].version', from: marketplaceJson.plugins[0].version, to: sourceVersion });
    marketplaceJson.plugins[0].version = sourceVersion;
  }

  if (changed.length > 0) {
    writeFileSync(MARKETPLACE_JSON, JSON.stringify(marketplaceJson, null, 2) + '\n', 'utf8');
  }

  process.stdout.write(JSON.stringify({ synced: true, version: sourceVersion, changed }, null, 2) + '\n');
  process.exit(0);
}

// --- verify ---

if (subcmd === 'verify') {
  const versions = readAllVersions();
  const sourceVersion = versions['plugin.json:version'];

  const mismatches = [];
  for (const [location, version] of Object.entries(versions)) {
    if (version !== sourceVersion) {
      mismatches.push({ location, expected: sourceVersion, actual: version });
    }
  }

  const result = {
    consistent: mismatches.length === 0,
    version: sourceVersion,
    locations: versions,
  };
  if (mismatches.length > 0) result.mismatches = mismatches;

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(mismatches.length > 0 ? 1 : 0);
}

// --- bump ---

if (subcmd === 'bump') {
  const level = args[1];
  if (!['major', 'minor', 'patch'].includes(level)) {
    console.error(`오류: bump 레벨은 major, minor, patch 중 하나여야 합니다. (입력: ${level || '없음'})`);
    process.exit(1);
  }

  const pluginJson = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8'));
  const oldVersion = pluginJson.version;
  const newVersion = bumpSemver(oldVersion, level);

  if (!newVersion) {
    console.error(`오류: 현재 버전 '${oldVersion}'을(를) 파싱할 수 없습니다.`);
    process.exit(1);
  }

  pluginJson.version = newVersion;
  writeFileSync(PLUGIN_JSON, JSON.stringify(pluginJson, null, 2) + '\n', 'utf8');

  const marketplaceJson = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
  marketplaceJson.version = newVersion;
  if (marketplaceJson.plugins?.[0]) {
    marketplaceJson.plugins[0].version = newVersion;
  }
  writeFileSync(MARKETPLACE_JSON, JSON.stringify(marketplaceJson, null, 2) + '\n', 'utf8');

  process.stdout.write(JSON.stringify({ bumped: true, from: oldVersion, to: newVersion, level }, null, 2) + '\n');
  process.exit(0);
}

// --- help ---

console.log('dding-dong sync-version');
console.log('');
console.log('사용법: node sync-version.mjs <subcmd> [옵션]');
console.log('');
console.log('서브커맨드:');
console.log('  sync              plugin.json → marketplace.json 버전 동기화');
console.log('  verify            버전 일관성 검증 (불일치 시 exit 1)');
console.log('  bump <level>      버전 범프 + 자동 동기화 (major|minor|patch)');
console.log('');
console.log('진실 원천 (Source of Truth): .claude-plugin/plugin.json');
