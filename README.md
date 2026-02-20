# dding-dong 띵동 🔔

> Claude Code 알림 플러그인 — 작업 완료, 오류, 입력 필요 시 소리와 OS 알림으로 알려줍니다

**띵동(dding-dong)** 은 한국어로 초인종 소리를 나타냅니다. Claude Code가 작업을 마쳤을 때, 당신의 주의가 필요할 때 알려드립니다.

## 특징

- 작업 완료, 오류 발생, 입력 필요 시 즉시 알림
- macOS, Linux, WSL(Windows) 크로스 플랫폼 지원
- 사운드 팩 시스템으로 알림음 커스터마이즈
- 한국어/영어 메시지 지원
- 야간 모드 및 쿨다운 설정
- 환경변수로 빠른 제어

## 설치

### Claude Code 플러그인으로 설치 (권장)

```bash
claude plugin add https://github.com/ycs-201607083/dding-dong
```

### 로컬 설치 (개발/테스트)

```bash
git clone https://github.com/ycs-201607083/dding-dong
cd dding-dong
claude plugin add .
```

## 빠른 시작

설치 후 Claude Code에서:

```
/dding-dong:setup
```

환경 감지 및 초기 설정을 도와드립니다.

## 스킬 목록

| 스킬 | 설명 |
|------|------|
| `/dding-dong:setup` | 환경 감지 및 초기 설정 |
| `/dding-dong:test` | 모든 이벤트 알림 테스트 |
| `/dding-dong:config` | 설정 보기/변경 |
| `/dding-dong:sounds` | 사운드 팩 관리 |
| `/dding-dong:diagnose` | 알림 문제 자동 진단 |

## 설정

설정 파일 위치: `~/.config/dding-dong/config.json`

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
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "cooldown_seconds": 3
}
```

### 설정 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `enabled` | `true` | 플러그인 전체 활성화 |
| `language` | `"ko"` | 메시지 언어 (`ko` / `en`) |
| `sound.enabled` | `true` | 사운드 알림 활성화 |
| `sound.pack` | `"default"` | 사용할 사운드 팩 이름 |
| `sound.volume` | `0.7` | 볼륨 (0.0 ~ 1.0) |
| `notification.enabled` | `true` | OS 알림 활성화 |
| `quiet_hours.enabled` | `false` | 야간 모드 활성화 |
| `quiet_hours.start` | `"22:00"` | 야간 모드 시작 시간 |
| `quiet_hours.end` | `"08:00"` | 야간 모드 종료 시간 |
| `cooldown_seconds` | `3` | 알림 간 최소 간격(초) |

### 환경변수

| 변수 | 설명 |
|------|------|
| `DDING_DONG_ENABLED=false` | 플러그인 비활성화 |
| `DDING_DONG_VOLUME=0.5` | 볼륨 오버라이드 |
| `DDING_DONG_LANG=en` | 언어 오버라이드 |

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

사운드 팩은 두 위치에서 탐색되며, 사용자 팩이 우선합니다:

1. **사용자 팩**: `~/.config/dding-dong/packs/<팩이름>/`
2. **내장 팩**: `{플러그인 설치 경로}/sounds/<팩이름>/`

### manifest.json 구조

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

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | 예 | 팩 식별자 (디렉터리 이름과 일치) |
| `displayName` | 아니오 | 사용자에게 표시되는 이름 |
| `version` | 아니오 | 시맨틱 버전 |
| `author` | 아니오 | 팩 작성자 |
| `description` | 아니오 | 팩 설명 |
| `events` | 예 | 이벤트별 사운드 매핑 |

### rotation 모드

| 모드 | 동작 |
|------|------|
| `"random"` | `files` 배열에서 랜덤 선택 |
| `"sequential"` 또는 미지정 | 첫 번째 파일 재생 |

### 사운드 팩 적용

```json
{
  "sound": {
    "pack": "my-pack"
  }
}
```

## 기여 방법

1. 이 저장소를 포크합니다
2. 기능 브랜치를 만듭니다 (`git checkout -b feature/새기능`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: 새기능 추가'`)
4. 브랜치에 푸시합니다 (`git push origin feature/새기능`)
5. Pull Request를 엽니다

## 라이선스

MIT License — 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

---

Made with by ChangSik Yoon
