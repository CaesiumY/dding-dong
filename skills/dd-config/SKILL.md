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

결과를 파싱하여 사용자에게 한국어로 표시합니다:

```
현재 설정 (적용 중인 스코프: [스코프 정보])
- 전역 설정: [경로] ([존재/없음])
- 프로젝트 설정: [경로] ([존재/없음])
- 내 설정 (Local): [경로] ([존재/없음])

[설정 내용을 한국어로 정리하여 보여줍니다]
- 활성화: [예/아니오]
- 활성 이벤트: [이벤트 목록]
- 사운드 볼륨: [값]
- 야간 모드: [비활성/활성 (시간 범위)]
- 쿨다운: [초]
```

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
import { saveConfig, getConfigFile, findProjectRoot, getProjectConfigFile, getProjectLocalConfigFile } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';

const key = process.argv[1];
let value = process.argv[2];
const scope = process.argv[3] || 'global';

if (!key || value === undefined) { console.error('사용법: set <key> <value> [--scope global|project|local]'); process.exit(1); }

// 값 타입 자동 변환
if (value === 'true') value = true;
else if (value === 'false') value = false;
else if (!isNaN(value) && value !== '') value = Number(value);

// 스코프별 설정 파일 경로 결정
const cwd = process.cwd();
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

// dot notation으로 중첩 키 설정
const keys = key.split('.');
let obj = config;
for (let i = 0; i < keys.length - 1; i++) {
  if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
  obj = obj[keys[i]];
}
obj[keys[keys.length - 1]] = value;

// _meta 복원 (글로벌 스코프만)
if (meta && scope === 'global') config._meta = meta;

saveConfig(config, scope, projectRoot);
console.log(JSON.stringify({ success: true, key, value, scope }));
" '${KEY}' '${VALUE}' '${SCOPE}'
```

- 성공 시: "`[key]`를 `[value]`로 설정했습니다. (스코프: [scope])"
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
