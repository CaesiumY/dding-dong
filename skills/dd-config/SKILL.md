---
name: dd-config
description: "View and manage dding-dong notification settings. This skill should be used when the user says \"show settings\", \"change config\", \"set volume\", \"reset config\", \"설정 보기\", \"설정 변경\", \"볼륨 변경\", \"설정 초기화\", or needs to view, modify, or reset notification configuration. 설정 확인, 변경, 초기화."
allowed-tools: [Bash, Read, Write, AskUserQuestion]
disable-model-invocation: true
---

# dding-dong 설정 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### show (기본)

현재 설정을 한국어로 표시합니다. 스코프별 설정 출처도 함께 안내합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-config.mjs" --cwd "$(pwd)"
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
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-config/scripts/config-get.mjs" '${KEY}' --cwd "$(pwd)"
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
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-config/scripts/config-set.mjs" '${KEY}' '${VALUE}' --scope '${SCOPE}' --cwd "$(pwd)"
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

---
**관련 스킬**
- 사운드 팩 관리 → `/dding-dong:dd-sounds`
- 알림 문제 진단 → `/dding-dong:dd-doctor`
- 전체 기능 안내 → `/dding-dong:dd-help`
