#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

const PLUGIN_JSON = resolve(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
const dryRun = process.argv.includes('--dry-run');

// --- helpers ---

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: PLUGIN_ROOT, encoding: 'utf8', ...opts }).trim();
}

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

// --- main ---

// 1. Read version from plugin.json
const version = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8')).version;
const tag = `v${version}`;

// 2. Verify version consistency (sync-version.mjs verify)
try {
  const verifyResult = run('node scripts/sync-version.mjs verify');
  const parsed = JSON.parse(verifyResult);
  if (!parsed.consistent) {
    fail(`버전 불일치 감지. 먼저 'node scripts/sync-version.mjs sync'를 실행하세요.\n${verifyResult}`);
  }
} catch (e) {
  if (e.status) fail('버전 검증 실패. sync-version.mjs verify가 실패했습니다.');
  throw e;
}

// 3. Check for duplicate tag
const tagExists = (() => {
  try { run(`git rev-parse refs/tags/${tag}`, { stdio: ['pipe', 'pipe', 'pipe'] }); return true; } catch { return false; }
})();
if (tagExists) fail(`태그 '${tag}'가 이미 존재합니다.`);

// 4. Dry run exits early (before clean check)
if (dryRun) {
  const status = run('git status --porcelain');
  process.stdout.write(JSON.stringify({
    dryRun: true,
    version,
    tag,
    message: `Release ${tag}`,
    dirty: status.length > 0,
    actions: [
      `git tag -a ${tag} -m "Release ${tag}"`,
      `git push origin ${tag}`,
    ],
  }, null, 2) + '\n');
  process.exit(0);
}

// 5. Check working tree is clean
const status = run('git status --porcelain');
if (status) {
  fail(`워킹 트리가 깨끗하지 않습니다. 먼저 변경 사항을 커밋하세요.\n${status}`);
}

// 6. Create annotated tag
run(`git tag -a ${tag} -m "Release ${tag}"`);

// 7. Push tag
run(`git push origin ${tag}`);

process.stdout.write(JSON.stringify({
  released: true,
  version,
  tag,
  message: `태그 ${tag}가 생성되고 push되었습니다. GitHub Actions가 릴리즈를 자동 생성합니다.`,
}, null, 2) + '\n');
