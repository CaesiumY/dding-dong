/**
 * OG 이미지 생성 유틸리티
 * Satori + @resvg/resvg-js로 로케일별 1200x630 PNG OG 이미지를 생성합니다.
 * Astro Static Endpoint에서 빌드 타임에 호출됩니다.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { t } from '@/i18n/utils';

// ── Font Config ──────────────────────────────────────────────────────────

const FONTS = [
  {
    name: 'GmarketSans',
    url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff',
    file: 'GmarketSansBold.woff',
    weight: 700 as const,
    style: 'normal' as const,
  },
  {
    name: 'Pretendard',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf',
    file: 'Pretendard-Regular.otf',
    weight: 400 as const,
    style: 'normal' as const,
  },
];

const CACHE_DIR = join(process.cwd(), '.cache', 'fonts');

async function ensureFont(url: string, cachePath: string): Promise<ArrayBuffer> {
  if (existsSync(cachePath)) {
    const buf = readFileSync(cachePath);
    // Buffer.buffer는 pool된 ArrayBuffer일 수 있으므로 정확한 범위를 slice
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  console.log(`[og-image] Downloading font: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font download failed: ${res.status} ${res.statusText}`);
  const arrayBuf = await res.arrayBuffer();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, new Uint8Array(arrayBuf));
  return arrayBuf;
}

// Module-level cache: fonts are loaded once and reused across locale calls
let fontsPromise: ReturnType<typeof loadFontsImpl> | null = null;

async function loadFontsImpl() {
  const buffers = await Promise.all(
    FONTS.map((f) => ensureFont(f.url, join(CACHE_DIR, f.file))),
  );
  return FONTS.map((f, i) => ({
    name: f.name,
    data: buffers[i],
    weight: f.weight,
    style: f.style,
  }));
}

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = loadFontsImpl();
  }
  return fontsPromise;
}

// ── Icons (Phosphor Icons, 256x256 viewBox) ──────────────────────────────

const BELL_PATH =
  'M224 71.1a8 8 0 0 1-10.78-3.42a94.13 94.13 0 0 0-33.46-36.91a8 8 0 1 1 8.54-13.54a111.46 111.46 0 0 1 39.12 43.09A8 8 0 0 1 224 71.1M35.71 72a8 8 0 0 0 7.1-4.32a94.13 94.13 0 0 1 33.46-36.91a8 8 0 1 0-8.54-13.54a111.46 111.46 0 0 0-39.12 43.09A8 8 0 0 0 35.71 72m186.1 103.94A16 16 0 0 1 208 200h-40.8a40 40 0 0 1-78.4 0H48a16 16 0 0 1-13.79-24.06C43.22 160.39 48 138.28 48 112a80 80 0 0 1 160 0c0 26.27 4.78 48.38 13.81 63.94M150.62 200h-45.24a24 24 0 0 0 45.24 0';

const MIC_PATH =
  'M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6';

function iconDataUri(pathData: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="${color}" d="${pathData}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── Layout Components ────────────────────────────────────────────────────
// Satori VNode: plain { type, props } objects (no React dependency needed)

function waveBars(color: string) {
  const heights = [4, 12, 8, 14];
  return {
    type: 'div',
    props: {
      style: { display: 'flex', alignItems: 'flex-end', gap: '3px', marginLeft: '8px' },
      children: heights.map((h) => ({
        type: 'div',
        props: {
          style: {
            width: '3px',
            height: `${h}px`,
            backgroundColor: color,
            borderRadius: '2px',
          },
        },
      })),
    },
  };
}

function toastCard(iconPath: string, iconColor: string, label: string, message: string) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E7E0D6',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        padding: '16px 20px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center' },
            children: [
              {
                type: 'img',
                props: {
                  src: iconDataUri(iconPath, iconColor),
                  width: 24,
                  height: 24,
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontFamily: 'GmarketSans',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#1C1917',
                    marginLeft: '8px',
                  },
                  children: label,
                },
              },
              waveBars(iconColor),
            ],
          },
        },
        {
          type: 'span',
          props: {
            style: {
              fontFamily: 'Pretendard',
              fontSize: '14px',
              color: '#78716C',
              marginTop: '8px',
            },
            children: message,
          },
        },
      ],
    },
  };
}

function createOgLayout(locale: string) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: '630px',
        backgroundColor: '#FAF7F0',
      },
      children: [
        // Top accent bar
        {
          type: 'div',
          props: { style: { width: '100%', height: '6px', backgroundColor: '#D97706' } },
        },

        // Main content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              padding: '40px 50px',
              alignItems: 'center',
            },
            children: [
              // Left: text
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    paddingRight: '30px',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: 'GmarketSans',
                          fontSize: '48px',
                          fontWeight: 700,
                          color: '#1C1917',
                        },
                        children: t('hero.logo', locale),
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: 'Pretendard',
                          fontSize: '20px',
                          color: '#78716C',
                          marginTop: '12px',
                        },
                        children: t('hero.subtitle', locale),
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: 'Pretendard',
                          fontSize: '16px',
                          color: '#78716C',
                          marginTop: '12px',
                          lineHeight: '1.5',
                        },
                        children: t('hero.description', locale),
                      },
                    },
                  ],
                },
              },

              // Right: toast cards
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '420px',
                  },
                  children: [
                    toastCard(
                      BELL_PATH,
                      '#D97706',
                      t('hero.logo', locale),
                      t('hero.notificationPreview', locale),
                    ),
                    toastCard(
                      MIC_PATH,
                      '#8B5CF6',
                      t('hero.ttsLabel', locale),
                      t('hero.ttsQuote', locale),
                    ),
                  ],
                },
              },
            ],
          },
        },

        // Footer text
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              paddingBottom: '16px',
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontFamily: 'Pretendard',
                    fontSize: '14px',
                    color: '#78716C',
                  },
                  children: 'Claude Code Notification Plugin',
                },
              },
            ],
          },
        },

        // Bottom accent bar
        {
          type: 'div',
          props: { style: { width: '100%', height: '6px', backgroundColor: '#D97706' } },
        },
      ],
    },
  };
}

// ── Main Export ───────────────────────────────────────────────────────────

export async function generateOgPng(locale: string): Promise<ArrayBuffer> {
  const fonts = await loadFonts();
  const layout = createOgLayout(locale);

  // VNode objects satisfy Satori's ReactNode at runtime (no React dep needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(layout as any, {
    width: 1200,
    height: 630,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const png = resvg.render().asPng();
  // ArrayBuffer는 Response(BodyInit)와 직접 호환
  const ab = new ArrayBuffer(png.byteLength);
  new Uint8Array(ab).set(png);
  return ab;
}
