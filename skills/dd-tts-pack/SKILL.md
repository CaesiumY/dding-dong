---
name: dd-tts-pack
description: "Create TTS sound pack using Qwen3-TTS voice cloning or built-in voices. TTS 음성 합성으로 사운드 팩 생성. Use when the user says 'TTS 팩', 'TTS 사운드', 'tts pack', '음성 합성 팩', '보이스 클로닝', 'voice clone pack', 'TTS로 만들기'."
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# TTS 사운드 팩 생성 마법사

Qwen3-TTS를 사용하여 음성 합성 기반 사운드 팩을 생성합니다.
보이스 클로닝(참조 음성 복제) 또는 CustomVoice(내장 음성) 모드를 지원합니다.

> **설계 노트**: `disable-model-invocation`은 의도적으로 생략되었습니다.
> 이 스킬은 사용자 입력 해석, 환경 검사 결과 분석,
> TTS 설정 구성에 모델 추론이 필수적입니다.

## 사운드 팩 구조 참고

매니페스트 스키마, 디렉토리 구조, WAV 사양 상세는 [`../dd-pack-create/references/manifest-spec.md`](../dd-pack-create/references/manifest-spec.md) 참조.

**핵심 규칙:**
- 이벤트 엔트리는 반드시 `{ "files": ["filename.wav"] }` 형식
- 미등록 이벤트는 `events`에서 키를 생략 (null 아님)
- WAV 권장: 16-bit PCM, 44100Hz, mono, 1~3초

## 플래그 파싱

`$ARGUMENTS`에서 플래그를 확인합니다:

- `--help`: 아래 사용법을 출력하고 종료합니다.
  ```
  TTS 사운드 팩 생성 마법사

  Qwen3-TTS로 음성 합성 기반 사운드 팩을 생성합니다.
  보이스 클로닝 또는 내장 음성(CustomVoice)을 선택할 수 있습니다.

  사용법: /dding-dong:dd-tts-pack [옵션]

  옵션:
    --clone          보이스 클로닝 모드로 바로 시작
    --custom         CustomVoice 모드로 바로 시작
    --help           이 도움말 표시

  필요 환경:
    - NVIDIA GPU (8GB+ VRAM)
    - Python 3.10+ (자동 venv 설치 지원)
    - qwen-tts (venv에 자동 설치)

  예시:
    /dding-dong:dd-tts-pack
    /dding-dong:dd-tts-pack --clone
    /dding-dong:dd-tts-pack --custom
  ```

- `--clone`: 모드 선택을 건너뛰고 보이스 클로닝 모드로 진행합니다.
- `--custom`: 모드 선택을 건너뛰고 CustomVoice 모드로 진행합니다.

## 실행 순서

### 1단계: 환경 검사

스킬이 호출되면 환경을 자동 검사합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/check-env.mjs"
```

결과 JSON에서 `all_ok`, `python_path`, `venv`, `gpu` 필드를 확인합니다.

**모두 통과 (`all_ok: true`)**:
`PYTHON_PATH` 변수에 `python_path` 값을 저장하고 2단계로 진행합니다.

**GPU 없음 (`gpu.ok: false`)**:
GPU 없이는 TTS를 실행할 수 없으므로 즉시 종료합니다.
```
CUDA GPU가 필요합니다. 이 스킬은 NVIDIA GPU(CUDA)가 있는 환경에서만 사용 가능합니다.
기존 WAV 파일로 팩을 만들려면: /dding-dong:dd-pack-create
```

**GPU 있고 venv 없음 (`gpu.ok: true && venv.exists: false`)**:
환경 상태를 표시한 후 자동 설치를 제안합니다.

```
TTS 사운드 팩 생성에는 다음 환경이 필요합니다:

  {venv.exists ? "✓" : "✗"} TTS 전용 환경     {venv.exists ? venv.path : "— 미설치 (자동 설치 가능)"}
  {python.ok ? "✓" : "✗"} Python 3.10+        {python.ok ? python.version + " (" + python.source + ")" : "— 미설치"}
  {qwen_tts.ok ? "✓" : "✗"} qwen-tts 패키지   {qwen_tts.ok ? qwen_tts.version : "— 미설치"}
  {GPU 상태에 따른 3가지 분기 — 아래 참조}
```

GPU 상태는 `gpu.ok`와 `gpu.cuda_ready`를 구분하여 3가지로 표시합니다:
- `gpu.ok && gpu.cuda_ready` → `✓ NVIDIA GPU (CUDA)       {gpu.name} ({gpu.vram_gb}GB)`
- `gpu.ok && !gpu.cuda_ready` → `✓ NVIDIA GPU (CUDA)       {gpu.name} ({gpu.vram_gb}GB) (torch 미설치 — 자동 설치로 해결)`
- `!gpu.ok` → `✗ NVIDIA GPU (CUDA)       — CUDA 지원 GPU 필요`

AskUserQuestion으로 질문합니다:

"TTS 환경(Python venv + qwen-tts)을 자동으로 설치하시겠습니까?"

선택지:
1. **자동 설치 (Recommended)** -- "~/.config/dding-dong/tts-venv/에 전용 Python 환경을 생성하고 필요 패키지를 설치합니다. (수 분 소요)"
2. **수동 설치** -- "직접 환경을 구성합니다."

**"자동 설치" 선택 시:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/setup-tts-venv.mjs" create
```

타임아웃: 900초 (venv 생성 + PyTorch + qwen-tts 다운로드)

- **성공 (`ok: true`)**: `check-env.mjs`를 재실행하여 `all_ok: true` 확인 후 `PYTHON_PATH`에 `python_path` 저장, 2단계로 진행
- **venv 모듈 미설치 (`error: 'venv_module_missing'`)**: Ubuntu/Debian에서 `python3-venv` 패키지가 필요합니다.
  사용자에게 안내합니다:
  ```
  Python venv 모듈이 설치되어 있지 않습니다.
  시스템 패키지를 설치해야 합니다: {install_hint}
  ```
  Bash로 직접 설치합니다 (Claude Code가 사용자에게 승인을 요청합니다):
  ```bash
  sudo apt install -y {install_pkg}
  ```
  설치 성공 시 `setup-tts-venv.mjs create`를 재실행합니다.
  설치 실패 시 수동 설치 안내를 표시하고 종료합니다.
- **기타 실패 (`ok: false`)**: 에러 메시지를 표시하고 종료합니다.
  ```
  자동 설치에 실패했습니다: {error}
  수동 설치 안내:
    python3 -m venv ~/.config/dding-dong/tts-venv
    ~/.config/dding-dong/tts-venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
    ~/.config/dding-dong/tts-venv/bin/pip install -U qwen-tts
  ```

**"수동 설치" 선택 시:**
```
수동 설치 안내:
  python3 -m venv ~/.config/dding-dong/tts-venv
  ~/.config/dding-dong/tts-venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
  ~/.config/dding-dong/tts-venv/bin/pip install -U qwen-tts
설치 후 다시 실행해주세요: /dding-dong:dd-tts-pack
```
여기서 종료합니다.

**venv 존재하지만 qwen-tts 없음 (`venv.exists: true && qwen_tts.ok: false`)**:

환경 상태를 표시한 후:
```
venv는 존재하지만 qwen-tts가 설치되지 않았습니다.
```

AskUserQuestion으로 질문합니다:

"패키지 재설치를 시도하시겠습니까?"

선택지:
1. **재설치 시도 (Recommended)** -- "기존 venv에 qwen-tts를 다시 설치합니다."
2. **종료** -- "스킬을 종료합니다."

**"재설치 시도" 선택 시:**
`setup-tts-venv.mjs create`를 실행합니다 (기존 venv에 pip install만 재실행).
성공 시 `check-env.mjs` 재실행 → `PYTHON_PATH` 저장 → 2단계 진행.
실패 시 에러 표시 후 종료.

**"종료" 선택 시:** 종료합니다.

### 2단계: 모드 선택

`--clone` 또는 `--custom` 플래그가 있으면 이 단계를 건너뜁니다.

AskUserQuestion으로 질문합니다:

"TTS 생성 모드를 선택해주세요."

선택지:
1. **보이스 클로닝 (Recommended)** -- "내 목소리(참조 음성)를 복제하여 알림음을 생성합니다. 3초 이상의 음성 샘플이 필요합니다."
2. **내장 음성 (CustomVoice)** -- "9개의 내장 음성 중 하나를 선택합니다. 참조 음성 없이 바로 사용 가능합니다."

선택 결과를 `VOICE_MODE` 변수로 저장합니다:
- "보이스 클로닝" → `clone`
- "내장 음성" → `custom`

### 3단계: 모델 크기 선택

1단계 환경 검사에서 얻은 `gpu.vram_gb` 값을 기준으로 적절한 모델을 추천합니다.

| 크기 | 모델명 (클로닝) | 모델명 (CustomVoice) | VRAM 요구 |
|------|---------------|---------------------|----------|
| 0.6B | `Qwen/Qwen3-TTS-12Hz-0.6B-Base` | `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` | ~2GB |
| 1.7B | `Qwen/Qwen3-TTS-12Hz-1.7B-Base` | `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` | ~4GB |

AskUserQuestion으로 질문합니다:

"TTS 모델 크기를 선택해주세요."

**VRAM >= 8GB인 경우:**

선택지:
1. **1.7B — 고품질 (Recommended)** -- "더 자연스럽고 정확한 음성. VRAM ~4GB 사용. (GPU: {gpu.name}, {gpu.vram_gb}GB)"
2. **0.6B — 경량** -- "빠른 생성, 낮은 VRAM 사용. 품질은 다소 낮음."

**VRAM < 8GB인 경우:**

선택지:
1. **0.6B — 경량 (Recommended)** -- "GPU 메모리에 적합한 경량 모델. (GPU: {gpu.name}, {gpu.vram_gb}GB)"
2. **1.7B — 고품질** -- "⚠ GPU 메모리가 부족할 수 있습니다 ({gpu.vram_gb}GB). 시도는 가능하나 OOM 위험."

선택 결과를 `MODEL_SIZE` 변수로 저장합니다 (`0.6B` 또는 `1.7B`).

`MODEL_NAME`을 `VOICE_MODE` + `MODEL_SIZE` 조합으로 결정합니다:
- clone + 0.6B → `Qwen/Qwen3-TTS-12Hz-0.6B-Base`
- clone + 1.7B → `Qwen/Qwen3-TTS-12Hz-1.7B-Base`
- custom + 0.6B → `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`
- custom + 1.7B → `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`

### 4단계: 팩 정보 수집 + 보일러플레이트 생성

#### 4-a. 팩 이름 입력

AskUserQuestion으로 질문합니다:

"새 TTS 사운드 팩의 이름을 입력해주세요. (영문 소문자, 숫자, 하이픈만 사용 가능)"

선택지:
1. **my-voice** -- "예시 이름입니다. 원하는 이름을 직접 입력해주세요."
2. **tts-korean** -- "예시 이름입니다. 원하는 이름을 직접 입력해주세요."

**이름 형식 검증:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate-name 'PACK_NAME'
```

- `valid: true` 시: 중복 검사로 진행
- `valid: false` 시: `errors` 배열의 각 항목을 사용자에게 표시하고 다시 이름 입력을 요청합니다.

**이름 중복 검사:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" check-exists 'PACK_NAME'
```

- **내장 팩과 동일 시**: "내장 팩 'PACK_NAME'과 같은 이름입니다. 사용자 팩이 우선 적용되어 내장 팩을 덮어씁니다." 경고를 표시합니다. 계속 진행할지 AskUserQuestion으로 확인합니다.
- **기존 사용자 팩과 동일 시**: "이미 'PACK_NAME' 사용자 팩이 존재합니다." 안내 후, AskUserQuestion으로 덮어쓰기 여부를 확인합니다.
  1. **덮어쓰기** -- "기존 팩을 대체합니다."
  2. **다른 이름 사용** -- "다시 이름을 입력합니다."
  "다른 이름 사용" 선택 시 4-a로 돌아갑니다.

#### 4-b. 표시 이름 입력

AskUserQuestion으로 질문합니다:

"사운드 팩의 표시 이름을 입력해주세요. (한글/영문, 사용자에게 보여지는 이름)"

선택지:
1. **나의 TTS 사운드** -- "예시입니다. 원하는 이름을 직접 입력해주세요."
2. **My Voice Pack** -- "예시입니다. 원하는 이름을 직접 입력해주세요."

#### 4-c. 설명 입력

AskUserQuestion으로 질문합니다:

"사운드 팩의 설명을 입력해주세요."

선택지:
1. **Qwen3-TTS로 생성한 커스텀 음성 알림** -- "예시입니다. 원하는 설명을 직접 입력해주세요."
2. **건너뛰기** -- "설명 없이 진행합니다."

"건너뛰기" 선택 시 description을 빈 문자열로 설정합니다.

#### 4-d. 자동 설정 필드 감지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" detect-author
```

- `version`: 항상 `"1.0.0"`
- `author`: `git config user.name` → 실패 시 `os.userInfo().username`

#### 4-e. 보일러플레이트 생성

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" create 'PACK_NAME' 'DISPLAY_NAME' 'AUTHOR' 'DESCRIPTION' --project --cwd "$(pwd)"
```

생성 결과를 사용자에게 안내합니다:
```
팩 디렉토리가 생성되었습니다: .dding-dong/packs/PACK_NAME/
```

`PACK_DIR`을 `.dding-dong/packs/PACK_NAME`으로 설정합니다 (CWD 기준 상대경로).

### 5단계: 음성 설정

`VOICE_MODE`에 따라 분기합니다.

#### 5-A. 보이스 클로닝 모드 (`clone`)

##### 5-A-a. 참조 음성 파일

AskUserQuestion으로 질문합니다:

"보이스 클로닝을 위한 참조 음성 파일이 필요합니다."

선택지에 앞서 안내 메시지를 표시합니다:
```
권장 사양:
- 형식: WAV 또는 MP3
- 길이: 3초 이상 (10~30초 권장)
- 내용: 깨끗한 음성 (배경 소음 최소화)
- 한 사람의 목소리만 포함
```

"참조 음성 파일의 절대 경로를 입력해주세요."

선택지:
1. **파일 경로 입력** -- "WAV/MP3 파일의 절대 경로를 입력합니다."

사용자가 Other로 경로를 입력하면 즉시 검증합니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/validate-ref-audio.mjs" 'FILE_PATH'
```

- **`ok: true`**: 포맷 정보를 표시합니다. 참조 음성을 팩 디렉토리에 복사합니다:
  ```bash
  cp 'FILE_PATH' 'PACK_DIR/ref-audio.EXT'
  ```
  (EXT는 원본 파일의 확장자를 유지: .wav, .mp3 등)
  `REF_AUDIO`를 `PACK_DIR/ref-audio.EXT`로 설정합니다.
- **`ok: false`**: 에러 메시지를 표시하고 다시 파일 경로 입력을 요청합니다.

##### 5-A-b. 참조 텍스트(트랜스크립트)

팩 디렉토리에 트랜스크립트 템플릿 파일을 생성합니다 (에디터에서 바로 편집 가능):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/ref-text.mjs" create 'PACK_DIR/ref-text.txt'
```

사용자에게 안내합니다:
```
참조 음성의 트랜스크립트 파일이 생성되었습니다:
  PACK_DIR/ref-text.txt

파일을 열어 참조 음성에서 말하는 내용을 입력해주세요.
트랜스크립트가 정확할수록 클로닝 품질이 높아집니다.
없이 진행하려면 파일을 비워두세요 (x-vector 모드).
```

AskUserQuestion으로 질문합니다:

"트랜스크립트 작성이 완료되면 알려주세요."

선택지:
1. **작성 완료** -- "ref-text.txt에 트랜스크립트를 입력했습니다."
2. **없이 진행 (x-vector 모드)** -- "트랜스크립트 없이 진행합니다. 음성 특징만 추출하며, 품질이 다소 저하될 수 있습니다."

**"작성 완료" 선택 시:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/ref-text.mjs" read 'PACK_DIR/ref-text.txt'
```

결과 JSON의 `text` 필드를 `REF_TEXT`에 저장합니다.
`empty: true`이면 "없이 진행"과 동일하게 처리합니다.

**"없이 진행" 선택 시:** `REF_TEXT`를 빈 문자열로 설정합니다. `PACK_DIR/ref-text.txt`는 삭제하지 않고 보존합니다 (x-vector 모드임을 기록).

#### 5-B. CustomVoice 모드 (`custom`)

AskUserQuestion으로 질문합니다:

"내장 음성을 선택해주세요."

선택지:
1. **Sohee (Recommended)** -- "한국어 여성 음성. 따뜻하고 감성이 풍부합니다."
2. **Ryan** -- "영어 남성 음성."
3. **Aiden** -- "영어 남성 음성."
4. **Ono_Anna** -- "일본어 여성 음성."

> 참고: 중국어 음성(Vivian, Serena, Uncle_Fu, Dylan, Eric)은 한국어 텍스트에 적합하지 않아 기본 선택지에서 제외합니다.
> 사용자가 Other로 직접 입력하면 모든 화자명을 수용합니다.

선택 결과를 `SPEAKER` 변수에 저장합니다.

### 6단계: 이벤트별 TTS 설정

5개 이벤트에 대해 텍스트(및 CustomVoice 모드에서는 감정/스타일)를 설정합니다.

**기본 한국어 텍스트 및 감정:**

| 이벤트 | 기본 텍스트 | 기본 감정(instruct) |
|--------|-----------|---------------------|
| `task.complete` | "작업이 완료되었습니다!" | "밝고 활기찬 어조로" |
| `task.error` | "오류가 발생했습니다." | "긴급하고 주의를 끄는 어조로" |
| `input.required` | "입력이 필요합니다." | "부드럽고 안내하는 어조로" |
| `session.start` | "세션을 시작합니다." | "차분하고 환영하는 어조로" |
| `session.end` | "세션이 종료됩니다." | "차분하고 마무리하는 어조로" |

> **참고**: 감정(instruct)은 **CustomVoice 모드에서만 적용**됩니다.
> 보이스 클로닝 모드는 참조 음성의 음색만 복제하며, 감정 제어를 지원하지 않습니다.

먼저 안내를 표시합니다:

**클로닝 모드:**
```
이벤트별 TTS 텍스트를 설정합니다.
각 이벤트에 대해 읽어줄 텍스트를 지정할 수 있습니다.
(보이스 클로닝 모드에서는 감정/스타일 제어가 지원되지 않습니다.)
기본값은 한국어 텍스트입니다.
```

**CustomVoice 모드:**
```
이벤트별 TTS 텍스트를 설정합니다.
각 이벤트에 대해 읽어줄 텍스트와 감정/스타일을 지정할 수 있습니다.
기본값은 한국어 텍스트입니다.
```

#### 클로닝 모드 (`clone`)

각 이벤트(5개)에 대해 순서대로 AskUserQuestion으로 질문합니다:

"[이벤트 설명] (`EVENT_TYPE`) — 기본: 「DEFAULT_TEXT」"

선택지:
1. **기본 텍스트 사용 (Recommended)** -- "「DEFAULT_TEXT」"
2. **직접 입력** -- "텍스트를 직접 설정합니다."
3. **건너뛰기** -- "이 이벤트에 사운드를 할당하지 않습니다."

**"직접 입력" 선택 시:** 사용자가 Other로 입력한 텍스트를 저장합니다.

> 보이스 클로닝 모드에서는 감정/스타일 제어가 지원되지 않으므로 instruct를 수집하지 않습니다.

#### CustomVoice 모드 (`custom`)

각 이벤트(5개)에 대해 순서대로 AskUserQuestion으로 질문합니다:

"[이벤트 설명] (`EVENT_TYPE`) — 기본: 「DEFAULT_TEXT」"

선택지:
1. **기본 텍스트 사용 (Recommended)** -- "「DEFAULT_TEXT」 + 「DEFAULT_INSTRUCT」"
2. **직접 입력** -- "텍스트와 감정/스타일을 직접 설정합니다."
3. **건너뛰기** -- "이 이벤트에 사운드를 할당하지 않습니다."

**"직접 입력" 선택 시:**

1단계 — 텍스트: 사용자가 Other로 입력한 텍스트를 저장합니다.

2단계 — AskUserQuestion으로 감정/스타일을 질문합니다:

"감정 또는 스타일을 지정하세요. (선택사항, 자연어로 입력)"

선택지:
1. **기본 감정 사용 (Recommended)** -- "「DEFAULT_INSTRUCT」"
2. **직접 입력** -- "원하는 감정/스타일을 자연어로 입력합니다. (예: '화난 어조로', '속삭이듯이')"
3. **없음** -- "감정 지정 없이 기본 톤으로 생성합니다."

#### `.tts-config.json` 저장

모든 이벤트 설정이 끝나면 `.tts-config.json`을 팩 디렉토리에 저장합니다.

**클로닝 모드** (instruct 없음):
```json
{
  "voice_mode": "clone",
  "model": "MODEL_NAME",
  "ref_audio": "ref-audio.EXT",
  "ref_text": "참조 텍스트",
  "events": {
    "task.complete": {
      "text": "작업이 완료되었습니다!",
      "language": "Korean",
      "output_file": "complete.wav"
    }
  }
}
```

**CustomVoice 모드** (instruct 포함):
```json
{
  "voice_mode": "custom",
  "model": "MODEL_NAME",
  "speaker": "Sohee",
  "events": {
    "task.complete": {
      "text": "작업이 완료되었습니다!",
      "instruct": "밝고 활기찬 어조로",
      "language": "Korean",
      "output_file": "complete.wav"
    }
  }
}
```

Write 도구로 `PACK_DIR/.tts-config.json`에 저장합니다.

**건너뛴 이벤트는 `events` 객체에 포함하지 않습니다.**

### 7단계: 음성 미리듣기

최소 1개 이벤트가 설정된 경우에만 진행합니다.

AskUserQuestion으로 질문합니다:

"전체 생성 전에 미리듣기 샘플을 만들어볼까요? 설정된 첫 번째 이벤트로 1개 샘플을 생성합니다. (모델 로딩에 시간이 걸릴 수 있습니다)"

선택지:
1. **미리듣기 (Recommended)** -- "1개 샘플을 생성하고 재생합니다."
2. **건너뛰기** -- "바로 전체 생성으로 진행합니다."

**"미리듣기" 선택 시:**

설정된 첫 번째 이벤트의 텍스트(및 CustomVoice 모드에서는 감정)를 사용합니다.

**클로닝 모드:**
```bash
'PYTHON_PATH' "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/generate-tts.py" \
  --voice-mode clone \
  --mode preview \
  --model 'MODEL_NAME' \
  --ref-audio 'REF_AUDIO' \
  --ref-text 'REF_TEXT' \
  --text 'PREVIEW_TEXT' \
  --language Korean \
  --output 'PACK_DIR/preview.wav'
```

**CustomVoice 모드:**
```bash
'PYTHON_PATH' "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/generate-tts.py" \
  --voice-mode custom \
  --mode preview \
  --model 'MODEL_NAME' \
  --speaker 'SPEAKER' \
  --text 'PREVIEW_TEXT' \
  --instruct 'PREVIEW_INSTRUCT' \
  --language Korean \
  --output 'PACK_DIR/preview.wav'
```

타임아웃: 600초 (모델 로딩 + 생성 시간 고려)

생성 성공 시 미리듣기 재생:
```bash
DDING_DONG_PACK='PACK_NAME' node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" play 'PACK_DIR/preview.wav'
```

> notify.mjs에 `play` 서브커맨드가 없으면 platform.mjs의 플레이어를 직접 사용:
> ```bash
> node -e "import('${CLAUDE_PLUGIN_ROOT}/scripts/core/platform.mjs').then(m => m.detect()).then(p => { const {execSync} = require('child_process'); execSync(p.audioPlayer + ' PACK_DIR/preview.wav'); })"
> ```

AskUserQuestion으로 질문합니다:

"미리듣기 결과가 만족스러우신가요?"

선택지:
1. **좋아요, 전체 생성 (Recommended)** -- "이 음성으로 모든 이벤트를 생성합니다."
2. **다시 시도** -- "설정을 변경하고 다시 시도합니다."
3. **중단** -- "TTS 팩 생성을 취소합니다."

"다시 시도" 선택 시: 5단계(음성 설정)로 돌아갑니다.
"중단" 선택 시: "TTS 팩 생성이 취소되었습니다." 안내 후 종료합니다.

### 8단계: 전체 생성

**클로닝 모드:**
```bash
'PYTHON_PATH' "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/generate-tts.py" \
  --voice-mode clone \
  --mode batch \
  --model 'MODEL_NAME' \
  --ref-audio 'REF_AUDIO' \
  --ref-text 'REF_TEXT' \
  --config 'PACK_DIR/.tts-config.json' \
  --output-dir 'PACK_DIR'
```

**CustomVoice 모드:**
```bash
'PYTHON_PATH' "${CLAUDE_PLUGIN_ROOT}/skills/dd-tts-pack/scripts/generate-tts.py" \
  --voice-mode custom \
  --mode batch \
  --model 'MODEL_NAME' \
  --speaker 'SPEAKER' \
  --config 'PACK_DIR/.tts-config.json' \
  --output-dir 'PACK_DIR'
```

타임아웃: 600초 (5개 이벤트 생성 + 모델 로딩)

stdout으로 JSON 결과를 파싱합니다:

```json
{
  "ok": true,
  "results": {
    "task.complete": { "ok": true, "file": "complete.wav", "duration": 1.2 },
    "task.error": { "ok": true, "file": "error.wav", "duration": 1.1 }
  }
}
```

진행 상황을 사용자에게 표시합니다:
```
TTS 생성이 완료되었습니다.

  task.complete    complete.wav        ✓ (1.2초)
  task.error       error.wav           ✓ (1.1초)
  input.required   input-required.wav  ✓ (1.3초)
  session.start    session-start.wav   ✓ (1.0초)
  session.end      session-end.wav     ✓ (1.1초)
```

실패한 이벤트가 있으면:
```
⚠ 일부 이벤트 생성에 실패했습니다:
  task.error: [에러 메시지]

성공한 이벤트만으로 팩을 계속 생성하시겠습니까?
```

AskUserQuestion:
1. **계속 진행** -- "성공한 이벤트만으로 팩을 생성합니다."
2. **다시 시도** -- "실패한 이벤트를 다시 생성합니다."
3. **중단** -- "팩 생성을 취소합니다."

### 9단계: 검증 + 팩 등록

#### 9-a. manifest.json 업데이트

생성된 WAV 파일에 맞게 manifest.json을 업데이트합니다.
`results`에서 `ok: true`인 이벤트만 등록합니다:

각 성공 이벤트에 대해:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" copy-sound 'PACK_DIR/OUTPUT_FILE' 'PACK_NAME' 'EVENT_TYPE' 'OUTPUT_FILE' --project --cwd "$(pwd)"
```

> 참고: generate-tts.py가 이미 PACK_DIR에 직접 저장하므로, copy-sound는 manifest 업데이트 역할만 합니다.
> copy-sound가 동일 경로 복사를 지원하지 않으면, manifest.json을 직접 Read → 수정 → Write합니다.

#### 9-b. 매니페스트 검증

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate-manifest 'PACK_NAME' --cwd "$(pwd)"
```

- `valid: true` 시: 다음 단계로 진행
- `valid: false` 시: `errors` 배열의 각 항목을 표시하고, manifest.json을 Read하여 문제 확인 후 수정

#### 9-c. 파일 검증

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" validate 'PACK_NAME' --cwd "$(pwd)"
```

결과를 아래 형식으로 사용자에게 표시합니다:

```
TTS 사운드 팩이 생성되었습니다!

이름: PACK_NAME
표시 이름: DISPLAY_NAME
작성자: AUTHOR
모드: 보이스 클로닝 / CustomVoice (SPEAKER)
위치: .dding-dong/packs/PACK_NAME/

이벤트           파일                상태
─────────────────────────────────────────
task.complete    complete.wav        ✓
task.error       error.wav           ✓
input.required   input-required.wav  ✓
session.start    session-start.wav   ✓
session.end      session-end.wav     ✓

등록된 이벤트: 5/5
```

상태 표시:
- `ok` → `✓`
- `skipped` → `-` (파일 열에 "(없음)" 표시)
- `missing` → `✗ 파일 없음`
- `invalid_format` → `✗ WAV 아님`

`missing` 또는 `invalid_format`이 있으면 경고를 표시합니다:
"일부 파일에 문제가 있습니다. 팩이 정상 동작하지 않을 수 있습니다."

### 10단계: 적용 + 미리듣기 + 완료

#### 10-a. 적용 여부 확인

AskUserQuestion으로 질문합니다:

"이 팩을 지금 바로 적용하시겠습니까?"

선택지:
1. **바로 적용 (Recommended)** -- "현재 설정의 사운드 팩을 변경합니다."
2. **나중에 적용** -- "팩만 생성하고 종료합니다. 나중에 `/dding-dong:dd-sounds use PACK_NAME`으로 적용할 수 있습니다."

**"바로 적용" 선택 시:**

AskUserQuestion으로 스코프를 질문합니다:

"사운드 팩을 어디에 적용하시겠습니까?"

선택지:
1. **프로젝트 로컬 (Recommended)** -- "이 프로젝트에서만 적용, 개인 설정 (.dding-dong/config.local.json). 글로벌·프로젝트 설정보다 우선합니다. gitignored."
2. **프로젝트 (팀 공유)** -- "이 프로젝트의 팀 전체에 적용 (.dding-dong/config.json). 글로벌 설정보다 우선합니다. 커밋됩니다."
3. **글로벌** -- "모든 프로젝트에 적용 (~/.config/dding-dong/config.json). 프로젝트/로컬 설정이 있으면 그쪽이 우선합니다."

선택 결과를 `SCOPE`로 저장합니다 ("프로젝트 로컬" → `local`, "프로젝트" → `project`, "글로벌" → `global`).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pack-wizard.mjs" apply 'PACK_NAME' --scope '${SCOPE}' --cwd "$(pwd)"
```

적용 성공 시: "사운드 팩이 'PACK_NAME'으로 변경되었습니다. (스코프: SCOPE)" 안내

**"나중에 적용" 선택 시:**

```
팩이 생성되었습니다. 아래 명령어로 나중에 적용할 수 있습니다:
  /dding-dong:dd-sounds use PACK_NAME               # 글로벌 (기본)
  /dding-dong:dd-sounds use PACK_NAME --scope local  # 프로젝트 로컬
```

#### 10-b. 미리듣기

10-a에서 "바로 적용"을 선택한 경우에만 미리듣기를 제안합니다.

AskUserQuestion으로 질문합니다:

"사운드를 미리 들어보시겠습니까?"

선택지:
1. **예 (Recommended)** -- "task.complete 사운드를 재생합니다."
2. **아니오** -- "바로 종료합니다."

**"예" 선택 시:**

```bash
DDING_DONG_PACK='PACK_NAME' node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

재생 실패 시: "미리듣기에 실패했습니다. `/dding-dong:dd-test`로 다시 시도해보세요." 안내

#### 10-c. 완료 메시지

```
TTS 사운드 팩 생성이 완료되었습니다!

관련 명령어:
  사운드 팩 관리  → /dding-dong:dd-sounds list
  팩 미리듣기    → /dding-dong:dd-sounds preview PACK_NAME
  팩 변경       → /dding-dong:dd-sounds use PACK_NAME
  설정 확인     → /dding-dong:dd-config show
  TTS 재생성    → .tts-config.json이 팩 디렉토리에 저장되어 있습니다.
```

preview.wav는 팩 디렉토리에 보존합니다 (미리듣기 샘플 기록용).
