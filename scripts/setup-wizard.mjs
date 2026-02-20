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
  const { getConfigFile, getPacksDir, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } = await import(resolve(PLUGIN_ROOT, 'scripts/core/config.mjs'));

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

  const result = {
    platform: detected.platform,
    audioPlayer: detected.audioPlayer,
    notifier: detected.notifier,
    nodeVersion: process.version,
    configExists: existsSync(configFile),
    packsInstalled,
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

// 서브커맨드 없으면 도움말 출력
console.log('dding-dong setup-wizard');
console.log('');
console.log('사용법: node setup-wizard.mjs <subcmd> [옵션]');
console.log('');
console.log('서브커맨드:');
console.log('  detect    환경 감지 결과를 JSON으로 출력');
console.log('');
console.log('옵션:');
console.log('  --cwd <path>  프로젝트 루트 탐색 시작 디렉토리');
