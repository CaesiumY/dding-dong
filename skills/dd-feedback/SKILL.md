---
name: dd-feedback
description: "Submit feedback or bug reports for dding-dong. Describe your feedback naturally - it will be auto-classified and filed as a GitHub issue. 피드백을 자연어로 입력하면 자동으로 GitHub 이슈를 생성합니다."
allowed-tools: [Bash, Read, AskUserQuestion]
---

# dding-dong 피드백 제출

사용자의 피드백을 자연어로 받아 자동 분류하고 GitHub 이슈를 생성합니다.

> **설계 노트**: `disable-model-invocation`은 의도적으로 생략되었습니다.
> 이 스킬은 자연어 입력의 분석·분류·구조화에 모델 추론이 필수적입니다.
> 기존 스킬들은 `disable-model-invocation: true` (기계적 작업) 또는
> `context: fork` (dd-doctor, 서브에이전트 진단)를 사용하지만,
> dd-feedback은 현재 대화 컨텍스트에서 NL 이해가 필요한 유일한 스킬입니다.

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

## 3단계: 대상 저장소 확인

plugin.json에서 저장소 정보를 동적으로 추출합니다:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const pluginJson = JSON.parse(readFileSync(join('${CLAUDE_PLUGIN_ROOT}', '.claude-plugin', 'plugin.json'), 'utf8'));
const repo = pluginJson.repository.replace('https://github.com/', '');
console.log(repo);
"
```

출력된 값을 대상 저장소로 사용합니다 (예: `CaesiumY/dding-dong`).
추출 실패 시 `CaesiumY/dding-dong`을 기본값으로 사용합니다.

## 4단계: 환경 정보 수집

```bash
node --input-type=module -e "
import { detectAll } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/platform.mjs';
import { loadConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
try {
  const env = detectAll();
  const config = loadConfig(process.cwd());
  console.log(JSON.stringify({
    platform: env.platform,
    audioPlayer: env.audioPlayer?.name || 'none',
    notifier: env.notifier?.name || 'none',
    soundPack: config.sound?.pack || 'default',
    volume: config.sound?.volume ?? 'unknown',
    language: config.language || 'unknown',
    nodeVersion: process.version
  }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }));
}
"
```

수집 실패 시 (JSON에 `error` 필드가 있으면) 환경 정보를 "감지 불가"로 표시하고 계속 진행합니다.

## 5단계: 자동 분류 및 구조화

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

## 6단계: 미리보기 및 확인

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

"수정 후 제출"을 선택하면 사용자에게 수정 사항을 물어본 뒤, 5단계의 분류 결과를 수정하여 다시 미리보기를 보여줍니다.

## 7단계: 이슈 생성

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

`REPO_NAME`, 제목 텍스트, 본문 텍스트, `LABEL_NAME`을 5단계와 6단계의 결과로 채웁니다.

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

## 8단계: 결과 안내

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
