---
name: dd-doctor
description: "Diagnose dding-dong notification issues. Checks environment, config, sound files, and runs test notifications. 알림 문제 진단."
allowed-tools: [Bash(node *), Read, Glob, Grep]
context: fork
---

# dding-dong doctor

알림이 정상 작동하지 않을 때 원인을 분석합니다.

## 진단 순서

### 1. 환경 감지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" detect --cwd "$(pwd)"
```

결과를 분석하여 플랫폼, 사운드 플레이어, 알림 도구 상태를 확인합니다.

### 1-b. 셋업 완료 여부 확인

설정에 `_meta.setupCompleted` 필드가 있는지 확인합니다:

```bash
node --input-type=module -e "
import { loadConfig } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
const config = loadConfig(process.cwd());
if (config._meta?.setupCompleted) {
  console.log('셋업 완료:', config._meta.setupDate || '날짜 불명');
} else {
  console.log('셋업 미완료: /dding-dong:dd-setup 실행을 권장합니다');
}
"
```

### 2. 설정 상태 확인

```bash
node --input-type=module -e "
import { loadConfig, getConfigFile, findProjectRoot, getProjectConfigFile } from '${CLAUDE_PLUGIN_ROOT}/scripts/core/config.mjs';
import { existsSync } from 'node:fs';
const cwd = process.cwd();
const config = loadConfig(cwd);
const globalPath = getConfigFile();
const projectRoot = findProjectRoot(cwd);
const projectPath = projectRoot ? getProjectConfigFile(projectRoot) : null;
console.log(JSON.stringify({
  config,
  paths: { global: globalPath, project: projectPath },
  exists: { global: existsSync(globalPath), project: projectPath ? existsSync(projectPath) : false }
}, null, 2));
"
```

### 3. 사운드 파일 존재 확인

설정에서 사용 중인 사운드 팩의 manifest.json과 WAV 파일이 존재하는지 확인합니다.

### 4. 테스트 알림 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" test task.complete
```

### 5. 진단 결과 요약

발견된 문제와 해결 방법을 한국어로 정리하여 보고합니다:
- 환경 문제 (플레이어/알림도구 미설치)
- 설정 문제 (비활성화, 이벤트 OFF)
- 파일 문제 (사운드 파일 누락)
- 권한 문제 (실행 권한 부족)
