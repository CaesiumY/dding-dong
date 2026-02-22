---
name: dd-sounds
description: "Manage dding-dong sound packs. Supports list, use, preview commands. 사운드 팩 관리. Use when the user says '사운드 변경', 'change sound', '팩 목록', 'sound pack'."
allowed-tools: [Bash, Read]
disable-model-invocation: true
---

# dding-dong 사운드 팩 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### list (기본)
설치된 사운드 팩 목록을 표시합니다.

```bash
node --input-type=module -e "
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const builtinDir = join('${CLAUDE_PLUGIN_ROOT}', 'sounds');
const userDir = join(homedir(), '.config', 'dding-dong', 'packs');
const config = loadConfig(process.cwd());
const currentPack = config.sound?.pack || 'default';
const packs = [];
for (const [dir, type] of [[builtinDir, 'built-in'], [userDir, 'user']]) {
  try {
    for (const name of readdirSync(dir)) {
      const mf = join(dir, name, 'manifest.json');
      if (existsSync(mf)) {
        const m = JSON.parse(readFileSync(mf, 'utf8'));
        packs.push({ name: m.name, displayName: m.displayName, type, active: m.name === currentPack, version: m.version });
      }
    }
  } catch {}
}
console.log(JSON.stringify(packs, null, 2));
"
```

결과를 테이블로 표시합니다. 현재 선택된 팩에 ✓ 표시:

| 팩 이름 | 표시 이름 | 구분 | 사용 중 |
|---------|----------|------|:------:|
| `name` | `displayName` | 내장/사용자 | ✓/- |

### use [팩 이름]
사운드 팩을 변경합니다.

```bash
node --input-type=module -e "
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { saveConfig, getConfigFile } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const packName = process.argv[1];
if (!packName) { console.error('사용법: use <팩 이름>'); process.exit(1); }
const builtinDir = join('${CLAUDE_PLUGIN_ROOT}', 'sounds');
const userDir = join(homedir(), '.config', 'dding-dong', 'packs');
const found = [join(builtinDir, packName), join(userDir, packName)].some(d => existsSync(join(d, 'manifest.json')));
if (!found) { console.error(JSON.stringify({ error: 'not_found', pack: packName })); process.exit(1); }
const configFile = getConfigFile();
let globalConfig = {};
try { globalConfig = JSON.parse(readFileSync(configFile, 'utf8')); } catch {}
const meta = globalConfig._meta; delete globalConfig._meta;
if (!globalConfig.sound) globalConfig.sound = {};
globalConfig.sound.pack = packName;
if (meta) globalConfig._meta = meta;
saveConfig(globalConfig, 'global');
console.log(JSON.stringify({ success: true, pack: packName }));
" '${PACK_NAME}'
```

`${PACK_NAME}`은 사용자가 지정한 팩 이름으로 치환합니다.

- 성공 시: "`[팩 이름]` 사운드 팩으로 변경했습니다."
- 팩 미존재 시 (exit code 1): "팩을 찾을 수 없습니다: `[팩 이름]`. `/dding-dong:dd-sounds list`로 설치된 팩을 확인하세요."

### preview [팩 이름]
팩의 각 이벤트 사운드를 순서대로 재생합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test-sound ${PACK_NAME}
```

`${PACK_NAME}`은 사용자가 지정한 팩 이름으로 치환합니다. 미지정 시 현재 사용 중인 팩을 재생합니다 (`list` 결과에서 `active: true`인 팩 이름을 사용).
