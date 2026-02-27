/**
 * 파비콘 생성 유틸리티
 * favicon.svg → favicon.ico (16x16 + 32x32) + apple-touch-icon.png (180x180)
 *
 * 사용법: node scripts/generate-favicons.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const svgPath = resolve(publicDir, 'favicon.svg');

/** SVG를 지정 크기의 PNG Buffer로 래스터화 */
function svgToPng(svgString, size) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: size },
  });
  return resvg.render().asPng();
}

/**
 * PNG 버퍼 배열을 ICO 바이너리로 패킹
 * ICO = ICONDIR (6B) + ICONDIRENTRY[] (16B each) + PNG data[]
 */
function packIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let dataOffset = headerSize;

  // ICONDIR: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = 1 (ICO)
  header.writeUInt16LE(count, 4); // image count

  const entries = [];
  const offsets = [];

  for (let i = 0; i < count; i++) {
    offsets.push(dataOffset);
    dataOffset += pngBuffers[i].length;

    // ICONDIRENTRY: w(1) h(1) colors(1) reserved(1) planes(2) bpp(2) size(4) offset(4)
    const entry = Buffer.alloc(16);
    const s = sizes[i] >= 256 ? 0 : sizes[i]; // 256 → 0 per ICO spec
    entry.writeUInt8(s, 0);                     // width
    entry.writeUInt8(s, 1);                     // height
    entry.writeUInt8(0, 2);                     // color palette count
    entry.writeUInt8(0, 3);                     // reserved
    entry.writeUInt16LE(1, 4);                  // color planes
    entry.writeUInt16LE(32, 6);                 // bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8);  // data size
    entry.writeUInt32LE(offsets[i], 12);            // data offset
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// --- Main ---

const svg = readFileSync(svgPath, 'utf-8');

// ICO: 16x16 + 32x32
const png16 = svgToPng(svg, 16);
const png32 = svgToPng(svg, 32);
const ico = packIco([png16, png32], [16, 32]);
writeFileSync(resolve(publicDir, 'favicon.ico'), ico);

// Apple Touch Icon: 180x180
const png180 = svgToPng(svg, 180);
writeFileSync(resolve(publicDir, 'apple-touch-icon.png'), png180);

console.log('[generate-favicons] favicon.ico (%d bytes)', ico.length);
console.log('[generate-favicons] apple-touch-icon.png (%d bytes)', png180.length);
