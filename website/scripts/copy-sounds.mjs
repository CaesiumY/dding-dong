/**
 * 사운드 파일 복사 스크립트
 * ../sounds/ → public/sounds/ 로 WAV + manifest.json 파일을 복사합니다.
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const soundsSrc = resolve(rootDir, '..', 'sounds');
const soundsDest = resolve(rootDir, 'public', 'sounds');

const packs = ['default', 'retro', 'musical'];

if (!existsSync(soundsSrc)) {
  console.error(`[copy-sounds] Source directory not found: ${soundsSrc}`);
  process.exit(1);
}

// public/sounds/ 디렉터리 생성
if (!existsSync(soundsDest)) {
  mkdirSync(soundsDest, { recursive: true });
}

let copiedCount = 0;

for (const pack of packs) {
  const src = resolve(soundsSrc, pack);
  const dest = resolve(soundsDest, pack);

  if (!existsSync(src)) {
    console.warn(`[copy-sounds] Pack not found, skipping: ${pack}`);
    continue;
  }

  cpSync(src, dest, { recursive: true });
  copiedCount++;
}

// --- TTS 팩 복사 (화이트리스트 기반) ---
const ttsPacks = [
  {
    id: 'metro-voice',
    src: resolve(rootDir, '..', '.dding-dong', 'packs', 'metro-voice'),
    files: ['manifest.json', 'complete.wav', 'error.wav', 'input-required.wav', 'session-start.wav', 'session-end.wav'],
  },
];

for (const pack of ttsPacks) {
  if (!existsSync(pack.src)) {
    console.warn(`[copy-sounds] TTS pack not found, skipping: ${pack.id}`);
    continue;
  }

  const dest = resolve(soundsDest, pack.id);
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  let filesCopied = 0;
  for (const file of pack.files) {
    const fileSrc = resolve(pack.src, file);
    const fileDest = resolve(dest, file);
    if (existsSync(fileSrc)) {
      cpSync(fileSrc, fileDest);
      filesCopied++;
    } else {
      console.warn(`[copy-sounds] TTS file not found, skipping: ${pack.id}/${file}`);
    }
  }

  if (filesCopied > 0) {
    copiedCount++;
    console.log(`[copy-sounds] TTS pack "${pack.id}": copied ${filesCopied}/${pack.files.length} files`);
  }
}

console.log(`[copy-sounds] Copied ${copiedCount} sound packs to public/sounds/`);
