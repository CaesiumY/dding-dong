---
name: dd-sounds
description: "Manage dding-dong sound packs. Supports list, use, preview commands. 사운드 팩 관리."
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
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '.';
const builtinDir = join(pluginRoot, 'sounds');
const userDir = join(homedir(), '.config', 'dding-dong', 'packs');
const packs = [];
for (const dir of [builtinDir, userDir]) {
  try {
    for (const name of readdirSync(dir)) {
      const mf = join(dir, name, 'manifest.json');
      if (existsSync(mf)) {
        const m = JSON.parse(readFileSync(mf, 'utf8'));
        packs.push({ name: m.name, displayName: m.displayName, dir, version: m.version });
      }
    }
  } catch {}
}
console.log(JSON.stringify(packs, null, 2));
"
```

현재 선택된 팩에 ✓ 표시.

### use [팩 이름]
사운드 팩을 변경합니다. config.json의 sound.pack을 업데이트.

### preview [팩 이름]
팩의 각 이벤트 사운드를 순서대로 재생합니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test-sound [팩 이름]
```
