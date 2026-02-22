#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..', '..', '..');

// 플러그인 버전을 plugin.json에서 동적으로 읽기
let pluginVersion = 'unknown';
try {
  const pluginJson = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  pluginVersion = pluginJson.version ?? 'unknown';
} catch {}

// 글로벌 설정 디렉토리 보장
const configDir = join(homedir(), '.config', 'dding-dong');
const configFile = join(configDir, 'config.json');
mkdirSync(configDir, { recursive: true });

// 기존 글로벌 config 로드 (없으면 빈 객체)
let config = {};
try {
  config = JSON.parse(readFileSync(configFile, 'utf8'));
} catch {}

// _meta 필드 기록
const meta = {
  setupCompleted: true,
  setupVersion: pluginVersion,
  setupDate: new Date().toISOString()
};
config._meta = meta;

writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify({ success: true, meta }) + '\n');
