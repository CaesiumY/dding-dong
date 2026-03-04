---
name: dd-uninstall
description: "Selectively remove dding-dong artifacts (global config, project config, TTS venv) with dry-run preview. 플러그인 정리/삭제 마법사. Use when the user says 'uninstall', 'remove dding-dong', 'clean up', 'delete config', '삭제', '정리', '제거', '언인스톨'."
allowed-tools: [Bash, Read, Glob, AskUserQuestion]
---

# dding-dong 정리 마법사

플러그인이 생성한 아티팩트(설정, 사운드팩, TTS venv 등)를 선택적으로 삭제합니다.

## 플래그 파싱

`$ARGUMENTS`에서 플래그를 확인합니다:

- `--help`: 아래 사용법을 출력하고 종료합니다.
  ```
  dding-dong 정리 마법사

  사용법: /dding-dong:dd-uninstall [옵션]

  옵션:
    --all      모든 아티팩트 선택 (선택 단계 건너뜀)
    --help     이 도움말 표시
  ```

- `--all`: 2단계(범위 선택)를 건너뛰고 존재하는 모든 아티팩트를 선택합니다. dry-run과 최종 확인은 여전히 실행됩니다.

## 삭제 대상 아티팩트

| 카테고리 | 경로 | 설명 |
|----------|------|------|
| 글로벌 설정 | `~/.config/dding-dong/config.json` + `*.backup*` | 전역 설정 및 백업 |
| 글로벌 상태 | `~/.config/dding-dong/.state.json` | 쿨다운 타임스탬프 |
| 글로벌 사운드팩 | `~/.config/dding-dong/packs/` | 사용자 설치 팩 |
| TTS venv | `~/.config/dding-dong/tts-venv/` | Python 가상환경 (2-15GB) |
| 프로젝트 설정 | `.dding-dong/config.json` + `*.backup*` | 팀 공유 설정 |
| 프로젝트 로컬 | `.dding-dong/config.local.json` + `*.backup*` | 개인 오버라이드 |
| 프로젝트 팩 | `.dding-dong/packs/` | 프로젝트 커스텀 팩 |
| 프로젝트 상태 | `.dding-dong/.state.json` | 프로젝트 상태 |

## 실행 순서

### 1단계: 환경 스캔

현재 설정 상태를 확인합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-config.mjs" --cwd "$(pwd)"
```

그 다음 각 아티팩트의 존재 여부를 확인합니다:

```bash
# 글로벌 디렉토리
ls -la ~/.config/dding-dong/ 2>/dev/null || echo "GLOBAL_DIR_NOT_FOUND"

# TTS venv
ls -d ~/.config/dding-dong/tts-venv 2>/dev/null && echo "TTS_VENV_EXISTS" || echo "TTS_VENV_NOT_FOUND"

# 프로젝트 디렉토리
ls -la .dding-dong/ 2>/dev/null || echo "PROJECT_DIR_NOT_FOUND"
```

**아무 아티팩트도 없으면:**
"dding-dong 관련 파일이 발견되지 않았습니다. 정리할 항목이 없습니다." 안내 후 종료합니다.

스캔 결과를 기억하여 이후 단계에서 사용합니다. 존재하는 항목만 목록으로 정리합니다.

### 2단계: 삭제 범위 선택

`--all` 플래그가 있으면 존재하는 모든 항목을 선택하고 3단계로 건너뜁니다.

AskUserQuestion (multiSelect: true)으로 질문합니다:

"삭제할 항목을 선택해주세요."

**존재하는 항목만** 선택지에 표시합니다. 각 선택지는 아래 카테고리를 기준으로 합니다:

1. **글로벌 설정** — "전역 설정, 상태, 사용자 사운드팩 (~/.config/dding-dong/)" (글로벌 디렉토리 내 config.json, .state.json, packs/ 중 하나라도 존재할 때)
2. **프로젝트 설정** — "프로젝트 설정, 로컬 설정, 프로젝트 팩 (.dding-dong/)" (프로젝트 디렉토리 내 파일이 하나라도 존재할 때)
3. **TTS 가상환경** — "Python TTS 가상환경 (~/.config/dding-dong/tts-venv/)" (tts-venv 디렉토리가 존재할 때)

선택지가 하나뿐이면 multiSelect 질문 대신 해당 항목을 자동 선택하고, 사용자에게 "삭제 가능한 항목이 하나뿐입니다: [항목명]" 안내 후 3단계로 진행합니다.

### 3단계: dry-run 미리보기

선택된 각 카테고리의 파일/폴더 목록과 크기를 표시합니다.

**글로벌 설정 선택 시:**
```bash
du -sh ~/.config/dding-dong/config.json ~/.config/dding-dong/.state.json ~/.config/dding-dong/packs/ 2>/dev/null; ls ~/.config/dding-dong/config.json.backup* 2>/dev/null
```

**프로젝트 설정 선택 시:**
```bash
du -sh .dding-dong/ 2>/dev/null
```

**TTS venv 선택 시:**
```bash
du -sh ~/.config/dding-dong/tts-venv/ 2>/dev/null
```

결과를 한국어 마크다운 테이블로 정리합니다:

```
## 삭제 예정 항목

| 항목 | 경로 | 크기 |
|------|------|------|
| 글로벌 설정 | ~/.config/dding-dong/config.json | XX KB |
| 글로벌 상태 | ~/.config/dding-dong/.state.json | XX KB |
| ... | ... | ... |
| **합계** | | **XX MB** |
```

**경고 표시 조건:**
- 프로젝트 설정에 `.dding-dong/config.json`이 포함된 경우:
  > ⚠️ `.dding-dong/config.json`은 팀 공유 파일입니다 (Git 추적 대상). 삭제하면 팀원에게 영향을 줄 수 있습니다.
- TTS venv가 포함된 경우, 크기를 강조:
  > ℹ️ TTS 가상환경은 **[크기]** 의 디스크 공간을 차지하고 있습니다.

### 4단계: 최종 확인

AskUserQuestion으로 질문합니다:

"위 항목을 삭제합니다. 진행하시겠습니까?"

선택지:
1. **삭제 진행** — "선택한 항목을 영구 삭제합니다."
2. **취소** — "삭제를 취소합니다."

"취소"를 선택하면 "삭제가 취소되었습니다." 안내 후 종료합니다.

### 5단계: 삭제 실행

선택된 카테고리별로 삭제를 실행합니다. 각 명령은 개별적으로 실행하여 부분 실패를 추적합니다.

**글로벌 설정 선택 시:**
```bash
# 설정 파일 + 백업
rm -f ~/.config/dding-dong/config.json ~/.config/dding-dong/config.json.backup*
# 상태 파일
rm -f ~/.config/dding-dong/.state.json
# 사용자 사운드팩
rm -rf ~/.config/dding-dong/packs/
```

**프로젝트 설정 선택 시:**
```bash
rm -rf .dding-dong/
```

**TTS venv 선택 시:**
```bash
rm -rf ~/.config/dding-dong/tts-venv/
```

**글로벌 디렉토리 정리:**
글로벌 설정과 TTS venv가 모두 삭제되어 `~/.config/dding-dong/`이 비었으면 (내장 사운드 제외, 남은 파일 없음):
```bash
# 디렉토리가 비었는지 확인
if [ -z "$(ls -A ~/.config/dding-dong/ 2>/dev/null)" ]; then
  rmdir ~/.config/dding-dong/
fi
```

**.gitignore 정리 (프로젝트 설정 삭제 시):**
프로젝트 루트의 `.gitignore`에 dding-dong 관련 엔트리가 있으면 AskUserQuestion으로 질문:

".gitignore에서 dding-dong 관련 항목도 제거하시겠습니까?"
1. **예, 제거 (Recommended)** — ".gitignore에서 dding-dong 관련 라인을 삭제합니다."
2. **아니오, 유지** — ".gitignore는 그대로 둡니다."

"예" 선택 시, `.gitignore`에서 다음 패턴을 포함하는 라인을 제거합니다:
- `dding-dong` 또는 `.dding-dong`을 포함하는 라인
- `config.local.json`을 포함하는 라인 (dding-dong 관련 주석이 있는 경우만)

```bash
grep -n -i "dding.dong\|\.dding-dong" .gitignore 2>/dev/null
```

해당 라인을 확인 후 sed로 제거합니다. .gitignore가 비게 되면 파일 자체는 남겨둡니다.

**에러 처리:**
- 각 rm 명령의 종료 코드를 확인합니다.
- 실패한 항목은 기록하되 나머지 삭제는 계속 진행합니다.
- 최종 결과에 실패 항목을 포함합니다.

### 6단계: 결과 리포트

삭제 결과를 한국어로 요약합니다:

```
## 정리 완료

✓ 삭제된 항목:
  - 글로벌 설정 (~/.config/dding-dong/config.json)
  - 글로벌 상태 (~/.config/dding-dong/.state.json)
  - ...

해제된 디스크 공간: ~XX MB

남은 항목:
  - (없음) 또는 남아있는 항목 목록
```

실패한 항목이 있으면:
```
⚠️ 삭제 실패:
  - [경로]: [에러 메시지]
```

마지막에 안내:
```
---
**참고**
- 재설정하려면 → `/dding-dong:dd-setup`
- 플러그인 자체를 제거하려면 → `claude plugin remove dding-dong`
```

---
**관련 스킬**
- 초기 설정 → `/dding-dong:dd-setup`
- 설정 확인 → `/dding-dong:dd-config`
- 알림 문제 진단 → `/dding-dong:dd-doctor`
- 전체 기능 안내 → `/dding-dong:dd-help`
