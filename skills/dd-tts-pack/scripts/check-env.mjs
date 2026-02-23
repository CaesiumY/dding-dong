#!/usr/bin/env node
/**
 * TTS 환경 검사 스크립트
 * venv Python(우선) 또는 시스템 Python, qwen-tts 패키지, NVIDIA GPU(CUDA) 가용성을 검사합니다.
 *
 * 사용법: node check-env.mjs
 * 출력: JSON { python, venv, qwen_tts, gpu, python_path, all_ok }
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// --- Constants (must match setup-tts-venv.mjs) ---
const IS_WIN = process.platform === 'win32';
const VENV_DIR = join(homedir(), '.config', 'dding-dong', 'tts-venv');
const VENV_PYTHON = IS_WIN
  ? join(VENV_DIR, 'Scripts', 'python.exe')
  : join(VENV_DIR, 'bin', 'python3');
const SYS_PYTHON = IS_WIN ? 'python' : 'python3';

function run(cmd, timeoutMs = 10_000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function parsePythonVersion(raw) {
  if (!raw) return null;
  const match = raw.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: match[3], full: `${match[1]}.${match[2]}.${match[3]}` };
}

function checkPython() {
  // Priority 1: venv Python
  if (existsSync(VENV_PYTHON)) {
    const raw = run(`"${VENV_PYTHON}" --version`);
    const ver = parsePythonVersion(raw);
    if (ver && (ver.major > 3 || (ver.major === 3 && ver.minor >= 10))) {
      return { ok: true, version: ver.full, path: VENV_PYTHON, source: 'venv' };
    }
    if (ver) {
      return { ok: false, version: ver.full, path: VENV_PYTHON, source: 'venv', error: `Python 3.10+ required (found ${ver.full})` };
    }
    // venv python exists but broken
    return { ok: false, version: null, path: VENV_PYTHON, source: 'venv', error: 'venv python is broken' };
  }

  // Priority 2: system python (fallback, for venv creation feasibility check)
  const raw = run(`${SYS_PYTHON} --version`);
  if (!raw) return { ok: false, version: null, path: null, source: null, error: `${SYS_PYTHON} not found` };

  const ver = parsePythonVersion(raw);
  if (!ver) return { ok: false, version: raw, path: null, source: null, error: 'cannot parse version' };

  // Resolve absolute path of system python
  const absPath = IS_WIN
    ? run(`where ${SYS_PYTHON}`)?.split('\n')[0] || SYS_PYTHON
    : run(`which ${SYS_PYTHON}`) || run(`command -v ${SYS_PYTHON}`) || SYS_PYTHON;

  if (ver.major < 3 || (ver.major === 3 && ver.minor < 10)) {
    return { ok: false, version: ver.full, path: absPath, source: 'system', error: `Python 3.10+ required (found ${ver.full})` };
  }
  return { ok: true, version: ver.full, path: absPath, source: 'system' };
}

function checkVenv() {
  return { exists: existsSync(VENV_PYTHON), path: VENV_DIR };
}

function lastLine(str) {
  if (!str) return '';
  const lines = str.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

function checkQwenTts(pythonPath) {
  if (!pythonPath) return { ok: false, version: null, error: 'no python available' };

  // Use importlib.metadata to avoid import side-effects (SoX/flash-attn warnings on stdout)
  const metaVer = run(`"${pythonPath}" -c "from importlib.metadata import version; print(version('qwen-tts'))"`);
  const ver = lastLine(metaVer);
  if (ver && /^\d+\.\d+/.test(ver)) return { ok: true, version: ver };

  // Fallback: try actual import, check last line only (stdout may contain warnings)
  const alt = run(`"${pythonPath}" -c "import qwen_tts; print('installed')"`);
  if (lastLine(alt) === 'installed') return { ok: true, version: 'unknown' };
  return { ok: false, version: null, error: 'qwen-tts not installed' };
}

function checkGpu(pythonPath) {
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

  // Step 2: torch CUDA readiness check (requires Python)
  let cuda_ready = false;
  if (pythonPath) {
    const torchResult = run(`"${pythonPath}" -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"`);
    if (torchResult) {
      const lines = torchResult.split('\n');
      cuda_ready = lines[0] === 'True';
      if (cuda_ready && !name && lines[1]) name = lines[1];
      if (cuda_ready && vram_gb === null) {
        const vram = run(`"${pythonPath}" -c "import torch; print(round(torch.cuda.get_device_properties(0).total_mem / 1024**3, 1))"`);
        if (vram) vram_gb = parseFloat(vram);
      }
      if (cuda_ready) hwDetected = true;
    }
  }

  if (!hwDetected) return { ok: false, name: null, vram_gb: null, cuda_ready: false, error: 'CUDA GPU not available' };
  return { ok: true, name, vram_gb, cuda_ready };
}

try {
  const python = checkPython();
  const venv = checkVenv();
  const pythonPath = python.ok ? python.path : null;
  const qwen_tts = pythonPath ? checkQwenTts(pythonPath) : { ok: false, version: null, error: 'python check failed first' };
  const gpu = checkGpu(pythonPath);
  const all_ok = python.ok && qwen_tts.ok && gpu.ok;

  console.log(JSON.stringify({ python, venv, qwen_tts, gpu, python_path: pythonPath, all_ok }, null, 2));
  process.exit(0);
} catch (err) {
  console.log(JSON.stringify({ error: err.message, all_ok: false }));
  process.exit(0);
}
