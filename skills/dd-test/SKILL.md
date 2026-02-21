---
name: dd-test
description: "Test dding-dong notifications. Runs all event types in sequence, or test a specific event. 알림 테스트."
allowed-tools: [Bash, Read]
disable-model-invocation: true
---

# dding-dong 알림 테스트

## 사용법

- 인자 없이: 모든 이벤트를 순서대로 테스트
- 특정 이벤트: `$ARGUMENTS`로 지정 (예: task.complete, input.required)

## 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test $ARGUMENTS
```

## 결과 안내

각 테스트 결과를 한국어로 안내합니다:
- "🔔 [이벤트] 테스트 중..."
- "✅ 사운드 재생 성공" 또는 "❌ 사운드 재생 실패"
- "✅ OS 알림 전송 성공" 또는 "❌ OS 알림 전송 실패"
