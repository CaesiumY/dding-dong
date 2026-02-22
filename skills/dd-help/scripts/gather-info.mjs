#!/usr/bin/env node

/**
 * gather-info.mjs — dd-help 동적 정보 수집 스크립트
 *
 * 스킬 목록, 기본 설정, 사운드팩 정보를 JSON으로 출력합니다.
 * dd-help 스킬에서 호출되며, dd-doctor 등 다른 스킬에서도 재사용 가능합니다.
 *
 * Usage:
 *   node gather-info.mjs [--type all|skills|config|packs]
 *
 * --type 미지정 시 기본값은 "all"
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 플러그인 루트: scripts/ 의 부모(dd-help/) 의 부모(skills/) 의 부모
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');

// --type 인자 파싱
const typeIdx = process.argv.indexOf('--type');
const requestedType = typeIdx !== -1 ? process.argv[typeIdx + 1] : 'all';

// --- 스킬 목록 수집 ---
function gatherSkills() {
  const skillsDir = join(PLUGIN_ROOT, 'skills');
  const skills = [];
  try {
    for (const dir of readdirSync(skillsDir).sort()) {
      try {
        const content = readFileSync(join(skillsDir, dir, 'SKILL.md'), 'utf8');
        const frontmatter = content.split('---')[1];
        if (!frontmatter) continue;

        const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const descMatch = frontmatter.match(/^description:\s*"(.+)"$/m);
        const desc = descMatch?.[1]?.trim() || '';

        // 한글 description 추출: 마지막 ". " 이후 한글 부분 (CLAUDE.md 컨벤션)
        let koDescription = '';
        const koMatch = desc.match(/\.\s+([가-힣][\s\S]*?)\.?$/);
        if (koMatch) {
          koDescription = koMatch[1].replace(/\.$/, '').trim();
        }

        if (name) skills.push({ name, description: desc, koDescription });
      } catch { /* 개별 스킬 읽기 실패 무시 */ }
    }
  } catch { /* skills 디렉토리 없음 */ }
  return skills;
}

// --- 사운드팩 수집 ---
function gatherPacks() {
  const packs = [];
  const builtinDir = join(PLUGIN_ROOT, 'sounds');
  const userDir = join(homedir(), '.config', 'dding-dong', 'packs');

  for (const [label, dir] of [['built-in', builtinDir], ['user', userDir]]) {
    try {
      for (const name of readdirSync(dir).sort()) {
        const mf = join(dir, name, 'manifest.json');
        if (existsSync(mf)) {
          const m = JSON.parse(readFileSync(mf, 'utf8'));
          packs.push({
            name: m.name,
            displayName: m.displayName || m.name,
            description: m.description || '',
            type: label
          });
        }
      }
    } catch { /* 디렉토리 없음 무시 */ }
  }
  return packs;
}

// --- 메인 ---
async function main() {
  const result = {};

  if (requestedType === 'all' || requestedType === 'skills') {
    result.skills = gatherSkills();
  }

  if (requestedType === 'all' || requestedType === 'config') {
    // dynamic import로 config.mjs 로드
    try {
      const configMod = await import(join(PLUGIN_ROOT, 'scripts', 'core', 'config.mjs'));
      result.config = configMod.getDefaultConfig();
    } catch {
      result.config = null;
    }
  }

  if (requestedType === 'all' || requestedType === 'packs') {
    result.packs = gatherPacks();
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('[gather-info] Error:', err.message);
  process.exit(1);
});
