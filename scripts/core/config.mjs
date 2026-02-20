import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'dding-dong');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const STATE_FILE = join(CONFIG_DIR, '.state.json');

const DEFAULT_CONFIG = {
  enabled: true,
  language: 'ko',
  sound: {
    enabled: true,
    pack: 'default',
    volume: 0.7,
    events: {
      'task.complete': true,
      'task.error': true,
      'input.required': true,
      'session.start': false,
      'session.end': false
    }
  },
  notification: {
    enabled: true,
    events: {
      'task.complete': true,
      'task.error': true,
      'input.required': true,
      'session.start': false,
      'session.end': false
    }
  },
  messages: {
    'task.complete': '작업이 완료되었습니다!',
    'task.error': '오류가 발생했습니다',
    'input.required': '확인이 필요합니다',
    'session.start': '코딩을 시작합니다',
    'session.end': '세션이 종료되었습니다'
  },
  quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
  cooldown_seconds: 3
};

export function getConfigDir() { return CONFIG_DIR; }
export function getPacksDir() { return join(CONFIG_DIR, 'packs'); }
export function getConfigFile() { return CONFIG_FILE; }
export function getStateFile() { return STATE_FILE; }

export function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(join(CONFIG_DIR, 'packs'), { recursive: true });
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig() {
  let userConfig = {};
  try {
    userConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}

  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  // 환경변수 오버라이드
  if (process.env.DDING_DONG_ENABLED === 'false') config.enabled = false;
  if (process.env.DDING_DONG_VOLUME) config.sound.volume = parseFloat(process.env.DDING_DONG_VOLUME);
  if (process.env.DDING_DONG_LANG) config.language = process.env.DDING_DONG_LANG;

  return config;
}

export function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function getDefaultConfig() { return structuredClone(DEFAULT_CONFIG); }

export function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(state) {
  ensureConfigDir();
  writeFileSync(STATE_FILE, JSON.stringify(state) + '\n', 'utf8');
}
