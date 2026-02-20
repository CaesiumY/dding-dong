#!/usr/bin/env node
/**
 * dding-dong 사운드 팩 생성 스크립트
 * 16bit PCM, 44100Hz, mono WAV 파일을 프로그래밍 방식으로 생성합니다.
 *
 * 지원 팩: default (사인파), retro (8-bit 칩튠), musical (피아노 코드)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 44100;
const BITS = 16;

// ─── 파형 함수 ───────────────────────────────────────────

const waveforms = {
  sine:     (t) => Math.sin(2 * Math.PI * t),
  square:   (t) => Math.sign(Math.sin(2 * Math.PI * t)) || 1,
  sawtooth: (t) => 2 * ((t % 1 + 1) % 1) - 1,
  triangle: (t) => 4 * Math.abs(((t % 1 + 1) % 1) - 0.5) - 1,
};

// ─── 톤 생성 ─────────────────────────────────────────────

/**
 * 단일 톤 샘플 배열 생성
 * @param {number} freq - 주파수 (Hz)
 * @param {number} durationMs - 길이 (ms)
 * @param {object} opts - 옵션
 * @param {number} [opts.volume=0.8] - 볼륨 (0.0~1.0)
 * @param {string} [opts.waveform='sine'] - 파형 (sine|square|sawtooth|triangle)
 * @param {number} [opts.decay=0] - 감쇠율 (0=없음, 2~3=피아노 느낌)
 */
function generateTone(freq, durationMs, opts = {}) {
  const { volume = 0.8, waveform = 'sine', decay = 0 } = opts;
  const samples = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const data = new Int16Array(samples);
  const fadeLen = Math.floor(SAMPLE_RATE * 0.01); // 10ms fade
  const waveFn = waveforms[waveform] || waveforms.sine;

  for (let i = 0; i < samples; i++) {
    const t = freq * i / SAMPLE_RATE;
    let amp = volume * 32767;
    // fade in/out
    if (i < fadeLen) amp *= i / fadeLen;
    if (i > samples - fadeLen) amp *= (samples - i) / fadeLen;
    // 감쇠 적용
    if (decay > 0) amp *= Math.exp(-decay * i / SAMPLE_RATE);
    data[i] = Math.round(amp * waveFn(t));
  }
  return data;
}

/**
 * 여러 주파수를 동시에 합성 (화음)
 * @param {number[]} freqs - 주파수 배열
 * @param {number} durationMs - 길이 (ms)
 * @param {object} opts - 옵션 (volume, waveform, decay)
 */
function generateChord(freqs, durationMs, opts = {}) {
  const { volume = 0.8, waveform = 'sine', decay = 0 } = opts;
  const samples = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const data = new Int16Array(samples);
  const fadeLen = Math.floor(SAMPLE_RATE * 0.01);
  const waveFn = waveforms[waveform] || waveforms.sine;
  const n = freqs.length;

  for (let i = 0; i < samples; i++) {
    let amp = volume * 32767;
    if (i < fadeLen) amp *= i / fadeLen;
    if (i > samples - fadeLen) amp *= (samples - i) / fadeLen;
    if (decay > 0) amp *= Math.exp(-decay * i / SAMPLE_RATE);
    // 각 주파수의 파형을 합산 후 정규화
    let sum = 0;
    for (const freq of freqs) {
      sum += waveFn(freq * i / SAMPLE_RATE);
    }
    data[i] = Math.round(amp * sum / n);
  }
  return data;
}

/**
 * 주파수 스윕 (glissando) — 시작 주파수에서 끝 주파수로 연속 변화
 * @param {number} startFreq - 시작 주파수
 * @param {number} endFreq - 끝 주파수
 * @param {number} durationMs - 길이 (ms)
 * @param {object} opts - 옵션
 */
function generateSweep(startFreq, endFreq, durationMs, opts = {}) {
  const { volume = 0.8, waveform = 'sine', decay = 0 } = opts;
  const samples = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const data = new Int16Array(samples);
  const fadeLen = Math.floor(SAMPLE_RATE * 0.01);
  const waveFn = waveforms[waveform] || waveforms.sine;

  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const ratio = i / samples;
    const freq = startFreq + (endFreq - startFreq) * ratio;
    let amp = volume * 32767;
    if (i < fadeLen) amp *= i / fadeLen;
    if (i > samples - fadeLen) amp *= (samples - i) / fadeLen;
    if (decay > 0) amp *= Math.exp(-decay * i / SAMPLE_RATE);
    data[i] = Math.round(amp * waveFn(phase));
    phase += freq / SAMPLE_RATE;
  }
  return data;
}

// ─── 유틸 ────────────────────────────────────────────────

/** 무음 샘플 배열 생성 */
function generateSilence(durationMs) {
  return new Int16Array(Math.floor(SAMPLE_RATE * durationMs / 1000));
}

/** 여러 Int16Array를 순서대로 연결 */
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

/** Int16Array 샘플 데이터를 WAV 파일 Buffer로 변환 */
function createWav(samples) {
  const dataLen = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLen);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);           // PCM
  buffer.writeUInt16LE(1, 22);           // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(BITS, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);
  Buffer.from(samples.buffer).copy(buffer, 44);

  return buffer;
}

// ═══ 사운드 팩 정의 ═════════════════════════════════════

const SQ = 'square';
const SAW = 'sawtooth';

const packs = {

  // ── default: 사인파 비프음 (기존) ──────────────────────
  default: {
    'complete': () => concatInt16Arrays(
      generateTone(523, 150),   // C5
      generateSilence(30),
      generateTone(659, 150),   // E5
    ),
    'error': () => concatInt16Arrays(
      generateTone(659, 150),   // E5
      generateSilence(30),
      generateTone(262, 150),   // C4
    ),
    'input-required': () => concatInt16Arrays(
      generateTone(523, 100),   // C5
      generateSilence(30),
      generateTone(659, 100),   // E5
      generateSilence(30),
      generateTone(784, 100),   // G5
    ),
    'session-start': () => concatInt16Arrays(
      generateTone(262, 200),   // C4
      generateSilence(30),
      generateTone(392, 200),   // G4
    ),
    'session-end': () => concatInt16Arrays(
      generateTone(392, 200),   // G4
      generateSilence(30),
      generateTone(262, 200),   // C4
    ),
  },

  // ── retro: 8-bit 칩튠 ─────────────────────────────────
  retro: {
    // 아이템 획득! 빠른 4음 상승 아르페지오
    'complete': () => concatInt16Arrays(
      generateTone(523, 80, { waveform: SQ, volume: 0.6 }),   // C5
      generateSilence(15),
      generateTone(659, 80, { waveform: SQ, volume: 0.6 }),   // E5
      generateSilence(15),
      generateTone(784, 80, { waveform: SQ, volume: 0.6 }),   // G5
      generateSilence(15),
      generateTone(1047, 120, { waveform: SQ, volume: 0.6 }), // C6 (마지막은 살짝 길게)
    ),
    // 데미지! 하강 2음
    'error': () => concatInt16Arrays(
      generateTone(330, 120, { waveform: SQ, volume: 0.6 }),  // E4
      generateSilence(20),
      generateTone(262, 180, { waveform: SQ, volume: 0.5 }),  // C4 (길고 낮게)
    ),
    // 코인 투입 — 짧은 2음 핑
    'input-required': () => concatInt16Arrays(
      generateTone(1319, 60, { waveform: SQ, volume: 0.5 }),  // E6
      generateSilence(20),
      generateTone(1568, 90, { waveform: SQ, volume: 0.5 }),  // G6
    ),
    // 파워 온 — 상승 스윕
    'session-start': () => generateSweep(262, 1047, 400, { waveform: SAW, volume: 0.5 }),
    // 파워 오프 — 하강 스윕 + 감쇠
    'session-end': () => generateSweep(1047, 262, 400, { waveform: SAW, volume: 0.5, decay: 2 }),
  },

  // ── musical: 피아노 코드 ──────────────────────────────
  musical: {
    // C Major 코드 — 따뜻한 완료감
    'complete': () => generateChord(
      [262, 330, 392],  // C4 + E4 + G4
      400,
      { volume: 0.7, decay: 2 },
    ),
    // B diminished — 긴장감 있는 오류
    'error': () => generateChord(
      [247, 294, 349],  // B3 + D4 + F4
      350,
      { volume: 0.65, decay: 3 },
    ),
    // 아르페지오 상승 — 부드러운 주의 환기
    'input-required': () => concatInt16Arrays(
      generateTone(262, 120, { decay: 1.5 }),  // C4
      generateSilence(15),
      generateTone(330, 120, { decay: 1.5 }),  // E4
      generateSilence(15),
      generateTone(392, 120, { decay: 1.5 }),  // G4
      generateSilence(15),
      generateTone(523, 160, { decay: 1.5 }),  // C5
    ),
    // F → G → C 코드 진행 — 기대감 있는 시작
    'session-start': () => concatInt16Arrays(
      generateChord([349, 440, 523], 250, { volume: 0.65, decay: 2 }),  // F4+A4+C5 (F maj)
      generateSilence(30),
      generateChord([392, 494, 587], 250, { volume: 0.65, decay: 2 }),  // G4+B4+D5 (G maj)
      generateSilence(30),
      generateChord([523, 659, 784], 350, { volume: 0.7, decay: 1.5 }), // C5+E5+G5 (C maj)
    ),
    // 하강 아르페지오 → 코드 해결 — 안정적 마무리
    'session-end': () => concatInt16Arrays(
      generateTone(523, 150, { decay: 2 }),  // C5
      generateSilence(15),
      generateTone(392, 150, { decay: 2 }),  // G4
      generateSilence(15),
      generateTone(330, 150, { decay: 2 }),  // E4
      generateSilence(15),
      generateChord([262, 330, 392], 400, { volume: 0.7, decay: 2 }),  // C maj 해결
    ),
  },
};

// ═══ WAV 파일 생성 ═══════════════════════════════════════

for (const [packName, sounds] of Object.entries(packs)) {
  const outDir = join(__dirname, '..', 'sounds', packName);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n── ${packName} 팩 ──`);
  for (const [name, generate] of Object.entries(sounds)) {
    const samples = generate();
    const wav = createWav(samples);
    const filePath = join(outDir, `${name}.wav`);
    writeFileSync(filePath, wav);
    const durationMs = Math.round(samples.length / SAMPLE_RATE * 1000);
    console.log(`  ${name}.wav (${durationMs}ms, ${wav.length} bytes)`);
  }
}

console.log(`\n완료: ${Object.keys(packs).length}개 팩 생성됨`);
