---
name: dd-feedback
description: "Submit feedback or bug reports for dding-dong as a GitHub issue. This skill should be used when the user says \"feedback\", \"bug report\", \"report issue\", \"suggest feature\", \"file a bug\", \"피드백\", \"버그 신고\", \"기능 요청\", \"건의\", or wants to submit feedback about the plugin. 피드백 및 버그 리포트 자동 생성."
allowed-tools: [Bash, Read, AskUserQuestion]
---

# dding-dong 피드백 제출

사용자의 피드백을 자연어로 받아 자동 분류하고 GitHub 이슈를 생성합니다.

## 1단계: 입력 수집

`$ARGUMENTS`가 비어있지 않으면 해당 텍스트를 피드백으로 사용합니다.

`$ARGUMENTS`가 비어있으면 사용자에게 질문합니다:
"dding-dong에 대한 피드백을 자유롭게 입력해주세요. (버그, 기능 요청, 질문 등 무엇이든 괜찮습니다)"

사용자의 응답을 피드백 텍스트로 사용합니다.

## 2단계: GitHub CLI 사전 검증

```bash
gh auth status 2>&1 && echo "GH_READY" || echo "GH_NOT_READY"
```

`GH_NOT_READY`인 경우 아래 메시지를 안내하고 종료합니다:

```
GitHub CLI(gh)가 설치되지 않았거나 인증되지 않았습니다.

피드백을 제출하려면:
1. gh CLI 설치: https://cli.github.com/
2. 인증: gh auth login

또는 직접 이슈를 작성해주세요:
https://github.com/CaesiumY/dding-dong/issues/new
```

## 3단계: 컨텍스트 수집

저장소 정보와 환경 정보를 한 번에 수집합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-feedback/scripts/collect-context.mjs" --cwd "$(pwd)"
```

JSON 결과를 파싱하여 이후 단계에서 사용합니다:
- `repository`: 대상 저장소 (예: `CaesiumY/dding-dong`). `null`이면 기본값 `CaesiumY/dding-dong` 사용.
- `environment`: 환경 정보 객체. `error` 필드가 있으면 환경 정보를 "감지 불가"로 표시하고 계속 진행.

## 4단계: 자동 분류 및 구조화

1단계에서 수집한 피드백 텍스트를 분석하여 아래 항목을 결정합니다.

### 카테고리 판별

- 오류, 안 됨, 안 나옴, 깨짐, 실패, crash, error, fail, broken, not working → `bug`
- 추가, 지원, 있으면 좋겠, 제안, 개선, want, suggest, add, feature, improve → `enhancement`
- 어떻게, 왜, 방법, 질문, 궁금, how, why, question, what does → `question`
- 불확실하면 → `enhancement` (기본값)

### 우선순위 추정

- 긴급, 심각, 전혀 안됨, 완전히, critical, urgent, blocker, completely broken → `high`
- 사소한, 미미한, 작은, cosmetic, minor, tiny, small → `low`
- 그 외 일반적 피드백 → `medium` (기본값)

### 제목 생성

사용자 입력에서 핵심 문제 또는 요청을 한 줄로 요약합니다.
- 50자 이내
- 한국어/영어 모두 허용
- 이슈 제목으로 적합한 간결한 형태

### 이슈 본문 구성

**버그 리포트 (`bug`) 본문:**

```
## 설명
[사용자 입력을 구조화하여 정리]

## 재현 단계
[텍스트에서 재현 단계가 추출되면 기술, 없으면 "제공되지 않음"]

## 환경 정보
| 항목 | 값 |
|------|-----|
| 플랫폼 | {platform} |
| 오디오 플레이어 | {audioPlayer} |
| 알림 도구 | {notifier} |
| 사운드 팩 | {soundPack} |
| 볼륨 | {volume} |
| 언어 | {language} |
| Node.js | {nodeVersion} |

---
*이 이슈는 `/dding-dong:dd-feedback`을 통해 자동 생성되었습니다.*
```

**기능 요청 (`enhancement`) / 질문 (`question`) 본문:**

```
## 설명
[사용자 입력을 구조화하여 정리]

## 환경 정보
| 항목 | 값 |
|------|-----|
| 플랫폼 | {platform} |
| Node.js | {nodeVersion} |

---
*이 이슈는 `/dding-dong:dd-feedback`을 통해 자동 생성되었습니다.*
```

## 5단계: 미리보기 및 확인

분류 결과를 사용자에게 미리보기로 보여줍니다:

```
📋 피드백 미리보기
━━━━━━━━━━━━━━━━━━━━━
카테고리: [버그 리포트 / 기능 요청 / 질문]
제목: [자동 생성된 제목]
우선순위: [높음 / 보통 / 낮음]
레이블: [bug / enhancement / question]

본문 미리보기:
[구조화된 이슈 본문 앞부분]
━━━━━━━━━━━━━━━━━━━━━
대상 저장소: [3단계에서 추출한 저장소]
```

AskUserQuestion으로 질문: "위 내용으로 GitHub 이슈를 생성하시겠습니까?"
1. "제출" — 이슈를 생성합니다
2. "수정 후 제출" — 수정할 내용을 입력받아 반영 후 다시 미리보기를 보여줍니다
3. "취소" — 아무것도 생성하지 않고 종료합니다

"수정 후 제출"을 선택하면 사용자에게 수정 사항을 물어본 뒤, 4단계의 분류 결과를 수정하여 다시 미리보기를 보여줍니다.

## 6단계: 이슈 생성

### 보안 지침 (셸 인젝션 방어)

`gh issue create` 실행 시, 사용자 입력 유래 값(제목, 본문)은 **반드시 작은따옴표 heredoc** (`<<'EOF'`)을 사용하여 전달합니다. 큰따옴표 변수 보간(`"${VAR}"`)을 사용하지 않습니다.

### 1차 시도: 레이블 포함

```bash
gh issue create --repo REPO_NAME \
  --title "$(cat <<'TITLE_EOF'
여기에 제목 텍스트
TITLE_EOF
)" \
  --body "$(cat <<'BODY_EOF'
여기에 본문 텍스트
BODY_EOF
)" \
  --label "LABEL_NAME"
```

`REPO_NAME`, 제목 텍스트, 본문 텍스트, `LABEL_NAME`을 4단계와 5단계의 결과로 채웁니다.

### 레이블 실패 시 2차 시도

1차 시도에서 exit code가 0이 아니고 stderr에 `label`, `Label`, `422` 중 하나가 포함되어 있으면, `--label` 옵션을 제거하고 재시도합니다:

```bash
gh issue create --repo REPO_NAME \
  --title "$(cat <<'TITLE_EOF'
여기에 제목 텍스트
TITLE_EOF
)" \
  --body "$(cat <<'BODY_EOF'
여기에 본문 텍스트
BODY_EOF
)"
```

### 기타 실패

레이블 문제가 아닌 다른 이유로 실패하면 안내합니다:

```
이슈 생성에 실패했습니다.

직접 이슈를 작성해주세요:
https://github.com/CaesiumY/dding-dong/issues/new
```

## 7단계: 결과 안내

이슈 생성 성공 시 `gh issue create`의 출력에서 이슈 URL을 추출하여 안내합니다:

```
피드백이 제출되었습니다! 감사합니다.
이슈 URL: [생성된 이슈 URL]
```

레이블 없이 재시도하여 성공한 경우:

```
피드백이 제출되었습니다! (레이블은 수동으로 추가해주세요)
이슈 URL: [생성된 이슈 URL]
```

---
**관련 스킬**
- 알림이 안 될 때 → `/dding-dong:dd-doctor`
- 전체 기능 안내 → `/dding-dong:dd-help`
