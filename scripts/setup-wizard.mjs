#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

const args = process.argv.slice(2);
const subcmd = args[0];

// --cwd 옵션 파싱
function parseCwd() {
  const idx = args.indexOf('--cwd');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.cwd();
}

if (subcmd === 'detect') {
  const cwd = parseCwd();
  const { detectAll } = await import(resolve(PLUGIN_ROOT, 'scripts/core/platform.mjs'));
  const { loadConfig, getConfigFile, getPacksDir, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));

  const detected = detectAll();
  const configFile = getConfigFile();
  const packsDir = getPacksDir();

  // 설치된 사운드 팩 목록
  let packsInstalled = [];
  try {
    packsInstalled = readdirSync(packsDir).filter(d =>
      existsSync(resolve(packsDir, d, 'manifest.json'))
    );
  } catch {}

  // 내장 사운드 팩도 포함
  const builtinPacksDir = resolve(PLUGIN_ROOT, 'sounds');
  try {
    const builtins = readdirSync(builtinPacksDir).filter(d =>
      existsSync(resolve(builtinPacksDir, d, 'manifest.json'))
    );
    for (const b of builtins) {
      if (!packsInstalled.includes(b)) packsInstalled.push(b);
    }
  } catch {}

  // 기존 설정 감지 (Global + Project + Project Local)
  const projectRoot = findProjectRoot(cwd);
  const projectConfigFile = projectRoot ? getProjectConfigFile(projectRoot) : null;
  const projectLocalConfigFile = projectRoot ? getProjectLocalConfigFile(projectRoot) : null;

  // 버전 정보 수집
  let pluginVersion = null;
  try {
    const { readFileSync } = await import('node:fs');
    const pluginJson = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    pluginVersion = pluginJson.version ?? null;
  } catch {}

  let setupVersion = null;
  try {
    const config = loadConfig(cwd);
    setupVersion = config._meta?.setupVersion ?? null;
  } catch {}

  const result = {
    platform: detected.platform,
    audioPlayer: detected.audioPlayer,
    notifier: detected.notifier,
    nodeVersion: process.version,
    configExists: existsSync(configFile),
    packsInstalled,
    pluginVersion,
    setupVersion,
    existingConfig: {
      global: { exists: existsSync(configFile), path: configFile },
      project: {
        exists: projectConfigFile ? existsSync(projectConfigFile) : false,
        path: projectConfigFile
      },
      projectLocal: {
        exists: projectLocalConfigFile ? existsSync(projectLocalConfigFile) : false,
        path: projectLocalConfigFile
      }
    },
    projectRoot
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

if (subcmd === 'validate') {
  const cwd = parseCwd();
  const { loadConfig, getConfigFile, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));

  const errors = [];
  const VALID_EVENTS = ['task.complete', 'task.error', 'input.required', 'session.start', 'session.end'];

  // 설정 파일별 JSON 파싱 검증
  const filesToCheck = [
    { label: 'global', path: getConfigFile() },
  ];
  const projectRoot = findProjectRoot(cwd);
  if (projectRoot) {
    filesToCheck.push({ label: 'project', path: getProjectConfigFile(projectRoot) });
    filesToCheck.push({ label: 'local', path: getProjectLocalConfigFile(projectRoot) });
  }

  for (const { label, path } of filesToCheck) {
    if (!existsSync(path)) continue;
    try {
      const { readFileSync } = await import('node:fs');
      JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push({ file: label, path, error: `JSON 파싱 실패: ${e.message}` });
    }
  }

  // 병합된 설정 검증
  let config;
  try {
    config = loadConfig(cwd);
  } catch (e) {
    errors.push({ file: 'merged', error: `설정 로드 실패: ${e.message}` });
    process.stdout.write(JSON.stringify({ valid: false, errors }, null, 2) + '\n');
    process.exit(0);
  }

  // 필수 키 존재 확인
  if (typeof config.enabled !== 'boolean') errors.push({ field: 'enabled', error: '필수 키 누락 또는 타입 오류 (boolean 필요)' });
  if (!config.sound || typeof config.sound !== 'object') errors.push({ field: 'sound', error: '필수 키 누락' });
  if (!config.notification || typeof config.notification !== 'object') errors.push({ field: 'notification', error: '필수 키 누락' });

  // 이벤트 타입 유효성
  if (config.sound?.events) {
    for (const key of Object.keys(config.sound.events)) {
      if (!VALID_EVENTS.includes(key)) errors.push({ field: `sound.events.${key}`, error: `알 수 없는 이벤트 타입` });
    }
  }

  // 사운드 팩 파일 존재 확인
  if (config.sound?.pack) {
    const { getPacksDir } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));
    const userPackDir = resolve(getPacksDir(), config.sound.pack);
    const builtinPackDir = resolve(PLUGIN_ROOT, 'sounds', config.sound.pack);
    const userExists = existsSync(resolve(userPackDir, 'manifest.json'));
    const builtinExists = existsSync(resolve(builtinPackDir, 'manifest.json'));
    if (!userExists && !builtinExists) {
      errors.push({ field: 'sound.pack', error: `사운드 팩 '${config.sound.pack}' 을(를) 찾을 수 없음` });
    }
  }

  // 버전 일관성 검증 (plugin.json ↔ marketplace.json)
  try {
    const { readFileSync } = await import('node:fs');
    const pluginJson = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const marketplaceJson = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const src = pluginJson.version;
    if (marketplaceJson.version !== src) {
      errors.push({ field: 'version', error: `marketplace.json 루트 버전 '${marketplaceJson.version}'이(가) plugin.json '${src}'과(와) 불일치` });
    }
    if (marketplaceJson.plugins?.[0] && marketplaceJson.plugins[0].version !== src) {
      errors.push({ field: 'version', error: `marketplace.json plugins[0].version '${marketplaceJson.plugins[0].version}'이(가) plugin.json '${src}'과(와) 불일치` });
    }
  } catch (e) {
    errors.push({ field: 'version', error: `버전 파일 읽기 실패: ${e.message}` });
  }

  process.stdout.write(JSON.stringify({ valid: errors.length === 0, errors }, null, 2) + '\n');
  process.exit(0);
}

// 서브커맨드 없으면 도움말 출력
console.log('dding-dong setup-wizard');
console.log('');
console.log('사용법: node setup-wizard.mjs <subcmd> [옵션]');
console.log('');
console.log('서브커맨드:');
console.log('  detect    환경 감지 결과를 JSON으로 출력');
console.log('  validate  설정 유효성 검사 결과를 JSON으로 출력');
console.log('');
console.log('옵션:');
console.log('  --cwd <path>  프로젝트 루트 탐색 시작 디렉토리');
