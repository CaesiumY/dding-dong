---
name: dd-help
description: "Display comprehensive dding-dong plugin help and reference guide. This skill should be used when the user asks \"help\", \"how to use dding-dong\", \"what can I do\", \"show features\", \"list options\", or wants an overview of available skills, config options, and sound packs. 도움말 및 기능 가이드."
allowed-tools: [Bash, Read]
---

# dding-dong 도움말

사용자에게 dding-dong 플러그인의 전체 기능을 한국어로 안내합니다.

## 실행 방법

`$ARGUMENTS`를 파싱하여 범위를 결정합니다:

- **인자 없음** → 전체 도움말 (모든 섹션)
- **`skills`** → 사용 가능한 스킬 목록만
- **`config`** → 설정 옵션과 파일 경로만
- **`events`** → 이벤트 타입만
- **`env`** → 환경변수만
- **`packs`** → 사운드팩만

인자가 위 키워드와 정확히 일치하지 않으면 전체 도움말을 표시합니다.

## 정보 수집

아래 명령어로 런타임 정보를 수집합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-help/scripts/gather-info.mjs" --type all
```

`$ARGUMENTS`가 `skills`, `config`, `packs` 중 하나면 `--type $ARGUMENTS`로 해당 정보만 수집합니다.

실행이 실패하면 "정보를 가져올 수 없습니다. `/dding-dong:dd-doctor`로 진단해주세요."로 대체합니다.

## 출력 포맷팅

수집된 JSON을 아래 섹션별 형식으로 **한국어 마크다운** 출력합니다.
인자가 있으면 해당 섹션만, 없으면 모든 섹션을 순서대로 출력합니다.

### 헤더

```
# dding-dong 도움말

Claude Code 알림 플러그인 — 작업 완료, 오류, 입력 요청 시 사운드와 OS 알림을 보냅니다.
```

### 1. 사용 가능한 스킬 (인자: `skills`)

JSON의 `skills` 배열을 테이블로 출력합니다.
`koDescription`이 있으면 한글 설명을, 없으면 `description` 전체를 표시합니다.

| 스킬 | 설명 |
|------|------|
| `/dding-dong:<name>` | `koDescription` 또는 `description` |

### 2. 이벤트 타입 (인자: `events`)

JSON의 `config.sound.events`와 `config.notification.events`에서 추출합니다.
ON/OFF 대신 체크마크를 사용합니다.

| 이벤트 | 사운드 | 알림 | 설명 |
|--------|:---:|:---:|------|
| `task.complete` | `✓`/`-` | `✓`/`-` | 작업 완료 |
| `task.error` | `✓`/`-` | `✓`/`-` | 오류 발생 (훅 없음, 테스트 전용) |
| `input.required` | `✓`/`-` | `✓`/`-` | 사용자 입력 필요 |
| `session.start` | `✓`/`-` | `✓`/`-` | 세션 시작 |
| `session.end` | `✓`/`-` | `✓`/`-` | 세션 종료 |

> `task.error`는 현재 트리거 훅이 없으며, `/dding-dong:dd-test`에서만 테스트 가능합니다.

### 3. 설정 옵션 (인자: `config`)

JSON의 `config` 객체를 dot notation 테이블로 나열합니다.
`_meta`, `messages` 키는 제외합니다.

| 키 | 기본값 | 설명 |
|----|--------|------|
| `enabled` | `true` | 플러그인 활성화 |
| `language` | `"ko"` | 메시지 언어 (ko/en) |
| `sound.enabled` | `true` | 사운드 활성화 |
| `sound.pack` | `"default"` | 사운드팩 이름 |
| `sound.volume` | `0.7` | 볼륨 (0.0~1.0) |
| `sound.events.*` | | 이벤트별 사운드 ON/OFF |
| `notification.enabled` | `true` | OS 알림 활성화 |
| `notification.events.*` | | 이벤트별 알림 ON/OFF |
| `quiet_hours.enabled` | `false` | 야간 모드 활성화 |
| `quiet_hours.start` | `"22:00"` | 야간 시작 시간 |
| `quiet_hours.end` | `"08:00"` | 야간 종료 시간 |
| `cooldown_seconds` | `3` | 알림 간 최소 간격 (초) |

설정 변경 예시: `/dding-dong:dd-config set sound.volume 0.5`

### 4. 설정 파일 경로 (인자: `config`)

나중 단계가 이전 단계를 덮어씁니다 (5단계 병합):

1. **Default** — 하드코딩 기본값
2. **Global** — `~/.config/dding-dong/config.json`
3. **Project** — `.dding-dong/config.json` (팀 공유, 커밋됨)
4. **Project Local** — `.dding-dong/config.local.json` (개인 오버라이드, gitignore)
5. **환경변수** — 아래 참조

### 5. 환경변수 (인자: `env`)

| 변수 | 설명 |
|------|------|
| `DDING_DONG_ENABLED` | `false`로 비활성화 |
| `DDING_DONG_VOLUME` | 볼륨 오버라이드 (0.0~1.0) |
| `DDING_DONG_LANG` | 언어 오버라이드 (ko/en) |
| `DDING_DONG_PACK` | 사운드팩 오버라이드 |

### 6. 설치된 사운드팩 (인자: `packs`)

JSON의 `packs` 배열을 테이블로 출력합니다. `type`이 `built-in`이면 "내장", `user`이면 "사용자"로 표시합니다.

| 팩 이름 | 표시 이름 | 구분 |
|---------|----------|------|
| `<name>` | `<displayName>` | 내장/사용자 |

사운드팩 관리: `/dding-dong:dd-sounds`

### 7. 관련 스킬 안내

출력 마지막에 다음 교차 참조를 추가합니다:

```
---
**다음 단계**
- 설정 변경 → `/dding-dong:dd-config`
- 사운드팩 변경 → `/dding-dong:dd-sounds`
- 알림 테스트 → `/dding-dong:dd-test`
- 문제 해결 → `/dding-dong:dd-doctor`
- 피드백/버그 신고 → `/dding-dong:dd-feedback`
```
