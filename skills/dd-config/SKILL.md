---
name: dd-config
description: "View and manage dding-dong notification settings. Supports show, set, reset commands. 설정 확인, 변경, 초기화. Use when the user says '설정 보기', 'show settings', '설정 변경', 'change config'."
allowed-tools: [Bash, Read, Write, AskUserQuestion]
disable-model-invocation: true
---

# dding-dong 설정 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### show (기본)

현재 설정을 한국어로 표시합니다. 스코프별 설정 출처도 함께 안내합니다.

```bash
node --input-type=module -e "
import { loadConfig, getConfigFile, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
import { existsSync } from 'node:fs';

const cwd = process.cwd();
const config = loadConfig(cwd);
const globalPath = getConfigFile();
const globalExists = existsSync(globalPath);
const projectRoot = findProjectRoot(cwd);
const projectPath = projectRoot ? getProjectConfigFile(projectRoot) : null;
const projectExists = projectPath ? existsSync(projectPath) : false;
const localPath = projectRoot ? getProjectLocalConfigFile(projectRoot) : null;
const localExists = localPath ? existsSync(localPath) : false;

console.log(JSON.stringify({
  config,
  scope: {
    global: { exists: globalExists, path: globalPath },
    project: { exists: projectExists, path: projectPath },
    local: { exists: localExists, path: localPath }
  }
}, null, 2));
"
```

결과를 파싱하여 사용자에게 한국어로 표시합니다. `_meta`와 `messages` 내부 필드는 표시에서 제외합니다:

```
현재 설정 (적용 중인 스코프: [스코프 정보])
- 전역 설정: [경로] ([존재/없음])
- 프로젝트 설정: [경로] ([존재/없음])
- 내 설정 (Local): [경로] ([존재/없음])

| 설정 | 값 |
|------|-----|
| 활성화 | config.enabled (예/아니오) |
| 언어 | config.language |
| 사운드 | config.sound.enabled (켜짐/꺼짐) |
| 사운드 팩 | config.sound.pack |
| 볼륨 | config.sound.volume |
| OS 알림 | config.notification.enabled (켜짐/꺼짐) |
| 야간 모드 | config.quiet_hours.enabled (꺼짐 / 켜짐 HH:MM~HH:MM) |
| 쿨다운 | config.cooldown_seconds초 |

이벤트 설정:
| 이벤트 | 사운드 | 알림 |
|--------|:------:|:----:|
| task.complete | ✓/- | ✓/- |
| task.error | ✓/- | ✓/- |
| input.required | ✓/- | ✓/- |
| session.start | ✓/- | ✓/- |
| session.end | ✓/- | ✓/- |

각 이벤트의 ✓/- 는 config.sound.events와 config.notification.events에서 해당 이벤트 키의 true/false를 확인합니다.
```

### get [key]

단일 설정 키의 현재 값을 조회합니다. dot notation 지원 (예: `sound.volume`, `quiet_hours.enabled`, `notification.events.task.complete`).

`$ARGUMENTS`에서 key를 추출하여 `${KEY}`로 치환합니다.

```bash
node --input-type=module -e "
import { loadConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const config = loadConfig(process.cwd());
const key = process.argv[1];
if (!key) { console.error(JSON.stringify({ error: 'no_key' })); process.exit(1); }
const parts = key.split('.');
let cur = config, i = 0;
while (i < parts.length) {
  if (cur == null || typeof cur !== 'object') { cur = undefined; break; }
  if (parts[i] in cur) { cur = cur[parts[i]]; i++; }
  else {
    let ok = false;
    for (let j = i + 2; j <= parts.length; j++) {
      const c = parts.slice(i, j).join('.');
      if (c in cur) { cur = cur[c]; i = j; ok = true; break; }
    }
    if (!ok) { cur = undefined; break; }
  }
}
if (cur === undefined) { console.error(JSON.stringify({ error: 'not_found', key })); process.exit(1); }
console.log(JSON.stringify({ key, value: cur }));
" '${KEY}'
```

- 성공 시: "`[key]` = `[value]`"
- 키 없음 시: "설정 키를 찾을 수 없습니다: `[key]`"

### set [key] [value]

중첩 키를 dot notation으로 지원합니다 (예: `sound.volume 0.5`, `notification.events.session.start true`).

`--scope` 옵션으로 대상 스코프를 지정할 수 있습니다:
- `--scope global` -- 전역 설정에 반영 (기본값)
- `--scope project` -- 프로젝트 설정에 반영 (팀 공유, 커밋됨)
- `--scope local` -- 내 설정에 반영 (개인 오버라이드, 커밋 제외)

프로젝트/로컬 스코프 지정 시 해당 파일에 **오버라이드 키만** (diff-only) 저장합니다.

`$ARGUMENTS`에서 key, value, `--scope` 플래그를 추출하여 `${KEY}`, `${VALUE}`, `${SCOPE}`로 치환합니다.
`${SCOPE}`가 없으면 `global`을 기본값으로 사용합니다.

```bash
node --input-type=module -e "
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig, getDefaultConfig, saveConfig, getConfigFile, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';

const key = process.argv[1];
let value = process.argv[2];
const scope = process.argv[3] || 'global';

if (!key || value === undefined) { console.error('사용법: set <key> <value> [--scope global|project|local]'); process.exit(1); }

// dot notation 경로를 실제 객체 구조에 맞게 해석 (dotted key names 지원)
function resolvePath(obj, path) {
  const parts = path.split('.');
  const segs = [];
  let cur = obj, i = 0;
  while (i < parts.length) {
    if (cur == null || typeof cur !== 'object') return null;
    if (parts[i] in cur) { segs.push(parts[i]); cur = cur[parts[i]]; i++; }
    else {
      let ok = false;
      for (let j = i + 2; j <= parts.length; j++) {
        const c = parts.slice(i, j).join('.');
        if (c in cur) { segs.push(c); cur = cur[c]; i = j; ok = true; break; }
      }
      if (!ok) return null;
    }
  }
  return { value: cur, segments: segs };
}

// 유효 키 목록 수집 (에러 메시지용)
function collectKeys(obj, prefix) {
  let r = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const f = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) r.push(...collectKeys(v, f));
    else r.push(f);
  }
  return r;
}

// 유효 키 검증 (DEFAULT_CONFIG 기반)
const defaults = getDefaultConfig();
const resolved = resolvePath(defaults, key);
if (!resolved) {
  const validKeys = collectKeys(defaults, '');
  console.error(JSON.stringify({ error: 'invalid_key', key, validKeys }));
  process.exit(1);
}
if (resolved.value && typeof resolved.value === 'object' && !Array.isArray(resolved.value)) {
  console.error(JSON.stringify({ error: 'object_key', key }));
  process.exit(1);
}

// 값 타입 자동 변환
if (value === 'true') value = true;
else if (value === 'false') value = false;
else if (!isNaN(value) && value !== '') value = Number(value);

// 변경 전 값 조회 (병합된 config 기준)
const cwd = process.cwd();
const merged = loadConfig(cwd);
const oldRes = resolvePath(merged, key);
const oldValue = oldRes ? oldRes.value : null;

// 스코프별 설정 파일 경로 결정
const projectRoot = findProjectRoot(cwd);
let configFile;
if (scope === 'project' || scope === 'local') {
  if (!projectRoot) { console.error('프로젝트 루트를 찾을 수 없습니다.'); process.exit(1); }
  configFile = scope === 'project' ? getProjectConfigFile(projectRoot) : getProjectLocalConfigFile(projectRoot);
} else {
  configFile = getConfigFile();
}

// 기존 설정 파일 로드
let config = {};
try { config = JSON.parse(readFileSync(configFile, 'utf8')); } catch {}
const meta = config._meta; delete config._meta;

// resolved segments로 중첩 키 설정 (dotted key names 안전 처리)
const segs = resolved.segments;
let obj = config;
for (let i = 0; i < segs.length - 1; i++) {
  if (!obj[segs[i]] || typeof obj[segs[i]] !== 'object') obj[segs[i]] = {};
  obj = obj[segs[i]];
}
obj[segs[segs.length - 1]] = value;

// _meta 복원 (글로벌 스코프만)
if (meta && scope === 'global') config._meta = meta;

saveConfig(config, scope, projectRoot);
console.log(JSON.stringify({ success: true, key, oldValue: oldValue !== undefined ? oldValue : null, newValue: value, scope }));
" '${KEY}' '${VALUE}' '${SCOPE}'
```

- 성공 시: "`[key]`를 `[oldValue]` → `[newValue]`로 변경했습니다. (스코프: [scope])"
- 이전 값과 동일 시: "`[key]`는 이미 `[newValue]`입니다."
- 유효하지 않은 키 (invalid_key 에러): "알 수 없는 설정 키: `[key]`. 사용 가능한 키: [validKeys 목록]"
- 그룹 키 (object_key 에러): "`[key]`는 개별 설정이 아닌 그룹입니다. 하위 키를 지정하세요 (예: `[key].enabled`)."
- 프로젝트 루트 없음 (exit 1): "프로젝트 루트를 찾을 수 없습니다. `--scope global`을 사용하거나 프로젝트 디렉토리에서 실행하세요."

### reset

설정을 기본값으로 복원합니다.

AskUserQuestion으로 대상 스코프를 확인합니다:
"어떤 설정을 초기화하시겠습니까?"
1. "전역 설정 초기화" -- `~/.config/dding-dong/config.json` 삭제
2. "프로젝트 설정 초기화" -- `.dding-dong/config.json` 삭제 (프로젝트 설정이 존재하는 경우만 표시)
3. "내 설정 초기화" -- `.dding-dong/config.local.json` 삭제 (내 설정이 존재하는 경우만 표시)
4. "취소"

사용자 확인 후, **삭제 전에 백업을 생성**합니다:

```bash
node --input-type=module -e "
import { backupConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const filePath = process.argv[1];
const result = backupConfig(filePath);
if (result) console.log('백업 생성:', result);
else console.log('백업 대상 파일 없음');
" '${TARGET_FILE_PATH}'
```

백업 생성 후 해당 설정 파일을 삭제합니다. 백업 실패 시에도 삭제는 진행합니다.
