import { loadConfig, loadState, saveState } from './core/config.mjs';
import { getMessage } from './core/messages.mjs';
import { sendNotification } from './core/notifier.mjs';
import { playSound, playFile } from './core/player.mjs';
import { detectPlatform } from './core/platform.mjs';

/**
 * 야간 모드 체크
 */
function isQuietHours(quietHours) {
  if (!quietHours?.enabled) return false;
  const now = new Date();
  const [sh, sm] = quietHours.start.split(':').map(Number);
  const [eh, em] = quietHours.end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // 야간 범위가 자정을 넘는 경우 처리
  if (start > end) {
    return cur >= start || cur < end;
  }
  return cur >= start && cur < end;
}

/**
 * 쿨다운 체크 - 마지막 알림 이후 cooldown_seconds 이내면 true
 */
function isCoolingDown(state, cooldownSeconds) {
  if (!cooldownSeconds) return false;
  const last = state?.lastNotifiedAt;
  if (!last) return false;
  return Date.now() - last < cooldownSeconds * 1000;
}

/**
 * 통합 알림 엔트리포인트
 * @param {string} eventType - 'task.complete' | 'task.error' | 'input.required' | 'session.start' | 'session.end'
 * @param {object} [context] - 추가 컨텍스트 (message 오버라이드 등)
 */
export async function notify(eventType, context = {}) {
  const config = loadConfig(context.cwd);

  if (!config.enabled) return;
  if (isQuietHours(config.quiet_hours)) return;

  const state = loadState();
  if (isCoolingDown(state, config.cooldown_seconds)) return;

  const title = 'dding-dong';
  const message = context.message || getMessage(eventType, config.language, config.messages);
  const platform = detectPlatform();

  const tasks = [];

  // 사운드 재생
  if (config.sound?.enabled && config.sound?.events?.[eventType] !== false) {
    tasks.push(playSound(eventType, config, context.cwd));
  }

  // OS 알림
  if (config.notification?.enabled && config.notification?.events?.[eventType] !== false) {
    tasks.push(sendNotification(title, message, platform));
  }

  // 하나가 실패해도 다른 것은 계속 실행
  await Promise.allSettled(tasks);

  // 쿨다운 상태 저장
  saveState({ ...state, lastNotifiedAt: Date.now() });
}

// CLI 테스트 모드: node notify.mjs test [이벤트]
if (process.argv[2] === 'test') {
  const validEvents = ['task.complete', 'task.error', 'input.required', 'session.start', 'session.end'];
  const specificEvent = process.argv[3];
  if (specificEvent && !validEvents.includes(specificEvent)) {
    console.error(`알 수 없는 이벤트: ${specificEvent}\n사용 가능: ${validEvents.join(', ')}`);
    process.exit(1);
  }
  const events = specificEvent ? [specificEvent] : validEvents;
  console.log('dding-dong 테스트 모드 시작...');
  for (const ev of events) {
    console.log(`  테스트: ${ev}`);
    await notify(ev, { cwd: process.cwd() });
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('테스트 완료.');
}

// CLI 사운드 팩 미리듣기: node notify.mjs test-sound [팩이름]
if (process.argv[2] === 'test-sound') {
  const packName = process.argv[3] || 'default';
  process.env.DDING_DONG_PACK = packName;
  const soundEvents = ['task.complete', 'task.error', 'input.required', 'session.start', 'session.end'];
  console.log(`dding-dong 사운드 팩 미리듣기: ${packName}`);
  for (const ev of soundEvents) {
    console.log(`  재생: ${ev}`);
    await notify(ev, { message: `${packName} - ${ev}`, cwd: process.cwd() });
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('미리듣기 완료.');
}

// CLI 파일 직접 재생: node notify.mjs play <파일경로>
if (process.argv[2] === 'play') {
  const filePath = process.argv[3];
  if (!filePath) {
    console.error('사용법: node notify.mjs play <파일경로>');
    process.exit(1);
  }
  try {
    playFile(filePath);
  } catch {
    // 재생 실패는 조용히 무시
  }
}
