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

console.log(`[copy-sounds] Copied ${copiedCount} sound packs to public/sounds/`);
