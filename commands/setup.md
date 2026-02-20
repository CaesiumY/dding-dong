---
description: dding-dong 알림 설정 마법사 (한국어)
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# dding-dong 설정 마법사

사용자의 환경을 확인하고 dding-dong 알림 플러그인을 설정합니다.

## 실행 순서

### 1단계: Pre-Setup Check + 환경 감지

아래 명령어를 실행하여 환경을 감지합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" detect --cwd "$(pwd)"
```

결과 JSON을 파싱하여 사용자에게 한국어로 안내합니다:
- "플랫폼: [macOS/Linux/WSL] 감지됨"
- "사운드 플레이어: [이름] 사용 가능" 또는 "사운드 플레이어를 찾을 수 없습니다"
- "알림 도구: [이름] 사용 가능" 또는 "알림 도구를 찾을 수 없습니다"

**Graceful Degradation:**
- 사운드 플레이어가 없으면: "사운드 재생기를 찾을 수 없습니다. OS 알림만 사용합니다." 안내 후 `sound.enabled: false`로 진행
- 알림 도구가 없으면: "OS 알림 도구를 찾을 수 없습니다. 사운드만 사용합니다." 안내
- 둘 다 없으면: "터미널 벨을 사용합니다." 안내
- 감지 자체가 실패하면 기본값으로 조용히 계속 진행

WSL에서 wsl-notify-send가 없으면:
- "wsl-notify-send 설치를 권장합니다: https://github.com/stuartleeks/wsl-notify-send"

**Pre-Setup Check** (기존 설정 감지):

`existingConfig` 필드를 확인하여:
- 기존 설정이 있으면 (global.exists, project.exists, projectLocal.exists 중 하나라도 true):
  ```
  기존 dding-dong 설정이 발견되었습니다.
  - 전역 설정: ~/.config/dding-dong/config.json [존재/없음]
  - 프로젝트 설정: .dding-dong/config.json [존재/없음]
  - 내 설정: .dding-dong/config.local.json [존재/없음]
  ```
  AskUserQuestion으로 질문:
  - "기존 설정을 어떻게 하시겠습니까?"
    1. "설정 업데이트 (Recommended)" -- 기존 값 유지, 변경할 항목만 수정
    2. "전체 재설정" -- 기본값부터 다시 설정
    3. "취소" -- 설정 마법사 종료

  "취소"를 선택하면 마법사를 종료합니다.
  "설정 업데이트"를 선택하면 기존 설정을 로드한 후 2단계로 진행합니다.
  "전체 재설정"을 선택하면 기본값으로 2단계로 진행합니다.

- 기존 설정이 없으면: 바로 2단계로 진행합니다.

### 2단계: 설치 스코프 선택

AskUserQuestion으로 질문합니다:

"설치 범위를 선택해주세요."

선택지:
1. **전역 설정 (Recommended)** -- "모든 프로젝트에 적용됩니다. 설정 경로: ~/.config/dding-dong/config.json"
2. **프로젝트 설정** -- "팀원과 공유되는 프로젝트 설정입니다. Git에 커밋됩니다. 경로: .dding-dong/config.json"
3. **내 설정 (Local)** -- "이 프로젝트에서 나만 사용하는 개인 설정입니다. Git에 포함되지 않습니다. 경로: .dding-dong/config.local.json"

- 선택 결과를 기억하여 이후 단계에서 사용합니다

### 3단계: 사용자 선호도 확인

AskUserQuestion으로 순차적으로 질문합니다:

**3-a. 이벤트 선택** (multiSelect):
"어떤 이벤트에 알림을 받으시겠습니까?"
- 작업 완료 (task.complete) - 기본 ON
- 오류 발생 (task.error) - 기본 ON
- 입력 필요 (input.required) - 기본 ON
- 세션 시작 (session.start) - 기본 OFF
- 세션 종료 (session.end) - 기본 OFF

**3-b. 볼륨** (사운드 가능한 환경에서만 질문):
"사운드 볼륨을 선택해주세요."
- 0.3 (작게)
- 0.5 (보통)
- 0.7 (기본, Recommended)
- 1.0 (최대)

사운드 플레이어가 감지되지 않은 경우 이 질문을 건너뜁니다.

**3-c. 야간 모드:**
"야간 모드를 사용하시겠습니까?"
- 사용 안 함 (기본, Recommended)
- 사용 (22:00~08:00)

### 4단계: 설정 저장

사용자 응답을 바탕으로 설정 객체를 구성합니다.

**Global 스코프 선택 시:**
- `~/.config/dding-dong/config.json`에 전체 설정을 저장합니다.
- 아래 Bash 코드를 사용합니다:
```bash
node --input-type=module -e "
import { saveConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const config = JSON.parse(process.argv[1]);
saveConfig(config, 'global');
" '${CONFIG_JSON}'
```

**Project 스코프 선택 시:**
- `.dding-dong/config.json`에 **오버라이드 키만** (diff-only) 저장합니다.
- 기본값과 다른 항목만 설정 객체에 포함합니다.
- `config.local.json`을 `.gitignore`에 자동으로 추가합니다 (개인 설정 보호).

```bash
node --input-type=module -e "
import { saveConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const config = JSON.parse(process.argv[1]);
saveConfig(config, 'project', process.argv[2]);
" '${CONFIG_JSON}' '${PROJECT_ROOT}'
```

**Local 스코프 선택 시:**
- `.dding-dong/config.local.json`에 **오버라이드 키만** (diff-only) 저장합니다.
- 기본값과 다른 항목만 설정 객체에 포함합니다.
- `.gitignore`에 `config.local.json` 라인이 없으면 추가합니다.

```bash
node --input-type=module -e "
import { saveConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const config = JSON.parse(process.argv[1]);
saveConfig(config, 'local', process.argv[2]);
" '${CONFIG_JSON}' '${PROJECT_ROOT}'
```

**Project/Local 공통 — .gitignore 처리:**
- 프로젝트 루트의 `.gitignore`에 `config.local.json` 패턴이 없으면 추가합니다.
- AskUserQuestion으로 추가 질문 (Project 스코프에서만):
  ".dding-dong/ 디렉토리 전체를 .gitignore에 추가하시겠습니까?"
  1. "config.local.json만 제외 (Recommended)" -- 팀 공유 config.json은 커밋, 개인 설정만 제외
  2. "디렉토리 전체 제외" -- .dding-dong/ 전체를 Git 추적에서 제외

### 5단계: 테스트 + 완료 요약

테스트 알림을 실행합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

결과를 확인하고 **완료 요약 메시지**를 출력합니다:

**성공 시:**
```
dding-dong 설정 완료!
- 설정 파일: [설정 파일 경로]
- 범위: [전역/프로젝트/내 설정(Local)]
- 활성 이벤트: [활성화된 이벤트 목록]
- 볼륨: [설정된 볼륨]
- 야간 모드: [활성/비활성]
```

**테스트 실패 시:**
```
설정이 저장되었지만 테스트 알림에 실패했습니다.
/dding-dong:config show 로 설정을 확인해주세요.
```
