#!/usr/bin/env node
/**
 * 참조 음성 파일 검증 스크립트
 * 파일 존재, 크기, 오디오 포맷(WAV/MP3/FLAC/OGG) 헤더를 검사합니다.
 *
 * 사용법: node validate-ref-audio.mjs <file-path>
 * 출력: JSON { ok, path, format, size_bytes, error? }
 */

import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const AUDIO_SIGNATURES = [
  { magic: Buffer.from('RIFF'),       offset: 0, format: 'wav' },
  { magic: Buffer.from([0xFF, 0xFB]), offset: 0, format: 'mp3' },  // MP3 sync word (MPEG1 Layer3)
  { magic: Buffer.from([0xFF, 0xF3]), offset: 0, format: 'mp3' },  // MP3 sync word (MPEG2 Layer3)
  { magic: Buffer.from([0xFF, 0xF2]), offset: 0, format: 'mp3' },  // MP3 sync word (MPEG2.5 Layer3)
  { magic: Buffer.from('ID3'),        offset: 0, format: 'mp3' },  // MP3 with ID3 tag
  { magic: Buffer.from('fLaC'),       offset: 0, format: 'flac' },
  { magic: Buffer.from('OggS'),       offset: 0, format: 'ogg' },
];

const MIN_SIZE = 1000;       // 최소 1KB (빈 파일 방지)
const MAX_SIZE = 100_000_000; // 최대 100MB

function validate(filePath) {
  const absPath = resolve(filePath);

  // 파일 존재 확인
  let stat;
  try {
    stat = statSync(absPath);
  } catch {
    return { ok: false, path: absPath, error: `파일을 찾을 수 없습니다: ${absPath}` };
  }

  if (!stat.isFile()) {
    return { ok: false, path: absPath, error: '경로가 파일이 아닙니다' };
  }

  // 크기 확인
  if (stat.size < MIN_SIZE) {
    return { ok: false, path: absPath, size_bytes: stat.size, error: `파일이 너무 작습니다 (${stat.size} bytes, 최소 ${MIN_SIZE} bytes)` };
  }
  if (stat.size > MAX_SIZE) {
    return { ok: false, path: absPath, size_bytes: stat.size, error: `파일이 너무 큽니다 (${(stat.size / 1_000_000).toFixed(1)}MB, 최대 100MB)` };
  }

  // 헤더 확인 (처음 12바이트 읽기)
  const header = Buffer.alloc(12);
  let fd;
  try {
    fd = openSync(absPath, 'r');
    readSync(fd, header, 0, 12, 0);
  } catch {
    return { ok: false, path: absPath, size_bytes: stat.size, error: '파일을 읽을 수 없습니다' };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  let detectedFormat = null;
  for (const sig of AUDIO_SIGNATURES) {
    const slice = header.subarray(sig.offset, sig.offset + sig.magic.length);
    if (slice.equals(sig.magic)) {
      detectedFormat = sig.format;
      break;
    }
  }

  if (!detectedFormat) {
    return { ok: false, path: absPath, size_bytes: stat.size, error: '지원되지 않는 오디오 형식입니다. WAV, MP3, FLAC, OGG 파일을 사용해주세요.' };
  }

  return { ok: true, path: absPath, format: detectedFormat, size_bytes: stat.size };
}

try {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log(JSON.stringify({ ok: false, error: '사용법: node validate-ref-audio.mjs <file-path>' }));
    process.exit(0);
  }

  const result = validate(filePath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (err) {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  process.exit(0);
}
