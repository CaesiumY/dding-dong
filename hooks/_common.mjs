import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

/**
 * Hook 공통 실행 유틸
 * stdin에서 event JSON 읽기 -> notify() 호출 -> 선택적 stdout 응답
 *
 * @param {string} eventType - 'task.complete' | 'task.error' | 'input.required' | 'session.start' | 'session.end'
 * @param {object} [options]
 * @param {object} [options.respond] - stdout에 JSON으로 쓸 응답 객체 (예: { decision: 'continue' })
 */
export async function runHook(eventType, options = {}) {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
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
    process.exit(0);
  }
}
