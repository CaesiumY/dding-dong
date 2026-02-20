import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let _cached = null;

export function detectPlatform() {
  if (_cached?.platform) return _cached.platform;
  const p = process.platform;
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  if (p === 'linux') {
    try {
      const ver = readFileSync('/proc/version', 'utf8');
      if (ver.toLowerCase().includes('microsoft')) return 'wsl';
    } catch {}
    return 'linux';
  }
  return 'unknown';
}

function which(cmd) {
  try {
    return execFileSync('which', [cmd], { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch { return null; }
}

export function detectAudioPlayer(platform) {
  if (_cached?.audioPlayer) return _cached.audioPlayer;
  platform = platform || detectPlatform();

  if (platform === 'macos') {
    return { name: 'afplay', path: which('afplay') || 'afplay' };
  }
  if (platform === 'wsl') {
    // WSL: PowerShell MediaPlayer가 1순위 (WSLg 무관)
    return { name: 'powershell-mediaplayer', path: 'powershell.exe' };
  }
  // Linux: 우선순위 체인
  for (const player of ['pw-play', 'paplay', 'ffplay', 'mpv', 'aplay']) {
    const path = which(player);
    if (path) return { name: player, path };
  }
  return null;
}

export function detectNotifier(platform) {
  if (_cached?.notifier) return _cached.notifier;
  platform = platform || detectPlatform();

  if (platform === 'macos') {
    return { name: 'osascript', path: which('osascript') || 'osascript' };
  }
  if (platform === 'linux') {
    const path = which('notify-send');
    return path ? { name: 'notify-send', path } : null;
  }
  if (platform === 'wsl') {
    // WSL 우선순위: wsl-notify-send > WinRT PowerShell > Console::Beep
    const wns = which('wsl-notify-send') || which('wsl-notify-send.exe');
    if (wns) return { name: 'wsl-notify-send', path: wns };
    return { name: 'powershell-winrt', path: 'powershell.exe' };
  }
  return null;
}

export function detectAll() {
  const platform = detectPlatform();
  const audioPlayer = detectAudioPlayer(platform);
  const notifier = detectNotifier(platform);
  _cached = { platform, audioPlayer, notifier };
  return _cached;
}
