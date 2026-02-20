---
description: dding-dong 알림 설정 마법사 (한국어)
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# dding-dong 설정 마법사

사용자의 환경을 확인하고 dding-dong 알림 플러그인을 설정합니다.

## 실행 순서

### 1단계: 환경 감지

아래 명령어를 실행하여 환경을 감지합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" detect
```

결과 JSON을 파싱하여 사용자에게 한국어로 안내합니다:
- "💻 플랫폼: [macOS/Linux/WSL] 감지됨"
- "🔊 사운드 플레이어: [이름] 사용 가능" 또는 "⚠️ 사운드 플레이어를 찾을 수 없습니다"
- "📢 알림 도구: [이름] 사용 가능" 또는 "⚠️ 알림 도구를 찾을 수 없습니다"

WSL에서 wsl-notify-send가 없으면:
- "💡 wsl-notify-send 설치를 권장합니다: https://github.com/stuartleeks/wsl-notify-send"
- "설치 없이도 PowerShell 기본 알림을 사용할 수 있습니다."

### 2단계: 사용자 선호도 확인

AskUserQuestion으로 다음을 확인합니다:

1. "어떤 이벤트에 알림을 받으시겠습니까?" (multiSelect)
   - 작업 완료 (task.complete) - 기본 ON
   - 오류 발생 (task.error) - 기본 ON
   - 입력 필요 (input.required) - 기본 ON
   - 세션 시작 (session.start) - 기본 OFF
   - 세션 종료 (session.end) - 기본 OFF

2. "사운드 볼륨을 설정해주세요" (0.1~1.0)
   - 기본: 0.7

3. "야간 모드를 사용하시겠습니까?"
   - 사용 안 함 (기본)
   - 사용 (22:00~08:00)

### 3단계: 설정 저장

사용자 응답을 바탕으로 `~/.config/dding-dong/config.json`을 생성/업데이트합니다.

### 4단계: 테스트

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

결과를 확인하고:
- "✅ 설정이 완료되었습니다! 알림이 정상적으로 동작합니다."
- 또는 "⚠️ 알림 테스트에 실패했습니다. /dding-dong:config show 로 설정을 확인해주세요."
