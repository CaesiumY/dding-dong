---
name: dd-help
description: "Show dding-dong plugin help. Lists all skills, config options, event types, env vars, and sound packs. 도움말."
allowed-tools: [Bash, Read]
---

# dding-dong 도움말

사용자에게 dding-dong 플러그인의 전체 기능을 한국어로 안내합니다.

## 1단계: 동적 정보 수집

아래 Bash 명령어들을 **모두** 실행하여 런타임 정보를 수집합니다.

### 스킬 목록 조회

```bash
node --input-type=module -e "
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const skillsDir = join('${CLAUDE_PLUGIN_ROOT}', 'skills');
const skills = [];
for (const dir of readdirSync(skillsDir).sort()) {
  try {
    const content = readFileSync(join(skillsDir, dir, 'SKILL.md'), 'utf8');
    const frontmatter = content.split('---')[1];
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const desc = frontmatter.match(/^description:\s*[\"](.+)[\"]$/m)?.[1]?.trim();
    if (name) skills.push({ name, description: desc || '' });
  } catch {}
}
console.log(JSON.stringify(skills, null, 2));
"
```

### DEFAULT_CONFIG 조회

```bash
node --input-type=module -e "
import { getDefaultConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
console.log(JSON.stringify(getDefaultConfig(), null, 2));
"
```

### 설치된 사운드팩 조회

```bash
node --input-type=module -e "
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const pluginRoot = '${CLAUDE_PLUGIN_ROOT}';
const builtinDir = join(pluginRoot, 'sounds');
const userDir = join(homedir(), '.config', 'dding-dong', 'packs');
const packs = [];
for (const [label, dir] of [['built-in', builtinDir], ['user', userDir]]) {
  try {
    for (const name of readdirSync(dir).sort()) {
      const mf = join(dir, name, 'manifest.json');
      if (existsSync(mf)) {
        const m = JSON.parse(readFileSync(mf, 'utf8'));
        packs.push({ name: m.name, displayName: m.displayName || m.name, type: label });
      }
    }
  } catch {}
}
console.log(JSON.stringify(packs, null, 2));
"
```

## 2단계: 결과 출력

수집된 정보를 아래 형식에 맞춰 **한국어 마크다운**으로 출력합니다.
Bash 실행이 실패한 섹션은 "정보를 가져올 수 없습니다. `/dding-dong:dd-doctor`로 진단해주세요."로 대체합니다.

### 출력 형식

```
# dding-dong 도움말

Claude Code 알림 플러그인 — 작업 완료, 오류, 입력 요청 시 사운드와 OS 알림을 보냅니다.

## 사용 가능한 스킬

| 스킬 | 설명 |
|------|------|
| `/dding-dong:<name>` | <한글 설명> |
| ... | ... |

> 각 스킬의 description 필드에서 한글 부분을 추출하여 "설명"으로 사용합니다.
> 한글이 없으면 영문 description을 그대로 표시합니다.

## 이벤트 타입

DEFAULT_CONFIG의 `sound.events` 키에서 이벤트 목록을 추출합니다.

| 이벤트 | 사운드 기본값 | 알림 기본값 | 설명 |
|--------|:---:|:---:|------|
| task.complete | ON/OFF | ON/OFF | 작업 완료 |
| ... | ... | ... | ... |

> task.error는 현재 트리거 훅이 없으며, CLI 테스트 모드에서만 사용 가능합니다.

## 설정 옵션

DEFAULT_CONFIG를 dot notation으로 나열합니다.

| 키 | 기본값 | 설명 |
|----|--------|------|
| `enabled` | true | 플러그인 활성화 |
| `language` | "ko" | 메시지 언어 (ko/en) |
| `sound.enabled` | true | 사운드 활성화 |
| ... | ... | ... |

> 설정 변경: `/dding-dong:dd-config set <key> <value>`

## 설정 파일 경로

나중 단계가 이전 단계를 덮어씁니다 (5단계 병합):

1. **Default** — 하드코딩 기본값
2. **Global** — `~/.config/dding-dong/config.json`
3. **Project** — `.dding-dong/config.json` (팀 공유, 커밋됨)
4. **Project Local** — `.dding-dong/config.local.json` (개인 오버라이드, gitignore)
5. **환경변수** — 아래 참조

## 환경변수

| 변수 | 설명 |
|------|------|
| `DDING_DONG_ENABLED` | `false`로 비활성화 |
| `DDING_DONG_VOLUME` | 볼륨 오버라이드 (0.0~1.0) |
| `DDING_DONG_LANG` | 언어 오버라이드 (ko/en) |
| `DDING_DONG_PACK` | 사운드팩 오버라이드 |

## 설치된 사운드팩

사운드팩 조회 결과를 내장(built-in)과 사용자(user) 구분하여 표시합니다.

| 팩 이름 | 표시 이름 | 구분 |
|---------|----------|------|
| <name> | <displayName> | 내장/사용자 |
| ... | ... | ... |

> 사운드팩 관리: `/dding-dong:dd-sounds`
```
