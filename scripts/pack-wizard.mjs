#!/usr/bin/env node
/**
 * pack-wizard.mjs — 커스텀 사운드 팩 관리 유틸리티
 *
 * Usage:
 *   node pack-wizard.mjs <command> [args...]
 *
 * Commands:
 *   discover                                          설치된 팩 목록
 *   check-exists <packName>                           팩 이름 중복 검사
 *   detect-author                                     작성자 자동 감지
 *   create <name> <displayName> <author> <desc>       빈 팩 생성
 *   clone <sourceDir> <name> <displayName> <author> <desc>  기존 팩 복제
 *   validate-file <filePath>                          WAV 파일 검증
 *   copy-sound <src> <packName> <eventType> <destFile>  사운드 복사 + manifest 업데이트
 *   remove-event <packName> <eventType>               이벤트 제거
 *   validate-manifest <packName>                      매니페스트 스키마 검증
 *   validate <packName>                               팩 전체 검증 (WAV 파일)
 *   apply <packName>                                  팩 적용 (config 변경)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

const PACKS_DIR = join(homedir(), '.config', 'dding-dong', 'packs');
const BUILTIN_DIR = join(PLUGIN_ROOT, 'sounds');
const ALL_EVENTS = ['task.complete', 'task.error', 'input.required', 'session.start', 'session.end'];

const args = process.argv.slice(2);
const cmd = args[0];

function json(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function jsonError(msg) {
  json({ error: msg });
  process.exit(0);
}

// ─── discover ───────────────────────────────────
if (cmd === 'discover') {
  // --cwd 옵션으로 프로젝트 기준 활성 팩 판별
  let cwd = process.cwd();
  const cwdIdx = args.indexOf('--cwd');
  if (cwdIdx !== -1 && args[cwdIdx + 1]) cwd = args[cwdIdx + 1];

  let currentPack = 'default';
  try {
    const { loadConfig } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));
    const config = loadConfig(cwd);
    currentPack = config.sound?.pack || 'default';
  } catch {}

  const packs = [];
  for (const [dir, type] of [[BUILTIN_DIR, 'built-in'], [PACKS_DIR, 'user']]) {
    try {
      for (const name of readdirSync(dir)) {
        const mf = join(dir, name, 'manifest.json');
        if (existsSync(mf)) {
          const m = JSON.parse(readFileSync(mf, 'utf8'));
          packs.push({
            name: m.name,
            displayName: m.displayName,
            type,
            dir: join(dir, name),
            version: m.version ?? null,
            active: m.name === currentPack
          });
        }
      }
    } catch {}
  }
  json(packs);
  process.exit(0);
}

// ─── check-exists ───────────────────────────────
if (cmd === 'check-exists') {
  const name = args[1];
  if (!name) jsonError('팩 이름이 필요합니다.');
  const builtinExists = existsSync(join(BUILTIN_DIR, name, 'manifest.json'));
  const userExists = existsSync(join(PACKS_DIR, name, 'manifest.json'));
  json({ builtinExists, userExists });
  process.exit(0);
}

// ─── detect-author ──────────────────────────────
if (cmd === 'detect-author') {
  let author = userInfo().username;
  try {
    author = execFileSync('git', ['config', 'user.name'], { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim() || author;
  } catch {}
  json({ author });
  process.exit(0);
}

// ─── create ─────────────────────────────────────
if (cmd === 'create') {
  const [, name, displayName, author, description] = args;
  if (!name) jsonError('팩 이름이 필요합니다.');
  const packDir = join(PACKS_DIR, name);
  mkdirSync(packDir, { recursive: true });
  const manifest = {
    name,
    displayName: displayName || name,
    version: '1.0.0',
    author: author || '',
    description: description || '',
    events: {}
  };
  writeFileSync(join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  json({ packDir, manifest });
  process.exit(0);
}

// ─── clone ──────────────────────────────────────
if (cmd === 'clone') {
  const [, sourceDir, name, displayName, author, description] = args;
  if (!sourceDir || !name) jsonError('sourceDir와 name이 필요합니다.');
  if (!existsSync(sourceDir)) jsonError('원본 디렉토리를 찾을 수 없습니다: ' + sourceDir);
  const packDir = join(PACKS_DIR, name);
  mkdirSync(packDir, { recursive: true });
  for (const file of readdirSync(sourceDir)) {
    copyFileSync(join(sourceDir, file), join(packDir, file));
  }
  const manifest = JSON.parse(readFileSync(join(packDir, 'manifest.json'), 'utf8'));
  manifest.name = name;
  manifest.displayName = displayName || name;
  manifest.author = author || '';
  manifest.description = description || '';
  manifest.version = '1.0.0';
  writeFileSync(join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  json({ packDir, manifest, copied: readdirSync(packDir) });
  process.exit(0);
}

// ─── validate-file ──────────────────────────────
if (cmd === 'validate-file') {
  const filePath = args[1];
  if (!filePath) jsonError('파일 경로가 필요합니다.');
  if (!existsSync(filePath)) {
    json({ valid: false, error: '파일을 찾을 수 없습니다: ' + filePath });
    process.exit(0);
  }
  const buf = readFileSync(filePath);
  if (buf.length < 4) {
    json({ valid: false, error: '파일이 너무 작습니다.' });
    process.exit(0);
  }
  const magic = buf.slice(0, 4).toString('ascii');
  if (magic !== 'RIFF') {
    json({ valid: false, error: 'WAV 파일이 아닙니다. (RIFF 헤더 없음)' });
    process.exit(0);
  }
  json({ valid: true, size: buf.length });
  process.exit(0);
}

// ─── copy-sound ─────────────────────────────────
if (cmd === 'copy-sound') {
  const [, srcPath, packName, eventType, destFileName] = args;
  if (!srcPath || !packName || !eventType || !destFileName) jsonError('src, packName, eventType, destFile이 필요합니다.');
  const packDir = join(PACKS_DIR, packName);
  const destPath = join(packDir, destFileName);
  copyFileSync(srcPath, destPath);
  const manifestPath = join(packDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.events[eventType] = { files: [destFileName] };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  json({ copied: destFileName, eventType });
  process.exit(0);
}

// ─── remove-event ───────────────────────────────
if (cmd === 'remove-event') {
  const [, packName, eventType] = args;
  if (!packName || !eventType) jsonError('packName과 eventType이 필요합니다.');
  const packDir = join(PACKS_DIR, packName);
  const manifestPath = join(packDir, 'manifest.json');
  if (!existsSync(manifestPath)) jsonError('manifest.json을 찾을 수 없습니다.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.events[eventType]?.files) {
    for (const f of manifest.events[eventType].files) {
      const fp = join(packDir, f);
      if (existsSync(fp)) unlinkSync(fp);
    }
  }
  delete manifest.events[eventType];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  json({ removed: eventType });
  process.exit(0);
}

// ─── validate-manifest ──────────────────────────
if (cmd === 'validate-manifest') {
  const packName = args[1];
  if (!packName) jsonError('팩 이름이 필요합니다.');
  let packDir = join(PACKS_DIR, packName);
  if (!existsSync(join(packDir, 'manifest.json'))) {
    packDir = join(BUILTIN_DIR, packName);
  }
  const manifestPath = join(packDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    json({ valid: false, errors: ['manifest.json이 없습니다.'] });
    process.exit(0);
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { json({ valid: false, errors: ['manifest.json 파싱 실패'] }); process.exit(0); }

  const errors = [];
  // 필수 필드 존재
  for (const f of ['name', 'displayName', 'version', 'events']) {
    if (manifest[f] === undefined) errors.push(`필수 필드가 없습니다: ${f}`);
  }
  // 타입 검증 (필드가 존재할 때만)
  if (manifest.name !== undefined && typeof manifest.name !== 'string')
    errors.push('name의 타입이 올바르지 않습니다');
  if (manifest.displayName !== undefined && typeof manifest.displayName !== 'string')
    errors.push('displayName의 타입이 올바르지 않습니다');
  if (manifest.version !== undefined && typeof manifest.version !== 'string')
    errors.push('version의 타입이 올바르지 않습니다');
  if (manifest.events !== undefined && (typeof manifest.events !== 'object' || manifest.events === null || Array.isArray(manifest.events)))
    errors.push('events의 타입이 올바르지 않습니다');
  // name 형식
  if (typeof manifest.name === 'string' && !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(manifest.name))
    errors.push('name 형식이 올바르지 않습니다');
  if (typeof manifest.name === 'string' && (manifest.name.length < 2 || manifest.name.length > 50))
    errors.push('name은 2~50자여야 합니다');
  // version 형식
  if (typeof manifest.version === 'string' && !/^\d+\.\d+\.\d+$/.test(manifest.version))
    errors.push('version은 semver 형식이어야 합니다 (예: 1.0.0)');
  // 이벤트 검증
  if (typeof manifest.events === 'object' && manifest.events !== null && !Array.isArray(manifest.events)) {
    for (const [key, val] of Object.entries(manifest.events)) {
      if (!ALL_EVENTS.includes(key)) errors.push(`알 수 없는 이벤트: ${key}`);
      if (!val || !Array.isArray(val.files) || !val.files.every(f => typeof f === 'string'))
        errors.push(`이벤트 '${key}'의 files가 올바르지 않습니다`);
    }
  }
  json({ valid: errors.length === 0, errors, packDir });
  process.exit(0);
}

// ─── validate ───────────────────────────────────
if (cmd === 'validate') {
  const packName = args[1];
  if (!packName) jsonError('팩 이름이 필요합니다.');
  // 사용자 팩 → 내장 팩 순서로 탐색
  let packDir = join(PACKS_DIR, packName);
  if (!existsSync(join(packDir, 'manifest.json'))) {
    packDir = join(BUILTIN_DIR, packName);
  }
  const manifestPath = join(packDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    json({ valid: false, error: 'manifest.json이 없습니다.' });
    process.exit(0);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const results = [];
  for (const evt of ALL_EVENTS) {
    const entry = manifest.events[evt];
    if (!entry) {
      results.push({ event: evt, file: null, status: 'skipped' });
      continue;
    }
    const fileName = entry.files?.[0];
    if (!fileName) {
      results.push({ event: evt, file: null, status: 'skipped' });
      continue;
    }
    const filePath = join(packDir, fileName);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      const magic = buf.length >= 4 ? buf.slice(0, 4).toString('ascii') : '';
      results.push({ event: evt, file: fileName, status: magic === 'RIFF' ? 'ok' : 'invalid_format' });
    } else {
      results.push({ event: evt, file: fileName, status: 'missing' });
    }
  }
  const registered = results.filter(r => r.status === 'ok').length;
  json({ manifest, results, registered, total: ALL_EVENTS.length, packDir });
  process.exit(0);
}

// ─── apply ──────────────────────────────────────
if (cmd === 'apply') {
  const packName = args[1];
  if (!packName) jsonError('팩 이름이 필요합니다.');
  // 팩 존재 확인
  const found = [join(PACKS_DIR, packName), join(BUILTIN_DIR, packName)]
    .some(d => existsSync(join(d, 'manifest.json')));
  if (!found) jsonError('팩을 찾을 수 없습니다: ' + packName);
  // raw 글로벌 config만 수정 (병합된 config를 저장하면 기본값까지 평탄화됨)
  const { getConfigFile, ensureConfigDir, saveConfig } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));
  ensureConfigDir();
  const configFile = getConfigFile();
  let globalConfig = {};
  try { globalConfig = JSON.parse(readFileSync(configFile, 'utf8')); } catch {}
  const meta = globalConfig._meta;
  delete globalConfig._meta;
  if (!globalConfig.sound) globalConfig.sound = {};
  globalConfig.sound.pack = packName;
  if (meta) globalConfig._meta = meta;
  saveConfig(globalConfig, 'global');
  json({ applied: true, pack: packName });
  process.exit(0);
}

// ─── 도움말 ─────────────────────────────────────
console.log('dding-dong pack-wizard');
console.log('');
console.log('사용법: node pack-wizard.mjs <command> [args...]');
console.log('');
console.log('커맨드:');
console.log('  discover                                          설치된 팩 목록');
console.log('  check-exists <packName>                           팩 이름 중복 검사');
console.log('  detect-author                                     작성자 자동 감지');
console.log('  create <name> <displayName> <author> <desc>       빈 팩 생성');
console.log('  clone <sourceDir> <name> <displayName> <author> <desc>');
console.log('                                                    기존 팩 복제');
console.log('  validate-file <filePath>                          WAV 파일 검증');
console.log('  copy-sound <src> <packName> <eventType> <destFile>');
console.log('                                                    사운드 복사 + manifest 업데이트');
console.log('  remove-event <packName> <eventType>               이벤트 제거');
console.log('  validate-manifest <packName>                      매니페스트 스키마 검증');
console.log('  validate <packName>                               팩 전체 검증 (WAV 파일)');
console.log('  apply <packName>                                  팩 적용 (config 변경)');
