---
name: dd-pack-create
description: "Create custom sound pack with interactive wizard. Generates boilerplate, copies sound files, validates, and applies. 커스텀 사운드 팩 생성 마법사. Use when the user says '팩 만들기', '커스텀 사운드', 'create sound pack', 'custom pack', '사운드 팩 생성'."
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# 커스텀 사운드 팩 생성 마법사

사용자의 WAV 파일로 커스텀 사운드 팩을 생성합니다.

> **설계 노트**: `disable-model-invocation`은 의도적으로 생략되었습니다.
> 이 스킬은 사용자가 입력하는 파일 경로의 해석과 검증,
> manifest.json의 동적 구성에 모델 추론이 필수적입니다.

## 사운드 팩 구조 참고

매니페스트 스키마, 디렉토리 구조, WAV 사양 상세는 [`references/manifest-spec.md`](references/manifest-spec.md) 참조.

**핵심 규칙:**
- 이벤트 엔트리는 반드시 `{ "files": ["filename.wav"] }` 형식
- 미등록 이벤트는 `events`에서 키를 생략 (null 아님)
- WAV 권장: 16-bit PCM, 44100Hz, mono, 1~3초

## 플래그 파싱

`$ARGUMENTS`에서 플래그를 확인합니다:

- `--help`: 아래 사용법을 출력하고 종료합니다.
  ```
  커스텀 사운드 팩 생성 마법사

  사용법: /dding-dong:dd-pack-create [옵션]

  옵션:
    --from <팩이름>  기존 팩을 복제하여 새 팩 생성
    --help           이 도움말 표시

  예시:
    /dding-dong:dd-pack-create
    /dding-dong:dd-pack-create --from retro
  ```

- `--from <팩이름>`: 복제 모드로 바로 진입합니다 (1단계 건너뜀). 지정된 팩이름을 복제 원본으로 사용합니다.

## 실행 순서

### 1단계: 모드 선택

`--from` 플래그가 있으면 이 단계를 건너뛰고, 해당 팩을 복제 원본으로 하여 2단계로 진행합니다.

AskUserQuestion으로 질문합니다:

"커스텀 사운드 팩을 어떻게 만드시겠습니까?"

선택지:
1. **새로 만들기 (Recommended)** -- "빈 팩 구조를 생성하고 WAV 파일을 하나씩 등록합니다."
2. **기존 팩 복제** -- "설치된 팩을 복제한 뒤 원하는 파일만 교체합니다."

**"기존 팩 복제"를 선택한 경우:**

설치된 팩 목록을 조회합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" discover
```

조회된 팩 목록을 사용자에게 표시하고 AskUserQuestion으로 어떤 팩을 복제할지 선택하게 합니다.
각 팩을 선택지로 표시합니다 (예: "기본 효과음 (default)", "레트로 게임 (retro)").

선택된 팩의 이름과 경로를 기억하여 2단계에서 사용합니다.

### 2단계: 팩 정보 수집 + 보일러플레이트 생성

#### 2-a. 팩 이름 입력

AskUserQuestion으로 질문합니다:

"새 사운드 팩의 이름을 입력해주세요. (영문 소문자, 숫자, 하이픈만 사용 가능)"

선택지:
1. **my-sounds** -- "예시 이름입니다. 원하는 이름을 직접 입력해주세요."
2. **custom** -- "예시 이름입니다. 원하는 이름을 직접 입력해주세요."

사용자가 선택지를 선택하거나 Other로 직접 입력합니다.

**이름 검증 규칙:**
- 정규식: `/^[a-z][a-z0-9-]*[a-z0-9]$/` (최소 2자, 최대 50자)
- 선행/후행 하이픈 금지
- 숫자로 시작 금지

검증 실패 시 규칙을 안내하고 다시 입력을 요청합니다.

**이름 중복 검사:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" check-exists 'PACK_NAME'
```

`PACK_NAME`을 사용자 입력값으로 대체합니다.

- **내장 팩과 동일 시**: "내장 팩 'PACK_NAME'과 같은 이름입니다. 사용자 팩이 우선 적용되어 내장 팩을 덮어씁니다." 경고를 표시합니다. 계속 진행할지 AskUserQuestion으로 확인합니다.
- **기존 사용자 팩과 동일 시**: "이미 'PACK_NAME' 사용자 팩이 존재합니다." 안내 후, AskUserQuestion으로 덮어쓰기 여부를 확인합니다.
  1. **덮어쓰기** -- "기존 팩을 대체합니다."
  2. **다른 이름 사용** -- "다시 이름을 입력합니다."
  "다른 이름 사용" 선택 시 2-a로 돌아갑니다.

#### 2-b. 표시 이름 입력

AskUserQuestion으로 질문합니다:

"사운드 팩의 표시 이름을 입력해주세요. (한글/영문, 사용자에게 보여지는 이름)"

선택지:
1. **나의 사운드 팩** -- "예시입니다. 원하는 이름을 직접 입력해주세요."
2. **My Custom Pack** -- "예시입니다. 원하는 이름을 직접 입력해주세요."

#### 2-c. 설명 입력

AskUserQuestion으로 질문합니다:

"사운드 팩의 설명을 입력해주세요."

선택지:
1. **나만의 커스텀 알림 효과음** -- "예시입니다. 원하는 설명을 직접 입력해주세요."
2. **건너뛰기** -- "설명 없이 진행합니다."

"건너뛰기" 선택 시 description을 빈 문자열로 설정합니다.

#### 2-d. 자동 설정 필드 감지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" detect-author
```

- `version`: 항상 `"1.0.0"`
- `author`: `git config user.name` → 실패 시 `os.userInfo().username`

#### 2-e. 보일러플레이트 생성

**새로 만들기 모드:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" create 'PACK_NAME' 'DISPLAY_NAME' 'AUTHOR' 'DESCRIPTION'
```

`PACK_NAME`, `DISPLAY_NAME`, `AUTHOR`, `DESCRIPTION`을 수집된 값으로 대체합니다.

**복제 모드:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" clone 'SOURCE_DIR' 'PACK_NAME' 'DISPLAY_NAME' 'AUTHOR' 'DESCRIPTION'
```

`SOURCE_DIR`은 1단계에서 선택한 복제 원본 팩의 디렉토리 경로, 나머지는 수집된 값으로 대체합니다.

생성 결과를 사용자에게 안내합니다:
```
팩 디렉토리가 생성되었습니다: ~/.config/dding-dong/packs/PACK_NAME/
```

### 3단계: 사운드 파일 등록

5개 이벤트 타입에 대해 순서대로 사운드 파일을 등록합니다.

먼저 권장 사양을 안내합니다:
```
WAV 파일 권장 사양:
- 형식: WAV (PCM)
- 샘플레이트: 44100Hz
- 비트 깊이: 16-bit
- 채널: mono
- 길이: 1~3초
```

다음 5개 이벤트를 순서대로 처리합니다:

| 순서 | 이벤트 타입 | 설명 | 기본 파일명 |
|------|------------|------|------------|
| 1 | `task.complete` | 작업 완료 | complete.wav |
| 2 | `task.error` | 오류 발생 | error.wav |
| 3 | `input.required` | 입력 필요 | input-required.wav |
| 4 | `session.start` | 세션 시작 | session-start.wav |
| 5 | `session.end` | 세션 종료 | session-end.wav |

#### 새로 만들기 모드

각 이벤트마다 AskUserQuestion으로 질문합니다:

"[이벤트 설명] (`EVENT_TYPE`) 사운드 파일을 등록하시겠습니까?"

선택지:
1. **파일 경로 입력** -- "WAV 파일의 경로를 입력합니다."
2. **건너뛰기** -- "이 이벤트에 사운드를 할당하지 않습니다."

"파일 경로 입력"을 선택하면 사용자에게 파일 경로를 요청합니다.
사용자가 경로를 제공하면 즉시 검증합니다.

#### 복제 모드

각 이벤트마다 AskUserQuestion으로 질문합니다:

"[이벤트 설명] (`EVENT_TYPE`) — 현재 파일: `CURRENT_FILE`"

선택지:
1. **그대로 유지 (Recommended)** -- "원본 팩의 파일을 유지합니다."
2. **파일 교체** -- "다른 WAV 파일로 교체합니다."
3. **제거** -- "이 이벤트의 사운드를 제거합니다."

"파일 교체"를 선택하면 사용자에게 새 파일 경로를 요청합니다.
원본 팩에 해당 이벤트가 없으면 (키 자체가 없으면) "현재 파일: (없음)"으로 표시하고 선택지에서 "그대로 유지"와 "제거" 대신 "건너뛰기"를 표시합니다.

#### 파일 즉시 검증

사용자가 파일 경로를 제공할 때마다 아래 검증을 실행합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate-file 'FILE_PATH'
```

`FILE_PATH`를 사용자 입력 경로로 대체합니다.

- **검증 성공 시**: 파일을 팩 디렉토리로 복사하고 manifest.json을 업데이트합니다.
- **검증 실패 시**: 에러 메시지를 표시하고 다시 파일 경로 입력을 요청합니다.

#### 파일 복사 + manifest 업데이트

검증 통과 후 즉시 실행합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" copy-sound 'SRC_PATH' 'PACK_NAME' 'EVENT_TYPE' 'DEST_FILENAME'
```

`SRC_PATH`는 사용자 파일 경로, `PACK_NAME`은 팩 이름, `EVENT_TYPE`은 이벤트 타입, `DEST_FILENAME`은 기본 파일명(위 표 참조)으로 대체합니다.

#### 복제 모드에서 이벤트 제거

"제거"를 선택한 경우:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" remove-event 'PACK_NAME' 'EVENT_TYPE'
```

### 4단계: 최종 검증 + 적용

#### 4-a. 매니페스트 검증

모든 이벤트 등록이 완료되면 먼저 매니페스트 구조를 검증합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate-manifest 'PACK_NAME'
```

- `valid: true` 시: 다음 단계(파일 검증)로 진행
- `valid: false` 시: `errors` 배열의 각 항목을 표시하고, 수정이 필요하다고 안내
  (이 시점에서 manifest가 손상되었다면 pack-wizard의 create/clone이 정상 작동하지 않은 것이므로, 직접 manifest.json을 Read하여 문제를 확인)

#### 4-b. 파일 검증

매니페스트 검증을 통과하면 WAV 파일 검증을 실행합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate 'PACK_NAME'
```

결과를 아래 형식으로 사용자에게 표시합니다:

```
커스텀 사운드 팩이 생성되었습니다!

이름: PACK_NAME
표시 이름: DISPLAY_NAME
작성자: AUTHOR
위치: ~/.config/dding-dong/packs/PACK_NAME/

이벤트           파일                상태
─────────────────────────────────────────
task.complete    complete.wav        ✓
task.error       error.wav           ✓
input.required   (없음)              -
session.start    session-start.wav   ✓
session.end      session-end.wav     ✓

등록된 이벤트: 4/5
```

상태 표시:
- `ok` → `✓`
- `skipped` → `-` (파일 열에 "(없음)" 표시)
- `missing` → `✗ 파일 없음`
- `invalid_format` → `✗ WAV 아님`

`missing` 또는 `invalid_format`이 있으면 경고를 표시합니다:
"일부 파일에 문제가 있습니다. 팩이 정상 동작하지 않을 수 있습니다."

#### 4-c. 적용 여부 확인

AskUserQuestion으로 질문합니다:

"이 팩을 지금 바로 적용하시겠습니까?"

선택지:
1. **바로 적용 (Recommended)** -- "현재 설정의 사운드 팩을 변경합니다."
2. **나중에 적용** -- "팩만 생성하고 종료합니다. 나중에 `/dding-dong:dd-sounds use PACK_NAME`으로 적용할 수 있습니다."

**"바로 적용" 선택 시:**

기존 설정을 로드하고 `sound.pack`만 변경하여 저장합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" apply 'PACK_NAME'
```

적용 성공 시: "사운드 팩이 'PACK_NAME'으로 변경되었습니다." 안내

**"나중에 적용" 선택 시:**

```
팩이 생성되었습니다. 아래 명령어로 나중에 적용할 수 있습니다:
  /dding-dong:dd-sounds use PACK_NAME
```

5단계로 진행합니다.

### 5단계: 미리듣기 + 완료 안내

4-b에서 "바로 적용"을 선택한 경우에만 미리듣기를 제안합니다.

AskUserQuestion으로 질문합니다:

"사운드를 미리 들어보시겠습니까?"

선택지:
1. **예 (Recommended)** -- "task.complete 사운드를 재생합니다."
2. **아니오** -- "바로 종료합니다."

**"예" 선택 시:**

```bash
DDING_DONG_PACK='PACK_NAME' node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

`PACK_NAME`을 팩 이름으로 대체합니다.

재생 실패 시: "미리듣기에 실패했습니다. `/dding-dong:dd-test`로 다시 시도해보세요." 안내

**완료 메시지:**

```
사운드 팩 생성이 완료되었습니다!

관련 명령어:
  사운드 팩 관리  → /dding-dong:dd-sounds list
  팩 미리듣기    → /dding-dong:dd-sounds preview PACK_NAME
  팩 변경       → /dding-dong:dd-sounds use PACK_NAME
  설정 확인     → /dding-dong:dd-config show
```
