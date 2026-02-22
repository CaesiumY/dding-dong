---
name: dd-sounds
description: "Manage dding-dong sound packs. This skill should be used when the user says \"change sound\", \"sound pack\", \"list packs\", \"switch pack\", \"preview sound\", \"사운드 변경\", \"팩 목록\", \"사운드 팩\", \"팩 변경\", \"미리듣기\", or wants to list, switch, or preview sound packs. 사운드 팩 관리."
allowed-tools: [Bash, Read]
disable-model-invocation: true
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

### use [팩 이름]
사운드 팩을 변경합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" apply '${PACK_NAME}'
```

`${PACK_NAME}`은 사용자가 지정한 팩 이름으로 치환합니다.

- 성공 시 (`applied: true`): "`[팩 이름]` 사운드 팩으로 변경했습니다."
- 에러 시 (`error` 필드): "팩을 찾을 수 없습니다: `[팩 이름]`. `/dding-dong:dd-sounds list`로 설치된 팩을 확인하세요."

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
