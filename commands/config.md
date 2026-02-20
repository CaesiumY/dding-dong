---
description: dding-dong 설정 변경
allowed-tools: [Bash, Read, Write]
---

# dding-dong 설정 관리

## 사용법

`$ARGUMENTS` 를 파싱하여 동작을 결정합니다:

### show (기본)
현재 설정을 한국어로 표시합니다.

```bash
node -e "
const fs = require('fs');
const path = require('path');
const configPath = path.join(require('os').homedir(), '.config', 'dding-dong', 'config.json');
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(JSON.stringify(config, null, 2));
} catch(e) {
  console.log('설정 파일이 없습니다. /dding-dong:setup 을 먼저 실행해주세요.');
}
"
```

### set [key] [value]
중첩 키를 dot notation으로 지원 (예: `sound.volume 0.5`, `notification.events.session.start true`)

### reset
설정을 기본값으로 복원합니다. 사용자에게 확인 후 실행합니다.
