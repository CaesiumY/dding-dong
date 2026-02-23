#!/usr/bin/env node
/**
 * TTS 환경 검사 스크립트
 * Python 3.12+, qwen-tts 패키지, NVIDIA GPU(CUDA) 가용성을 검사합니다.
 *
 * 사용법: node check-env.mjs
 * 출력: JSON { python, qwen_tts, gpu, all_ok }
 */

import { execSync } from 'node:child_process';

function run(cmd, timeoutMs = 10_000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function checkPython() {
  const raw = run('python3 --version');
  if (!raw) return { ok: false, version: null, error: 'python3 not found' };

  const match = raw.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { ok: false, version: raw, error: 'cannot parse version' };

  const [, major, minor] = match.map(Number);
  const version = `${major}.${minor}.${match[3]}`;

  if (major < 3 || (major === 3 && minor < 10)) {
    return { ok: false, version, error: `Python 3.10+ required (found ${version})` };
  }
  return { ok: true, version };
}

function checkQwenTts() {
  const version = run('python3 -c "import qwen_tts; print(qwen_tts.__version__)"');
  if (!version) {
    // try alternate import
    const alt = run('python3 -c "import qwen_tts; print(\'installed\')"');
    if (alt === 'installed') return { ok: true, version: 'unknown' };
    return { ok: false, version: null, error: 'qwen-tts not installed' };
  }
  return { ok: true, version };
}

function checkGpu() {
  const result = run('python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else \'\')"');
  if (!result) return { ok: false, name: null, error: 'torch not installed or CUDA unavailable' };

  const lines = result.split('\n');
  const available = lines[0] === 'True';
  const name = lines[1] || null;

  if (!available) return { ok: false, name: null, error: 'CUDA GPU not available' };

  // Try to get VRAM info
  const vram = run('python3 -c "import torch; print(round(torch.cuda.get_device_properties(0).total_mem / 1024**3, 1))"');
  return { ok: true, name, vram_gb: vram ? parseFloat(vram) : null };
}

try {
  const python = checkPython();
  const qwen_tts = python.ok ? checkQwenTts() : { ok: false, version: null, error: 'python check failed first' };
  const gpu = python.ok ? checkGpu() : { ok: false, name: null, error: 'python check failed first' };

  const all_ok = python.ok && qwen_tts.ok && gpu.ok;

  console.log(JSON.stringify({ python, qwen_tts, gpu, all_ok }, null, 2));
  process.exit(0);
} catch (err) {
  console.log(JSON.stringify({ error: err.message, all_ok: false }));
  process.exit(0);
}
