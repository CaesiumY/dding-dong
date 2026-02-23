---
name: dd-sounds
description: "Manage dding-dong sound packs. This skill should be used when the user says \"change sound\", \"sound pack\", \"list packs\", \"switch pack\", \"preview sound\", \"사운드 변경\", \"팩 목록\", \"사운드 팩\", \"팩 변경\", \"미리듣기\", or wants to list, switch, or preview sound packs. 사운드 팩 관리."
allowed-tools: [Bash, Read, AskUserQuestion]
---

# dding-dong 사운드 팩 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### list (기본)
설치된 사운드 팩 목록을 표시합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" discover --cwd "$(pwd)"
```

결과 JSON 배열을 테이블로 표시합니다. 현재 선택된 팩은 `active: true`로 식별하여 ✓ 표시:

| 팩 이름 | 표시 이름 | 구분 | 버전 | 사용 중 |
|---------|----------|------|------|:------:|
| `name` | `displayName` | 내장/사용자 | `version` | ✓/- |

### use [팩 이름] [--scope global|project|local]
사운드 팩을 변경합니다.

`--scope` 옵션으로 대상 스코프를 지정할 수 있습니다:
- `--scope global` -- 전역 설정에 반영 (기본값)
- `--scope project` -- 프로젝트 설정에 반영 (팀 공유, 커밋됨)
- `--scope local` -- 내 설정에 반영 (개인 오버라이드, 커밋 제외)

`$ARGUMENTS`에서 팩 이름과 `--scope` 플래그를 추출합니다.

`--scope` 플래그가 있으면 해당 값을 `${SCOPE}`로 사용합니다.

`--scope` 플래그가 없으면 AskUserQuestion으로 질문합니다:

"사운드 팩을 어디에 적용하시겠습니까?"

선택지:
1. **프로젝트 로컬 (Recommended)** -- "이 프로젝트에서만 적용, 개인 설정 (.dding-dong/config.local.json). gitignored."
2. **프로젝트 (팀 공유)** -- "이 프로젝트의 팀 전체에 적용 (.dding-dong/config.json). 커밋됩니다."
3. **글로벌** -- "모든 프로젝트에 적용 (~/.config/dding-dong/config.json)."

선택 결과를 `${SCOPE}`로 설정합니다 ("프로젝트 로컬" → `local`, "프로젝트 (팀 공유)" → `project`, "글로벌" → `global`).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" apply '${PACK_NAME}' --scope '${SCOPE}' --cwd "$(pwd)"
```

- 성공 시 (`applied: true`): "`[팩 이름]` 사운드 팩으로 변경했습니다. (스코프: `[scope]`)"
- 팩 없음 에러: "팩을 찾을 수 없습니다: `[팩 이름]`. `/dding-dong:dd-sounds list`로 설치된 팩을 확인하세요."
- 프로젝트 루트 없음 에러: "프로젝트 루트를 찾을 수 없습니다. `--scope global`을 사용하거나 프로젝트 디렉토리에서 실행하세요."

### preview [팩 이름]
팩의 각 이벤트 사운드를 순서대로 재생합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test-sound ${PACK_NAME}
```

`${PACK_NAME}`은 사용자가 지정한 팩 이름으로 치환합니다. 미지정 시 현재 사용 중인 팩을 재생합니다 (`list` 결과에서 `active: true`인 팩 이름을 사용).

---
**관련 스킬**
- 커스텀 사운드 팩 만들기 → `/dding-dong:dd-pack-create`
- 전체 설정 관리 → `/dding-dong:dd-config`
- 전체 기능 안내 → `/dding-dong:dd-help`
