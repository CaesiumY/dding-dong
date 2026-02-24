import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { detectPlatform, detectAudioPlayer } from './platform.mjs';
import { getPacksDir, findProjectRoot, getProjectPacksDir } from './config.mjs';

/**
 * 사운드 팩 manifest에서 이벤트에 해당하는 파일 경로 반환
 * @param {string} eventType
 * @param {string} packName
 * @param {string|null} cwd
 * @returns {string|null}
 */
function resolveSound(eventType, packName = 'default', cwd = null) {
  const searchPaths = [];

  // 1. 프로젝트 팩 (최우선)
  if (cwd) {
    const projectRoot = findProjectRoot(cwd);
    if (projectRoot) {
      searchPaths.push(join(getProjectPacksDir(projectRoot), packName, 'manifest.json'));
    }
  }

  // 2. 사용자 글로벌 팩
  searchPaths.push(join(getPacksDir(), packName, 'manifest.json'));

  // 3. 내장 팩
  searchPaths.push(join(process.env.CLAUDE_PLUGIN_ROOT || '', 'sounds', packName, 'manifest.json'));

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
export async function playSound(eventType, config, cwd = null) {
  try {
    const platform = detectPlatform();
    const player = detectAudioPlayer(platform);
    if (!player) return;

    const packName = config?.sound?.pack || 'default';
    const volume = config?.sound?.volume ?? 0.7;

    const filePath = resolveSound(eventType, packName, cwd);
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

/**
 * 임의의 WAV 파일을 동기적으로 재생 (CLI 미리듣기용)
 * detached+unref 없이 완료까지 대기합니다.
 * @param {string} filePath - 재생할 파일의 절대 경로
 * @param {number} [volume=1.0] - 볼륨 (0.0~1.0)
 */
export function playFile(filePath, volume = 1.0) {
  try {
    const platform = detectPlatform();
    const player = detectAudioPlayer(platform);
    if (!player) return;

    if (platform === 'macos') {
      execFileSync('afplay', ['-v', String(volume), filePath], { stdio: 'ignore' });
      return;
    }

    if (platform === 'wsl') {
      let winPath;
      try {
        winPath = execFileSync('wslpath', ['-w', filePath], {
          stdio: ['pipe', 'pipe', 'ignore']
        }).toString().trim();
      } catch { return; }

      const ps = `
Add-Type -AssemblyName PresentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([Uri]::new('${winPath.replace(/\\/g, '\\\\')}'))
$p.Volume = ${volume}
$p.Play()
Start-Sleep -Milliseconds 3000
$p.Close()
`.trim();

      execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
      return;
    }

    if (platform === 'linux') {
      const args = _linuxArgs(player.name, filePath, volume);
      execFileSync(player.path, args, { stdio: 'ignore' });
      return;
    }
  } catch {
    // 재생 실패는 무시
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
