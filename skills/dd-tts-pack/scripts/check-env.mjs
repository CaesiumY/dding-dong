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
  let name = null;
  let vram_gb = null;
  let hwDetected = false;

  // Step 1: nvidia-smi for hardware detection (no Python dependency)
  const smiResult = run('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
  if (smiResult) {
    const parts = smiResult.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      name = parts[0];
      const mib = parseFloat(parts[1]);
      if (!isNaN(mib)) vram_gb = Math.round(mib / 1024 * 10) / 10;
      hwDetected = true;
    }
  }

  // Step 2: torch CUDA readiness check
  let cuda_ready = false;
  const torchResult = run('python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else \'\')"');
  if (torchResult) {
    const lines = torchResult.split('\n');
    cuda_ready = lines[0] === 'True';
    // Fill in name/vram from torch if nvidia-smi missed them
    if (cuda_ready && !name && lines[1]) name = lines[1];
    if (cuda_ready && vram_gb === null) {
      const vram = run('python3 -c "import torch; print(round(torch.cuda.get_device_properties(0).total_mem / 1024**3, 1))"');
      if (vram) vram_gb = parseFloat(vram);
    }
    if (cuda_ready) hwDetected = true;
  }

  if (!hwDetected) return { ok: false, name: null, vram_gb: null, cuda_ready: false, error: 'CUDA GPU not available' };
  return { ok: true, name, vram_gb, cuda_ready };
}

try {
  const python = checkPython();
  const qwen_tts = python.ok ? checkQwenTts() : { ok: false, version: null, error: 'python check failed first' };
  const gpu = checkGpu();

  const all_ok = python.ok && qwen_tts.ok && gpu.ok;

  console.log(JSON.stringify({ python, qwen_tts, gpu, all_ok }, null, 2));
  process.exit(0);
} catch (err) {
  console.log(JSON.stringify({ error: err.message, all_ok: false }));
  process.exit(0);
}
