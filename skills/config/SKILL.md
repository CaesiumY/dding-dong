---
name: 설정 관리
description: "dding-dong 알림 설정을 확인하고 변경합니다. show(현재 설정 표시), set(값 변경), reset(초기화)을 지원합니다."
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

### reset

설정을 기본값으로 복원합니다.

AskUserQuestion으로 대상 스코프를 확인합니다:
"어떤 설정을 초기화하시겠습니까?"
1. "전역 설정 초기화" -- `~/.config/dding-dong/config.json` 삭제
2. "프로젝트 설정 초기화" -- `.dding-dong/config.json` 삭제 (프로젝트 설정이 존재하는 경우만 표시)
3. "내 설정 초기화" -- `.dding-dong/config.local.json` 삭제 (내 설정이 존재하는 경우만 표시)
4. "취소"

사용자 확인 후 해당 설정 파일을 삭제합니다.
