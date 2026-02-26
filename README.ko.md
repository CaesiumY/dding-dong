# dding-dong 띵동 🔔

[English](README.md) | **한국어**

[![GitHub stars](https://img.shields.io/github/stars/CaesiumY/dding-dong?style=flat&color=yellow)](https://github.com/CaesiumY/dding-dong/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **[웹사이트 방문하기](https://caesiumy.github.io/dding-dong/ko/)** — 사운드 팩을 미리 듣고 기능을 살펴보세요.

> Claude Code 알림 플러그인 — 작업 완료·오류·입력 필요 시 소리와 OS 알림으로 알려줍니다. AI 음성 합성으로 나만의 알림음도 만들 수 있습니다.

**띵동(dding-dong)** 은 한국어로 초인종 소리를 나타냅니다. Claude Code가 작업을 마쳤을 때, 당신의 주의가 필요할 때 알려드립니다.

## 특징

- 작업 완료, 오류 발생, 입력 필요 시 즉시 알림
- macOS, Linux, WSL(Windows) 크로스 플랫폼 지원
- 사운드 팩 시스템으로 알림음 커스터마이즈
- **AI 음성 합성** — Qwen3-TTS로 나만의 목소리 알림 생성 (보이스 클로닝 & 감정 제어)
- 한국어/영어 메시지 지원
- 야간 모드, 쿨다운, 환경변수 제어

## 요구사항

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 빠른 시작

### Step 1. 설치

Claude Code에서 아래 명령어를 실행합니다:

```
/plugin marketplace add https://github.com/CaesiumY/dding-dong
/plugin install dding-dong
```

### Step 2. 환경 설정

```
/dding-dong:dd-setup
```

플랫폼을 자동 감지하고 오디오 플레이어와 알림 도구를 확인합니다.

### Step 3. 테스트

```
/dding-dong:dd-test
```

모든 이벤트 타입의 알림을 순서대로 테스트합니다. 소리가 들리면 설정 완료!

<details>
<summary>다른 설치 방법 / 업데이트</summary>

#### 직접 설치

```bash
claude plugin add https://github.com/CaesiumY/dding-dong
```

#### 로컬 설치 (개발/테스트)

```bash
git clone https://github.com/CaesiumY/dding-dong
cd dding-dong
claude plugin add .
```

#### 업데이트

```
/plugin marketplace update dding-dong
```

</details>

## 스킬 목록

### 기본 스킬

| 스킬                          | 설명                    |
| ----------------------------- | ----------------------- |
| `/dding-dong:dd-setup`        | 환경 감지 및 초기 설정  |
| `/dding-dong:dd-test`         | 모든 이벤트 알림 테스트 |
| `/dding-dong:dd-config`       | 설정 보기/변경          |
| `/dding-dong:dd-sounds`       | 사운드 팩 관리          |
| `/dding-dong:dd-doctor`       | 알림 문제 자동 진단     |

### 고급 스킬

| 스킬                          | 설명                         |
| ----------------------------- | ---------------------------- |
| `/dding-dong:dd-feedback`     | 피드백/버그 리포트 자동 생성 |
| `/dding-dong:dd-help`         | 도움말 및 기능 가이드        |
| `/dding-dong:dd-pack-create`  | 커스텀 사운드 팩 생성 마법사 |
| `/dding-dong:dd-tts-pack`     | TTS 음성 합성 사운드 팩 생성 |

## 설정

설정은 5단계로 병합됩니다 (아래로 갈수록 우선):

| 단계    | 경로                               | 설명                                |
| ------- | ---------------------------------- | ----------------------------------- |
| Default | *(내장 기본값)*                    | 플러그인 하드코딩                   |
| Global  | `~/.config/dding-dong/config.json` | 전역 설정                           |
| Project | `.dding-dong/config.json`          | 프로젝트 공유 (커밋 대상)           |
| Local   | `.dding-dong/config.local.json`    | 개인 오버라이드 (`.gitignore` 권장) |
| Env     | 환경변수                           | 최종 오버라이드                     |

### 환경변수

| 변수                       | 설명               |
| -------------------------- | ------------------ |
| `DDING_DONG_ENABLED=false` | 플러그인 비활성화  |
| `DDING_DONG_VOLUME=0.5`    | 볼륨 오버라이드    |
| `DDING_DONG_LANG=en`       | 언어 오버라이드    |
| `DDING_DONG_PACK=retro`    | 사운드팩 오버라이드 |

<details>
<summary>전체 설정 예시 및 옵션 상세</summary>

```json
{
  "enabled": true,
  "language": "ko",
  "sound": {
    "enabled": true,
    "pack": "default",
    "volume": 0.7,
    "events": {
      "task.complete": true,
      "task.error": true,
      "input.required": true,
      "session.start": false,
      "session.end": false
    }
  },
  "notification": {
    "enabled": true,
    "events": {
      "task.complete": true,
      "task.error": true,
      "input.required": true,
      "session.start": false,
      "session.end": false
    }
  },
  "messages": {
    "task.complete": "작업이 완료되었습니다!",
    "task.error": "오류가 발생했습니다",
    "input.required": "확인이 필요합니다",
    "session.start": "코딩을 시작합니다",
    "session.end": "세션이 종료되었습니다"
  },
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "cooldown_seconds": 3
}
```

#### 설정 옵션

| 옵션                   | 기본값            | 설명                                                    |
| ---------------------- | ----------------- | ------------------------------------------------------- |
| `enabled`              | `true`            | 플러그인 전체 활성화                                    |
| `language`             | `"ko"`            | 메시지 언어 (`ko` / `en`)                               |
| `sound.enabled`        | `true`            | 사운드 알림 활성화                                      |
| `sound.pack`           | `"default"`       | 사용할 사운드 팩 이름                                   |
| `sound.volume`         | `0.7`             | 볼륨 (0.0 ~ 1.0)                                        |
| `notification.enabled` | `true`            | OS 알림 활성화                                          |
| `messages.<event>`     | *(언어별 기본값)* | 이벤트별 커스텀 메시지 (설정 시 언어 기본값 오버라이드) |
| `quiet_hours.enabled`  | `false`           | 야간 모드 활성화                                        |
| `quiet_hours.start`    | `"22:00"`         | 야간 모드 시작 시간                                     |
| `quiet_hours.end`      | `"08:00"`         | 야간 모드 종료 시간                                     |
| `cooldown_seconds`     | `3`               | 알림 간 최소 간격(초)                                   |

</details>

## 크로스 플랫폼 지원

### macOS
- 사운드: `afplay`
- 알림: `osascript` (네이티브 알림 센터)

### Linux
- 사운드: `pw-play` → `paplay` → `ffplay` → `mpv` → `aplay` (순서대로 탐색)
- 알림: `notify-send` (libnotify)

### WSL (Windows Subsystem for Linux)
- 사운드: PowerShell `System.Windows.Media.MediaPlayer`
- 알림: `wsl-notify-send` (설치된 경우) → WinRT PowerShell Toast → 터미널 벨

## 사운드 팩 시스템

사운드 팩은 세 위치에서 순서대로 탐색됩니다:

1. **프로젝트 팩**: `.dding-dong/packs/<팩이름>/`
2. **사용자 팩**: `~/.config/dding-dong/packs/<팩이름>/`
3. **내장 팩**: `{플러그인 설치 경로}/sounds/<팩이름>/`

### 내장 사운드 팩

| 팩        | 설명                            |
| --------- | ------------------------------- |
| `default` | 기본 효과음                     |
| `retro`   | 8-bit 칩튠 스타일 게임기 효과음 |
| `musical` | 피아노 코드 기반 화성적 알림음  |

### TTS 사운드 팩 생성

Qwen3-TTS를 활용하여 음성 합성 기반 사운드 팩을 만들 수 있습니다.

```
/dding-dong:dd-tts-pack
```

| 모드 | 설명 |
|------|------|
| 보이스 클로닝 | 내 목소리(참조 음성)를 복제하여 알림음 생성. 3초 이상 음성 샘플 필요 |
| CustomVoice | 9개 내장 화자 중 선택. 감정/스타일을 자연어로 제어 가능 (예: "밝고 활기찬 어조로") |

**필요 환경:** NVIDIA GPU (CUDA) · Python 3.10+ (자동 venv 설치 지원)

<details>
<summary>TTS 팩 생성 흐름</summary>

1. 환경 자동 검사 (GPU, Python, qwen-tts)
2. 모드 선택 → 모델 크기 선택 (0.6B / 1.7B)
3. 팩 이름·정보 입력 → 보일러플레이트 생성
4. 음성 설정 (참조 음성 또는 화자 선택)
5. 이벤트별 텍스트·감정 설정
6. 미리듣기 → 전체 생성 → 검증 → 적용

</details>

<details>
<summary>manifest.json 구조 및 사운드 팩 적용 방법</summary>

#### manifest.json 구조

```json
{
  "name": "my-pack",
  "displayName": "나만의 사운드 팩",
  "version": "1.0.0",
  "author": "작성자",
  "description": "사운드 팩 설명",
  "events": {
    "task.complete": {
      "files": ["complete1.wav", "complete2.wav"],
      "rotation": "random"
    },
    "task.error": {
      "files": ["error.wav"]
    }
  }
}
```

| 필드          | 필수   | 설명                             |
| ------------- | ------ | -------------------------------- |
| `name`        | 예     | 팩 식별자 (디렉터리 이름과 일치) |
| `displayName` | 아니오 | 사용자에게 표시되는 이름         |
| `version`     | 아니오 | 시맨틱 버전                      |
| `author`      | 아니오 | 팩 작성자                        |
| `description` | 아니오 | 팩 설명                          |
| `events`      | 예     | 이벤트별 사운드 매핑             |

#### rotation 모드

| 모드              | 동작                       |
| ----------------- | -------------------------- |
| `"random"`        | `files` 배열에서 랜덤 선택 |
| 그 외 또는 미지정 | 첫 번째 파일 재생          |

#### 사운드 팩 적용

설정 파일에서 팩 이름을 지정합니다:

```json
{
  "sound": {
    "pack": "my-pack"
  }
}
```

</details>

## 문제 해결

소리가 나지 않거나 알림이 표시되지 않을 때:

```
/dding-dong:dd-doctor
```

자동으로 환경을 점검하고 문제 원인과 해결 방법을 안내합니다.

## 기여 방법

1. 이 저장소를 포크합니다
2. 기능 브랜치를 만듭니다 (`git checkout -b feature/새기능`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: 새기능 추가'`)
4. 브랜치에 푸시합니다 (`git push origin feature/새기능`)
5. Pull Request를 엽니다

## 라이선스

MIT License — 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.
