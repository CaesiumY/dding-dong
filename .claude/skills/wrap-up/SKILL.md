---
name: wrap-up
description: 세션 마무리 — 소스코드 기반 문서(README.md, CLAUDE.md) 자동 동기화
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep, Task]
---

# dding-dong 세션 마무리

소스코드를 진실의 원천(source of truth)으로 삼아 README.md와 CLAUDE.md를 자동 동기화합니다.

## 사용 시점

- 소스코드를 변경한 후 문서를 동기화할 때
- 코딩 세션을 마무리할 때
- 새 커맨드/이벤트/설정을 추가한 후

## 사용하지 말 것

- 소스코드 변경 없이 문서만 직접 편집할 때
- 새 기능 설계/구현 도중 (구현 완료 후 실행)

## 인수 처리

`$ARGUMENTS`를 파싱하여 동작을 결정합니다:

| 인수 | 동작 |
|------|------|
| (없음) | README.md + CLAUDE.md 모두 동기화 |
| `--readme-only` | README.md만 동기화 |
| `--claude-only` | CLAUDE.md만 동기화 |

---

## 워크플로우

3단계 Task 기반 서브에이전트 워크플로우를 실행합니다. 진행 상황을 한국어로 안내합니다.

### Stage 1: 소스코드 분석 (Explorer)

"소스코드를 분석하고 있습니다..." 를 출력하고 Task를 스폰합니다.

아래 프롬프트로 **하나의 Task**(explorer)를 실행합니다:

```
Task(prompt=<아래 프롬프트>, description="dding-dong 소스코드 분석")
```

**Explorer 프롬프트:**

```
dding-dong 프로젝트의 소스코드를 분석하여 문서 동기화에 필요한 데이터를 추출합니다.
프로젝트 루트: (현재 작업 디렉토리)

아래 소스 파일들을 Read로 읽고, 각 항목별로 구조화된 분석 결과를 반환하세요.

## 분석 대상

| 소스 파일 | 추출 대상 |
|-----------|-----------|
| scripts/core/config.mjs | DEFAULT_CONFIG 객체 전체, 환경변수 오버라이드 목록(DDING_DONG_*), 설정 경로 상수(CONFIG_DIR, CONFIG_FILE, STATE_FILE), 스코프 병합 순서 |
| scripts/core/platform.mjs | detectPlatform() 반환값 목록, detectAudioPlayer() 플랫폼별 우선순위, detectNotifier() 플랫폼별 우선순위 |
| scripts/core/player.mjs | resolveSound() 팩 탐색 경로 순서(사용자 팩 -> 내장 팩), 플랫폼별 재생 명령어와 인수, rotation 모드별 동작(random vs sequential), _linuxArgs() 플레이어별 인수 |
| scripts/core/notifier.mjs | 플랫폼별 알림 전송 분기(macOS/Linux/WSL), WSL 폴백 체인(wsl-notify-send -> WinRT PowerShell -> terminal bell) |
| scripts/core/messages.mjs | 지원 언어 목록, 이벤트별 메시지 키-값 |
| hooks/hooks.json | 등록된 훅 이벤트 타입과 timeout 값, 각 훅의 command 경로 |
| hooks/*.mjs | 훅 파일 목록, 각 훅이 매핑하는 이벤트 타입, _common.mjs의 runHook() 동작 흐름 |
| sounds/default/manifest.json | manifest 스키마(필수/선택 필드), 이벤트별 파일 매핑, rotation 모드 |
| commands/*.md | 모든 커맨드 이름과 description (frontmatter에서 추출) |

## 출력 형식

아래 섹션별로 정리하여 반환하세요. 각 섹션은 마크다운 헤딩으로 구분합니다.

### 1. 설정 (Config)
- DEFAULT_CONFIG 객체 (JSON 그대로)
- 환경변수 오버라이드 테이블 (변수명 | 설명)
- 설정 파일 경로 테이블 (파일 | 경로)
- 스코프 병합 순서: Default <- Global <- Project <- Project Local <- ENV

### 2. 크로스 플랫폼
- 플랫폼별 사운드 재생 테이블 (플랫폼 | 도구 | 비고)
- 플랫폼별 알림 전송 테이블 (플랫폼 | 도구 | 폴백)
- Linux 오디오 플레이어 우선순위 체인

### 3. 사운드 팩
- manifest.json 필드 테이블 (필드 | 필수 | 설명)
- 팩 탐색 순서 (사용자 팩 경로 -> 내장 팩 경로)
- rotation 모드 테이블 (모드 | 동작)

### 4. 이벤트 & 훅
- 이벤트 타입 목록
- 훅 파일 -> 이벤트 매핑 테이블
- hooks.json 구조 요약

### 5. 메시지
- 지원 언어
- 이벤트별 메시지 테이블 (이벤트 | 한국어 | 영어)

### 6. 커맨드
- 커맨드 목록 테이블 (커맨드 | description)

### 7. Data Flow
- notify.mjs의 전체 흐름: Hook event -> hooks/*.mjs -> _common.mjs runHook() -> notify() -> loadConfig() -> isQuietHours() -> isCoolingDown() -> playSound() + sendNotification() -> saveState()
- _common.mjs의 stdin 파싱 -> notify() 호출 -> optional stdout 응답 흐름

### 8. 디렉토리 구조
- Glob으로 프로젝트 전체 파일 트리를 확인하고, 주요 디렉토리/파일 목록을 트리 형태로 출력
- .claude-plugin/, commands/, hooks/, scripts/, sounds/ 각 디렉토리의 역할 한 줄 설명

### 9. Critical Design Rules
- hooks/*.mjs에서 발견되는 패턴: stop hook MUST respond, exit(0) on error, detached+unref
- ESM only (.mjs), No npm dependencies, env var overrides, sound pack resolution order
```

Explorer Task의 반환 결과를 변수로 저장합니다. 이 결과가 Stage 2의 각 writer에게 전달됩니다.

---

### Stage 2: 문서 업데이트 (Writers)

`$ARGUMENTS`에 따라 writer Task를 스폰합니다:
- 인수 없음: readme-writer + claude-md-writer **병렬** 스폰
- `--readme-only`: readme-writer만 스폰
- `--claude-only`: claude-md-writer만 스폰

"문서를 업데이트하고 있습니다..." 를 출력합니다.

**중요: 에러 처리** -- 두 writer를 병렬 스폰할 때, 하나가 실패해도 다른 하나는 계속 완료시킵니다. 실패한 writer만 에러로 보고합니다.

#### README Writer Task

```
Task(prompt=<아래 프롬프트>, description="README.md 동기화")
```

**README Writer 프롬프트:**

```
dding-dong 프로젝트의 README.md를 소스코드 분석 결과에 맞춰 동기화합니다.

대상 파일: README.md

## 소스코드 분석 결과

<explorer-result>
{Stage 1에서 받은 explorer 결과 전체를 여기에 삽입}
</explorer-result>

## 동기화 대상 섹션 매핑

아래 섹션만 업데이트합니다. 나열되지 않은 섹션(소개, 설치, 빠른 시작, 기여 방법, 라이선스 등)은 절대 수정하지 마세요.

| README 섹션 (헤딩 기준) | 소스 출처 | 동기화 내용 |
|------------------------|-----------|------------|
| 커맨드 목록 테이블 | explorer 결과 > 6. 커맨드 | 커맨드명과 description이 소스와 일치하도록 테이블 행 추가/수정/삭제 |
| 설정 JSON 예시 + 설정 옵션 테이블 | explorer 결과 > 1. 설정 | DEFAULT_CONFIG와 일치하는 JSON 예시, 옵션 테이블 행이 소스와 일치 |
| 환경변수 테이블 | explorer 결과 > 1. 설정 | 환경변수 목록이 소스와 일치 |
| 크로스 플랫폼 지원 (macOS/Linux/WSL) | explorer 결과 > 2. 크로스 플랫폼 | 플랫폼별 도구/우선순위가 소스와 일치 |
| manifest.json 구조 예시 + 필드 테이블 | explorer 결과 > 3. 사운드 팩 | manifest 예시와 필드 테이블이 소스와 일치 |
| rotation 모드 테이블 | explorer 결과 > 3. 사운드 팩 | rotation 모드별 동작이 소스와 일치 |

## 규칙

1. 먼저 README.md를 Read로 전체 읽기
2. 각 동기화 대상 섹션을 찾아 소스 분석 결과와 비교
3. 차이가 있는 섹션만 Edit으로 업데이트
4. 변경 없는 섹션은 건드리지 않기
5. 기존 README의 톤, 스타일, 이모지 사용 패턴을 유지
6. 한국어 문서 -- 한국어로 작성
7. 업데이트한 섹션 목록을 반환 (변경 없으면 "변경 없음" 반환)
```

#### CLAUDE.md Writer Task

```
Task(prompt=<아래 프롬프트>, description="CLAUDE.md 동기화")
```

**CLAUDE.md Writer 프롬프트:**

```
dding-dong 프로젝트의 CLAUDE.md를 소스코드 분석 결과에 맞춰 동기화합니다.

대상 파일: CLAUDE.md

## 소스코드 분석 결과

<explorer-result>
{Stage 1에서 받은 explorer 결과 전체를 여기에 삽입}
</explorer-result>

## 동기화 대상 섹션 매핑

아래 섹션만 업데이트합니다. 나열되지 않은 섹션(제목, Development Commands 등)은 절대 수정하지 마세요.

| CLAUDE.md 섹션 (헤딩 기준) | 소스 출처 | 동기화 내용 |
|---------------------------|-----------|------------|
| Directory Structure | explorer 결과 > 8. 디렉토리 구조 | 실제 파일 트리와 일치하도록 코드블록 업데이트 |
| Data Flow | explorer 결과 > 7. Data Flow | notify.mjs 흐름이 소스와 일치 |
| Config & State Files | explorer 결과 > 1. 설정 | 경로 상수가 소스와 일치 |
| Cross-Platform Strategy 테이블 | explorer 결과 > 2. 크로스 플랫폼 | 플랫폼별 도구가 소스와 일치 |
| Event Types | explorer 결과 > 4. 이벤트 & 훅 | 이벤트 타입 목록이 소스와 일치 |
| Critical Design Rules | explorer 결과 > 9. Critical Design Rules | 규칙 목록이 소스 패턴과 일치 |

## 규칙

1. 먼저 CLAUDE.md를 Read로 전체 읽기
2. 각 동기화 대상 섹션을 찾아 소스 분석 결과와 비교
3. 차이가 있는 섹션만 Edit으로 업데이트
4. 변경 없는 섹션은 건드리지 않기
5. CLAUDE.md는 영어로 작성됨 -- 영어 톤/스타일 유지
6. 코드블록, 테이블 등 기존 포맷 유지
7. 업데이트한 섹션 목록을 반환 (변경 없으면 "변경 없음" 반환)
```

---

### Stage 3: 검증 및 완료 보고

양쪽 writer Task가 모두 완료되면 (또는 해당하는 writer만 완료되면) 아래를 실행합니다.

#### 3-a. 변경 확인

```bash
git diff --stat
```

#### 3-b. 완료 보고

한국어로 변경 요약을 출력합니다:

```
세션 마무리 완료!

변경된 파일:
- README.md: [readme-writer가 반환한 변경 섹션 목록]
- CLAUDE.md: [claude-md-writer가 반환한 변경 섹션 목록]

git diff --stat:
[git diff --stat 출력 결과]
```

#### 3-c. git commit 제안

변경 사항이 있으면 커밋 메시지를 제안합니다:

```
커밋을 생성하시겠습니까?

제안 커밋 메시지:
  docs: sync README.md and CLAUDE.md with source code

- "yes" -- 위 메시지로 커밋 생성
- "custom" -- 직접 커밋 메시지 입력
- "no" -- 커밋하지 않음
```

사용자가 "yes"를 선택하면:
```bash
git add README.md CLAUDE.md && git commit -m "docs: sync README.md and CLAUDE.md with source code"
```

"custom"을 선택하면 사용자에게 메시지를 입력받아 커밋합니다.

#### 3-d. 에러 시 보고

writer 중 하나가 실패한 경우:

```
세션 마무리 부분 완료

성공:
- [성공한 파일]: [변경 섹션 목록]

실패:
- [실패한 파일]: [에러 내용]
  수동으로 확인해주세요.
```

---

## 에러 처리 전략

| 실패 지점 | 대응 |
|-----------|------|
| Explorer Task 실패 | 에러 메시지 출력, 수동 동기화 안내, 워크플로우 중단 |
| README Writer 실패 | 해당 파일만 실패 보고, CLAUDE.md writer는 정상 완료 |
| CLAUDE.md Writer 실패 | 해당 파일만 실패 보고, README writer는 정상 완료 |
| 소스 파일 일부 누락 | Explorer가 해당 파일 건너뛰고 나머지 분석 계속, 누락 파일 경고 포함 |
| git diff 실패 | 경고 출력 후 변경 요약만 표시 (치명적이지 않음) |
