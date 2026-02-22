---
name: dd-doctor
description: "Diagnose dding-dong notification issues. This skill should be used when the user says \"notification not working\", \"sound not playing\", \"no alert\", \"diagnose\", \"알림 안됨\", \"소리 안남\", \"알림 문제\", \"진단\", or experiences notification failures. 알림 문제 진단."
allowed-tools: [Bash(node *), Read, Glob, Grep]
context: fork
---

# dding-dong doctor

알림이 정상 작동하지 않을 때 원인을 분석합니다.

## 진단 순서

### 1. 환경 감지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" detect --cwd "$(pwd)"
```

결과를 분석하여 플랫폼, 사운드 플레이어, 알림 도구 상태를 확인합니다.

### 2. 설정 진단

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-config.mjs" --cwd "$(pwd)"
```

JSON 결과에서 다음을 확인합니다:
- `setup.completed` — 초기 셋업 완료 여부 (미완료 시 `/dding-dong:dd-setup` 권장)
- `config` — 병합된 설정 (`enabled`, `sound.events`, `notification.events` 등)
- `paths` — 각 설정 파일의 경로와 존재 여부

### 3. 설정 검증

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" validate --cwd "$(pwd)"
```

자동 검증 항목:
- JSON 파싱 오류
- 필수 키 누락 또는 타입 오류
- 알 수 없는 이벤트 타입
- 사운드 팩 파일 존재 여부

### 4. 테스트 알림 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

### 5. 진단 결과 요약

발견된 문제와 해결 방법을 한국어로 정리하여 보고합니다:
- 환경 문제 (플레이어/알림도구 미설치)
- 설정 문제 (비활성화, 이벤트 OFF)
- 파일 문제 (사운드 파일 누락)
- 권한 문제 (실행 권한 부족)

---
**관련 스킬**
- 초기 설정 → `/dding-dong:dd-setup`
- 피드백 제출 → `/dding-dong:dd-feedback`
- 전체 기능 안내 → `/dding-dong:dd-help`
