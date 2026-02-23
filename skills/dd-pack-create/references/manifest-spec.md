# 사운드 팩 매니페스트 스펙

이 문서는 dding-dong 사운드 팩의 디렉토리 구조, manifest.json 스키마, WAV 파일 사양을 정의합니다.

## 디렉토리 구조

```
~/.config/dding-dong/packs/<pack-name>/
  manifest.json      # 팩 메타데이터 + 이벤트 매핑
  complete.wav       # task.complete 이벤트
  error.wav          # task.error 이벤트
  input-required.wav # input.required 이벤트
  session-start.wav  # session.start 이벤트
  session-end.wav    # session.end 이벤트
```

내장 팩은 `sounds/<pack-name>/`에 위치하며, 사용자 팩(`~/.config/dding-dong/packs/`)이 동일 이름의 내장 팩보다 우선합니다.

## manifest.json 스키마

### 필수 필드

| 필드 | 타입 | 설명 | 제약 |
|------|------|------|------|
| `name` | string | 팩 ID | 영문 소문자, 숫자, 하이픈. `/^[a-z][a-z0-9-]*[a-z0-9]$/` (2~50자) |
| `displayName` | string | 표시 이름 | 한글/영문 자유 |
| `version` | string | 버전 | semver 형식 (예: `"1.0.0"`) |
| `events` | object | 이벤트 매핑 | 빈 객체 `{}` 허용 |

### 선택 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `author` | string | 작성자 |
| `description` | string | 팩 설명 |

### events 객체

키는 아래 이벤트 타입 중 하나이며, 미등록 이벤트는 키 자체를 **생략**합니다 (`null` 아님).

값 형식:

```json
{
  "files": ["filename.wav"],
  "rotation": "sequential"
}
```

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `files` | string[] | 예 | WAV 파일명 배열 (1개 이상) |
| `rotation` | string | 아니오 | 복수 파일 시 재생 순서. `"sequential"` (기본값) 또는 `"random"` |

### 전체 예시

```json
{
  "name": "my-pack",
  "displayName": "나의 사운드 팩",
  "version": "1.0.0",
  "author": "사용자",
  "description": "커스텀 알림음",
  "events": {
    "task.complete": { "files": ["complete.wav"], "rotation": "sequential" },
    "task.error": { "files": ["error.wav"] },
    "input.required": { "files": ["input-required.wav"] }
  }
}
```

## 이벤트 타입 + 기본 파일명

| 이벤트 타입 | 설명 | 기본 파일명 |
|------------|------|------------|
| `task.complete` | 작업 완료 | complete.wav |
| `task.error` | 오류 발생 | error.wav |
| `input.required` | 입력 필요 | input-required.wav |
| `session.start` | 세션 시작 | session-start.wav |
| `session.end` | 세션 종료 | session-end.wav |

## WAV 권장 사양

| 항목 | 권장값 |
|------|--------|
| 형식 | WAV (PCM) |
| 샘플레이트 | 44100Hz |
| 비트 깊이 | 16-bit |
| 채널 | mono |
| 길이 | 1~3초 |

파일 크기가 크거나 비표준 형식이면 일부 플랫폼에서 재생이 지연되거나 실패할 수 있습니다.

## 유효성 규칙 요약

1. 필수 필드(`name`, `displayName`, `version`, `events`)가 모두 존재해야 합니다.
2. `name`은 `/^[a-z][a-z0-9-]*[a-z0-9]$/` 패턴, 2~50자여야 합니다.
3. `version`은 semver 형식(`X.Y.Z`)이어야 합니다.
4. `events`의 키는 위 5개 이벤트 타입만 허용됩니다.
5. 각 이벤트 값에는 `files` 배열(string[])이 필수입니다.
6. WAV 파일은 RIFF 헤더를 가져야 합니다 (물리 검증은 `validate` 커맨드 담당).
