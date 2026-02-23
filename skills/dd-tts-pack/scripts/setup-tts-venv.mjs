#!/usr/bin/env node
/**
 * TTS 전용 venv 환경 관리 스크립트
 * venv 생성, CUDA PyTorch + qwen-tts 설치를 자동화합니다.
 *
 * 사용법:
 *   node setup-tts-venv.mjs check   # venv 상태 확인
 *   node setup-tts-venv.mjs create  # venv 생성 + 패키지 설치
 *   node setup-tts-venv.mjs path    # venv Python 절대 경로 출력
 *
 * 출력: JSON { ok, ... }
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// --- Constants ---
const IS_WIN = process.platform === 'win32';
const VENV_DIR = join(homedir(), '.config', 'dding-dong', 'tts-venv');
const VENV_PYTHON = IS_WIN
  ? join(VENV_DIR, 'Scripts', 'python.exe')
  : join(VENV_DIR, 'bin', 'python3');
const VENV_PIP = IS_WIN
  ? join(VENV_DIR, 'Scripts', 'pip.exe')
  : join(VENV_DIR, 'bin', 'pip');
const SYS_PYTHON = IS_WIN ? 'python' : 'python3';

// --- Helpers ---
function json(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function jsonError(msg) {
  json({ ok: false, error: msg });
  process.exit(0);
}

function run(cmd, timeoutMs = 30_000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** Run a command showing stderr progress to the user. stdout is captured (not mixed with JSON output). */
function runVisible(cmd, timeoutMs = 600_000) {
  try {
    execSync(cmd, { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'inherit'] });
    return true;
  } catch {
    return false;
  }
}

// --- CUDA Detection ---
function detectCudaVersion() {
  const output = run('nvidia-smi');
  if (!output) return null;
  const match = output.match(/CUDA Version:\s*(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: parseInt(match[1]), minor: parseInt(match[2]) };
}

/**
 * Map CUDA driver version to the best available PyTorch wheel index URL.
 * Returns null if no CUDA detected (CPU-only fallback).
 *
 *   CUDA >= 12.4 → cu124
 *   CUDA >= 12.1 → cu121
 *   CUDA >= 11.8 → cu118
 *   CUDA <  11.8 → null (too old, CPU fallback)
 */
function selectTorchIndexUrl() {
  const cuda = detectCudaVersion();
  if (!cuda) return null;
  const ver = cuda.major * 10 + cuda.minor;
  if (ver >= 124) return 'https://download.pytorch.org/whl/cu124';
  if (ver >= 121) return 'https://download.pytorch.org/whl/cu121';
  if (ver >= 118) return 'https://download.pytorch.org/whl/cu118';
  return null;
}

// --- check ---
function checkCmd() {
  if (!existsSync(VENV_PYTHON)) {
    return json({ ok: false, venv_exists: false, python_path: null, error: 'venv not found' });
  }

  // Verify python actually executes (not just file exists)
  const version = run(`"${VENV_PYTHON}" --version`);
  if (!version) {
    return json({ ok: false, venv_exists: true, python_path: VENV_PYTHON, error: 'venv python is broken' });
  }

  // Check qwen-tts import
  const qwenVer = run(`"${VENV_PYTHON}" -c "import qwen_tts; print(qwen_tts.__version__)"`);
  if (!qwenVer) {
    const alt = run(`"${VENV_PYTHON}" -c "import qwen_tts; print('installed')"`);
    if (alt === 'installed') {
      return json({ ok: true, venv_exists: true, python_path: VENV_PYTHON, qwen_tts_version: 'unknown' });
    }
    return json({
      ok: false, venv_exists: true, python_path: VENV_PYTHON,
      qwen_tts_version: null, error: 'qwen-tts not installed in venv',
    });
  }

  json({ ok: true, venv_exists: true, python_path: VENV_PYTHON, qwen_tts_version: qwenVer });
}

// --- create ---
function createCmd() {
  // 1. System python version check (needed only for venv creation)
  const pyVer = run(`${SYS_PYTHON} --version`);
  if (!pyVer) return jsonError(`${SYS_PYTHON} not found. Install Python 3.10+ first.`);

  const match = pyVer.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
  if (!match) return jsonError(`Cannot parse Python version: ${pyVer}`);

  const [, major, minor] = match.map(Number);
  if (major < 3 || (major === 3 && minor < 10)) {
    return jsonError(`Python 3.10+ required (found ${pyVer.trim()})`);
  }

  // 2. Check venv module availability (Ubuntu requires python3-venv package)
  if (!existsSync(VENV_PYTHON)) {
    const venvModuleCheck = run(`${SYS_PYTHON} -c "import ensurepip; import venv"`);
    if (venvModuleCheck === null) {
      // Detect the exact package name needed (python3.XX-venv)
      const installPkg = (major === 3 && minor >= 10)
        ? `python3.${minor}-venv`
        : 'python3-venv';
      return json({
        ok: false,
        error: 'venv_module_missing',
        install_hint: `sudo apt install ${installPkg}`,
        install_pkg: installPkg,
        python_version: `${major}.${minor}`,
      });
    }

    // 3. Create venv
    mkdirSync(dirname(VENV_DIR), { recursive: true });
    if (!runVisible(`${SYS_PYTHON} -m venv "${VENV_DIR}"`, 120_000)) {
      return jsonError('venv creation failed');
    }
    if (!existsSync(VENV_PYTHON)) {
      return jsonError('venv created but python not found at expected path');
    }
  }

  // 4. Upgrade pip
  runVisible(`"${VENV_PIP}" install --upgrade pip`, 120_000);

  // 5. Install PyTorch with CUDA support (if CUDA detected)
  //    pip install qwen-tts alone installs CPU-only torch from PyPI.
  //    We install torch from PyTorch's CUDA index first to get GPU acceleration.
  const indexUrl = selectTorchIndexUrl();
  if (indexUrl) {
    const cudaCheck = run(`"${VENV_PYTHON}" -c "import torch; print(torch.cuda.is_available())"`);
    if (cudaCheck !== 'True') {
      // Remove CPU-only torch before installing CUDA version
      if (cudaCheck !== null) {
        runVisible(`"${VENV_PIP}" uninstall torch torchaudio -y`, 60_000);
      }
      if (!runVisible(`"${VENV_PIP}" install torch torchaudio --index-url "${indexUrl}"`, 600_000)) {
        // Fallback: let qwen-tts pull default torch from PyPI
      }
    }
  }

  // 6. Install qwen-tts
  if (!runVisible(`"${VENV_PIP}" install -U qwen-tts`, 600_000)) {
    return jsonError('qwen-tts installation failed');
  }

  // 7. Verify installation
  const qwenVer = run(`"${VENV_PYTHON}" -c "import qwen_tts; print(qwen_tts.__version__)"`);
  if (!qwenVer) {
    const alt = run(`"${VENV_PYTHON}" -c "import qwen_tts; print('installed')"`);
    if (alt !== 'installed') return jsonError('qwen-tts installed but import failed');
  }

  json({
    ok: true,
    python_path: VENV_PYTHON,
    qwen_tts_version: qwenVer || 'unknown',
    cuda_index: indexUrl || null,
  });
}

// --- path ---
function pathCmd() {
  if (!existsSync(VENV_PYTHON)) {
    return json({ ok: false, error: 'venv not found' });
  }
  json({ ok: true, python_path: VENV_PYTHON });
}

// --- Main ---
try {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'check':  checkCmd();  break;
    case 'create': createCmd(); break;
    case 'path':   pathCmd();   break;
    default:       jsonError('사용법: setup-tts-venv.mjs check | create | path');
  }
} catch (err) {
  json({ ok: false, error: err.message });
  process.exit(0);
}
