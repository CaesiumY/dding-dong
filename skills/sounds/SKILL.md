---
name: 사운드 팩 관리
description: "dding-dong 사운드 팩을 관리합니다. list(설치된 팩 목록), use(팩 변경), preview(미리듣기)를 지원합니다."
allowed-tools: [Bash, Read]
disable-model-invocation: true
---

# dding-dong 사운드 팩 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### list (기본)
설치된 사운드 팩 목록을 표시합니다.

```bash
node -e "
const fs = require('fs');
const path = require('path');
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '.';
// 내장 팩
const builtinDir = path.join(pluginRoot, 'sounds');
// 사용자 팩
const userDir = path.join(require('os').homedir(), '.config', 'dding-dong', 'packs');
const packs = [];
for (const dir of [builtinDir, userDir]) {
  try {
    for (const name of fs.readdirSync(dir)) {
      const mf = path.join(dir, name, 'manifest.json');
      if (fs.existsSync(mf)) {
        const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
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
