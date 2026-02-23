#!/usr/bin/env node

/**
 * 참조 텍스트(트랜스크립트) 템플릿 생성 및 파싱
 *
 * 사용법:
 *   node ref-text.mjs create <output-path>   # 템플릿 파일 생성
 *   node ref-text.mjs read <file-path>        # 파일 읽기 + 주석 제거
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const TEMPLATE = `# 참조 음성 트랜스크립트
# 아래에 참조 음성에서 말하는 내용을 정확히 입력해주세요.
# 정확할수록 보이스 클로닝 품질이 높아집니다.
# 트랜스크립트 없이 진행하려면 이 파일을 비워두세요.
#
# 예시: 안녕하세요, 오늘도 좋은 하루 보내세요.

`;

function json(obj) {
  console.log(JSON.stringify(obj));
}

function jsonError(msg) {
  json({ ok: false, error: msg });
  process.exit(0);
}

const [cmd, filePath] = process.argv.slice(2);

if (!cmd || !['create', 'read'].includes(cmd)) {
  jsonError('사용법: ref-text.mjs create <path> | read <path>');
}

if (!filePath) {
  jsonError('파일 경로가 필요합니다.');
}

if (cmd === 'create') {
  try {
    writeFileSync(filePath, TEMPLATE, 'utf-8');
    json({ ok: true, path: filePath });
  } catch (e) {
    jsonError(`파일 생성 실패: ${e.message}`);
  }
}

if (cmd === 'read') {
  if (!existsSync(filePath)) {
    jsonError('파일이 존재하지 않습니다.');
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const text = raw
      .split('\n')
      .filter(line => !line.startsWith('#'))
      .join('\n')
      .trim();

    json({ ok: true, text, empty: text.length === 0 });
  } catch (e) {
    jsonError(`파일 읽기 실패: ${e.message}`);
  }
}
