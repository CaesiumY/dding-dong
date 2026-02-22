---
name: dd-test
description: "Test dding-dong notifications. Runs all event types in sequence, or test a specific event. 알림 테스트. Use when the user says '알림 테스트', 'test notification', 'test sound', '소리 테스트'."
allowed-tools: [Bash, Read]
disable-model-invocation: true
---

# dding-dong 알림 테스트

## 사용법

- 인자 없이: 모든 이벤트를 순서대로 테스트
- 특정 이벤트: `${ARGUMENTS}`로 지정 (예: task.complete, input.required)

## 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test ${ARGUMENTS}
```

## 결과 안내

exit code에 따라 결과를 안내합니다:

**성공 (exit 0):**
각 테스트 결과를 한국어로 안내합니다:
- "🔔 [이벤트] 테스트 중..."
- "✅ 사운드 재생 성공" 또는 "❌ 사운드 재생 실패"
- "✅ OS 알림 전송 성공" 또는 "❌ OS 알림 전송 실패"

**알 수 없는 이벤트 (exit 1):**
- "알 수 없는 이벤트입니다. 사용 가능: task.complete, task.error, input.required, session.start, session.end"

**알림 미재생 (exit 0이나 소리/알림 없음):**
- 설정에서 비활성화되어 있을 수 있습니다. `/dding-dong:dd-config show`로 확인하세요.
- 사운드 플레이어/알림 도구가 설치되지 않았을 수 있습니다. `/dding-dong:dd-doctor`로 진단하세요.
