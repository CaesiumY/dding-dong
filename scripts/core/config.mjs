import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// --- Global 경로 상수 (하위 호환 유지) ---
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

// --- Global 경로 함수 (하위 호환) ---
export function getConfigDir() { return CONFIG_DIR; }
export function getPacksDir() { return join(CONFIG_DIR, 'packs'); }
export function getConfigFile() { return CONFIG_FILE; }
export function getStateFile() { return STATE_FILE; }

// --- Project 경로 함수 ---
export function getProjectConfigDir(projectRoot) { return join(projectRoot, '.dding-dong'); }
export function getProjectConfigFile(projectRoot) { return join(projectRoot, '.dding-dong', 'config.json'); }
export function getProjectLocalConfigFile(projectRoot) { return join(projectRoot, '.dding-dong', 'config.local.json'); }

/**
 * 프로젝트 루트 탐지 (3단 폴백, 깊이 상한 10단계)
 * 1차: .dding-dong/ 디렉토리 내 설정 파일 존재 여부 (config.json 또는 config.local.json)
 * 2차: .git 디렉토리 존재 여부
 * 3차: null (프로젝트 루트 없음)
 */
export function findProjectRoot(startDir, maxDepth = 10) {
  // 1차: .dding-dong/ 설정 파일 탐색
  let dir = startDir;
  let depth = 0;
  while (dir !== dirname(dir) && depth < maxDepth) {
    const ddDir = join(dir, '.dding-dong');
    if (existsSync(join(ddDir, 'config.json')) || existsSync(join(ddDir, 'config.local.json'))) return dir;
    dir = dirname(dir);
    depth++;
  }

  // 2차: .git 디렉토리 탐색
  dir = startDir;
  depth = 0;
  while (dir !== dirname(dir) && depth < maxDepth) {
    if (existsSync(join(dir, '.git'))) return dir;
    dir = dirname(dir);
    depth++;
  }

  // 3차: 프로젝트 루트 없음
  return null;
}

// --- 설정 디렉토리 보장 (스코프 인식) ---
export function ensureConfigDir(scope = 'global', projectRoot = null) {
  if ((scope === 'project' || scope === 'local') && projectRoot) {
    mkdirSync(join(projectRoot, '.dding-dong'), { recursive: true });
  } else {
    mkdirSync(CONFIG_DIR, { recursive: true });
    mkdirSync(join(CONFIG_DIR, 'packs'), { recursive: true });
  }
}

/**
 * 재귀적 깊은 병합 (null = 해당 키 비활성화/제거)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      delete result[key];
    } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 설정 로드 (5단계 병합: Default <- Global <- Project <- Project Local <- 환경변수)
 * @param {string} [cwd] - 프로젝트 설정 탐색 시작 디렉토리. 미전달 시 Global만 사용 (하위 호환)
 */
export function loadConfig(cwd) {
  // Stage 1: Default
  let config = structuredClone(DEFAULT_CONFIG);

  // Stage 2: Global config
  try {
    const globalConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    config = deepMerge(config, globalConfig);
  } catch {}

  // Stage 3 & 4: Project + Project Local (cwd가 전달된 경우만)
  if (cwd) {
    const projectRoot = findProjectRoot(cwd);
    if (projectRoot) {
      // Stage 3: Project config (팀 공유, 커밋됨)
      try {
        const projectConfigFile = getProjectConfigFile(projectRoot);
        if (existsSync(projectConfigFile)) {
          const projectConfig = JSON.parse(readFileSync(projectConfigFile, 'utf8'));
          config = deepMerge(config, projectConfig);
        }
      } catch {}

      // Stage 4: Project Local config (개인 오버라이드, 커밋 제외)
      try {
        const localConfigFile = getProjectLocalConfigFile(projectRoot);
        if (existsSync(localConfigFile)) {
          const localConfig = JSON.parse(readFileSync(localConfigFile, 'utf8'));
          config = deepMerge(config, localConfig);
        }
      } catch {}
    }
  }

  // Stage 5: 환경변수 오버라이드 (최종 우선)
  if (process.env.DDING_DONG_ENABLED === 'false') config.enabled = false;
  if (process.env.DDING_DONG_VOLUME) config.sound.volume = parseFloat(process.env.DDING_DONG_VOLUME);
  if (process.env.DDING_DONG_LANG) config.language = process.env.DDING_DONG_LANG;

  return config;
}

/**
 * 설정 저장 (스코프 인식)
 * @param {object} config - 저장할 설정 객체 (project/local 스코프에서는 diff-only 오버라이드만 전달)
 * @param {'global'|'project'|'local'} [scope='global']
 * @param {string} [projectRoot] - project/local 스코프일 때 필수
 */
export function saveConfig(config, scope = 'global', projectRoot = null) {
  if (scope === 'local' && projectRoot) {
    ensureConfigDir('local', projectRoot);
    writeFileSync(getProjectLocalConfigFile(projectRoot), JSON.stringify(config, null, 2) + '\n', 'utf8');
  } else if (scope === 'project' && projectRoot) {
    ensureConfigDir('project', projectRoot);
    writeFileSync(getProjectConfigFile(projectRoot), JSON.stringify(config, null, 2) + '\n', 'utf8');
  } else {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }
}

export function getDefaultConfig() { return structuredClone(DEFAULT_CONFIG); }

// --- State 함수 (Global 단일 유지 - 스코프 분리 없음) ---
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
