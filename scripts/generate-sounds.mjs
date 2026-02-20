#!/usr/bin/env node
/**
 * dding-dong 기본 사운드 팩 생성 스크립트
 * 16bit PCM, 44100Hz, mono WAV 파일을 프로그래밍 방식으로 생성합니다.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 44100;
const BITS = 16;

/**
 * 단일 톤 샘플 배열 생성
 * @param {number} freq - 주파수 (Hz)
 * @param {number} durationMs - 길이 (ms)
 * @param {number} volume - 볼륨 (0.0~1.0)
 */
function generateTone(freq, durationMs, volume = 0.8) {
  const samples = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const data = new Int16Array(samples);
  const fadeLen = Math.floor(SAMPLE_RATE * 0.01); // 10ms fade
  for (let i = 0; i < samples; i++) {
    let amp = volume * 32767;
    // fade in
    if (i < fadeLen) amp *= i / fadeLen;
    // fade out
    if (i > samples - fadeLen) amp *= (samples - i) / fadeLen;
    data[i] = Math.round(amp * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE));
  }
  return data;
}

/**
 * 무음 샘플 배열 생성
 * @param {number} durationMs - 길이 (ms)
 */
function generateSilence(durationMs) {
  return new Int16Array(Math.floor(SAMPLE_RATE * durationMs / 1000));
}

/**
 * 여러 Int16Array를 순서대로 연결
 */
function concatInt16Arrays(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Int16Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Int16Array 샘플 데이터를 WAV 파일 Buffer로 변환
 */
function createWav(samples) {
  const dataLen = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLen);

  // RIFF 청크
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);

  // fmt 서브청크
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);        // 서브청크 크기 (PCM = 16)
  buffer.writeUInt16LE(1, 20);         // AudioFormat: PCM
  buffer.writeUInt16LE(1, 22);         // NumChannels: mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  buffer.writeUInt16LE(2, 32);         // BlockAlign = NumChannels * BitsPerSample/8
  buffer.writeUInt16LE(BITS, 34);      // BitsPerSample

  // data 서브청크
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);
  Buffer.from(samples.buffer).copy(buffer, 44);

  return buffer;
}

// 사운드 정의
const sounds = {
  // 상승 2톤 (C5 → E5): 성공/완료 느낌
  'complete': () => concatInt16Arrays(
    generateTone(523, 150),   // C5
    generateSilence(30),
    generateTone(659, 150),   // E5
  ),

  // 하강 2톤 (E5 → C4): 경고/오류 느낌
  'error': () => concatInt16Arrays(
    generateTone(659, 150),   // E5
    generateSilence(30),
    generateTone(262, 150),   // C4
  ),

  // 3톤 상승 (C5 → E5 → G5): 주의 환기/입력 요청
  'input-required': () => concatInt16Arrays(
    generateTone(523, 100),   // C5
    generateSilence(30),
    generateTone(659, 100),   // E5
    generateSilence(30),
    generateTone(784, 100),   // G5
  ),

  // 부드러운 상승 (C4 → G4): 세션 시작
  'session-start': () => concatInt16Arrays(
    generateTone(262, 200),   // C4
    generateSilence(30),
    generateTone(392, 200),   // G4
  ),

  // 부드러운 하강 (G4 → C4): 세션 종료
  'session-end': () => concatInt16Arrays(
    generateTone(392, 200),   // G4
    generateSilence(30),
    generateTone(262, 200),   // C4
  ),
};

// 출력 디렉터리
const outDir = join(__dirname, '..', 'sounds', 'default');
mkdirSync(outDir, { recursive: true });

// WAV 파일 생성
for (const [name, generate] of Object.entries(sounds)) {
  const samples = generate();
  const wav = createWav(samples);
  const filePath = join(outDir, `${name}.wav`);
  writeFileSync(filePath, wav);
  const durationMs = Math.round(samples.length / SAMPLE_RATE * 1000);
  console.log(`생성됨: ${name}.wav (${durationMs}ms, ${wav.length} bytes)`);
}

console.log(`\n완료: ${outDir}`);
