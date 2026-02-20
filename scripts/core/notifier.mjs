import { execFile, spawn } from 'node:child_process';
import { detectPlatform, detectNotifier } from './platform.mjs';

/**
 * OS 네이티브 알림 전송
 * @param {string} title
 * @param {string} message
 * @param {string} [platform]
 */
export async function sendNotification(title, message, platform) {
  try {
    platform = platform || detectPlatform();
    const notifier = detectNotifier(platform);

    if (platform === 'macos') {
      await _execAsync('osascript', [
        '-e',
        `display notification "${_escape(message)}" with title "${_escape(title)}"`
      ]);
      return;
    }

    if (platform === 'linux') {
      if (!notifier) return;
      await _execAsync(notifier.path, ['-a', title, title, message]);
      return;
    }

    if (platform === 'wsl') {
      // 1순위: wsl-notify-send
      if (notifier?.name === 'wsl-notify-send') {
        await _execAsync(notifier.path, ['--category', title, title, message]);
        return;
      }

      // 2순위: WinRT PowerShell (백그라운드 detached - 5초 타임아웃 회피)
      const ps = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent('ToastText02')
$t.SelectSingleNode('//text[@id=1]').InnerText = '${_escapePosh(title)}'
$t.SelectSingleNode('//text[@id=2]').InnerText = '${_escapePosh(message)}'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('PowerShell').Show([Windows.UI.Notifications.ToastNotification]::new($t))
`.trim();

      const child = spawn('powershell.exe', ['-NoProfile', '-Command', ps], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return;
    }
  } catch {
    // 알림 실패는 무시 - Claude를 중단시키지 않음
  }

  // 3순위 폴백: 터미널 벨
  try {
    process.stdout.write('\x07');
  } catch {}
}

function _execAsync(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000 }, () => resolve());
  });
}

function _escape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _escapePosh(str) {
  return String(str).replace(/'/g, "''");
}
