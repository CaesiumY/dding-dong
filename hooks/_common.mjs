import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

// 모듈 스코프: runHook 진입 시 options.respond 캡처
let _safeResponse = null;

// 예상치 못한 에러 시 올바른 응답 후 종료
process.on('uncaughtException', () => {
  if (_safeResponse) process.stdout.write(JSON.stringify(_safeResponse));
  process.exit(0);
});
process.on('unhandledRejection', () => {
  if (_safeResponse) process.stdout.write(JSON.stringify(_safeResponse));
  process.exit(0);
});

// stdin 타임아웃 래퍼 (Linux 행 방지)
function readStdin(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; process.stdin.destroy(); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }, timeoutMs);
    process.stdin.resume();
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    });
    process.stdin.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(''); }
    });
  });
}

/**
 * Hook 공통 실행 유틸
 * stdin에서 event JSON 읽기 -> notify() 호출 -> 선택적 stdout 응답
 *
 * @param {string} eventType - 'task.complete' | 'task.error' | 'input.required' | 'session.start' | 'session.end'
 * @param {object} [options]
 * @param {object} [options.respond] - stdout에 JSON으로 쓸 응답 객체 (예: {})
 */
export async function runHook(eventType, options = {}) {
  _safeResponse = options.respond || null;
  const safetyTimeout = setTimeout(() => {
    if (_safeResponse) process.stdout.write(JSON.stringify(_safeResponse));
    process.exit(0);
  }, 4000);

  try {
    const input = await readStdin();
    const event = JSON.parse(input);

    const { notify } = await import(resolve(PLUGIN_ROOT, 'scripts/notify.mjs'));
    await notify(eventType, {
      sessionId: event.session_id,
      hookEvent: event.hook_event_name,
      cwd: event.cwd || process.cwd()
    });

    if (options.respond) {
      process.stdout.write(JSON.stringify(options.respond));
    }
  } catch {
    // 응답이 필요한 Hook(stop)은 에러 시에도 반드시 응답
    if (options.respond) {
      process.stdout.write(JSON.stringify(options.respond));
    }
  } finally {
    clearTimeout(safetyTimeout);
    process.exit(0);
  }
}
