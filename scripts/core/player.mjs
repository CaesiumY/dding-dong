import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { detectPlatform, detectAudioPlayer } from './platform.mjs';
import { getPacksDir } from './config.mjs';

/**
 * 사운드 팩 manifest에서 이벤트에 해당하는 파일 경로 반환
 * @param {string} eventType
 * @param {string} packName
 * @returns {string|null}
 */
function resolveSound(eventType, packName = 'default') {
  const packsDir = getPacksDir();
  const manifestPath = join(packsDir, packName, 'manifest.json');

  // 사용자 팩 → 내장 팩 순서로 탐색
  const searchPaths = [
    manifestPath,
    join(process.env.CLAUDE_PLUGIN_ROOT || '', 'sounds', packName, 'manifest.json')
  ];

  let manifest = null;
  let foundManifestPath = null;
  for (const p of searchPaths) {
    try {
      manifest = JSON.parse(readFileSync(p, 'utf8'));
      foundManifestPath = p;
      break;
    } catch {}
  }

  if (!manifest || !foundManifestPath) return null;

  const entry = manifest.events?.[eventType];
  if (!entry) return null;

  // rotation 지원: random이면 랜덤 선택, 없으면 첫 번째
  let filename;
  if (Array.isArray(entry.files)) {
    if (entry.rotation === 'random') {
      filename = entry.files[Math.floor(Math.random() * entry.files.length)];
    } else {
      filename = entry.files[0];
    }
  } else {
    filename = entry;
  }

  // 실제 manifest 위치 기준으로 파일 경로 결합
  const manifestDir = foundManifestPath.replace(/manifest\.json$/, '');
  const filePath = join(manifestDir, filename);
  return existsSync(filePath) ? filePath : null;
}

/**
 * 크로스 플랫폼 사운드 재생
 * @param {string} eventType
 * @param {object} config
 */
export async function playSound(eventType, config) {
  try {
    const platform = detectPlatform();
    const player = detectAudioPlayer(platform);
    if (!player) return;

    const packName = config?.sound?.pack || 'default';
    const volume = config?.sound?.volume ?? 0.7;

    const filePath = resolveSound(eventType, packName);
    if (!filePath) return;

    if (platform === 'macos') {
      spawn('afplay', ['-v', String(volume), filePath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return;
    }

    if (platform === 'wsl') {
      let winPath;
      try {
        winPath = execFileSync('wslpath', ['-w', filePath], {
          stdio: ['pipe', 'pipe', 'ignore']
        }).toString().trim();
      } catch {
        return;
      }

      const ps = `
Add-Type -AssemblyName PresentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([Uri]::new('${winPath.replace(/\\/g, '\\\\')}'))
$p.Volume = ${volume}
$p.Play()
Start-Sleep -Milliseconds 2000
$p.Close()
`.trim();

      spawn('powershell.exe', ['-NoProfile', '-Command', ps], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return;
    }

    if (platform === 'linux') {
      const args = _linuxArgs(player.name, filePath, volume);
      spawn(player.path, args, {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return;
    }
  } catch {
    // 사운드 재생 실패는 무시
  }
}

function _linuxArgs(playerName, filePath, volume) {
  switch (playerName) {
    case 'pw-play':
    case 'paplay':
      return [filePath];
    case 'ffplay':
      return ['-nodisp', '-autoexit', '-volume', String(Math.round(volume * 100)), filePath];
    case 'mpv':
      return [`--volume=${Math.round(volume * 100)}`, '--no-video', filePath];
    case 'aplay':
      return [filePath];
    default:
      return [filePath];
  }
}
