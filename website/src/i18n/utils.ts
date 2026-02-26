import en from './en.json';
import ko from './ko.json';

const translations: Record<string, typeof en> = { en, ko };

/**
 * URL에서 현재 로케일을 추출합니다.
 * /ko/ 로 시작하면 'ko', 그 외 'en'
 */
export function getLocale(url: URL): string {
  const base = import.meta.env.BASE_URL; // '/dding-dong/'
  const pathname = url.pathname.replace(base, '/');
  return pathname.startsWith('/ko') ? 'ko' : 'en';
}

/**
 * 번역 텍스트를 dot notation key로 접근합니다.
 * 예: t('hero.title', 'ko') → '띵동'
 */
export function t(key: string, locale: string): string {
  const dict = translations[locale] ?? translations.en;
  const keys = key.split('.');
  let value: unknown = dict;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // fallback: return key itself
    }
  }
  return typeof value === 'string' ? value : key;
}

/**
 * 번역 객체를 직접 반환합니다 (배열이나 객체 접근용).
 */
export function tData<T = unknown>(key: string, locale: string): T {
  const dict = translations[locale] ?? translations.en;
  const keys = key.split('.');
  let value: unknown = dict;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined as T;
    }
  }
  return value as T;
}

/**
 * 로케일별 경로를 생성합니다.
 * localePath('/', 'ko') → '/dding-dong/ko/'
 * localePath('/', 'en') → '/dding-dong/'
 */
export function localePath(path: string, locale: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (locale === 'en') {
    return `${base}${path}`;
  }
  return `${base}/${locale}${path}`;
}

/**
 * 사운드 파일 URL을 생성합니다 (base 경로 포함).
 */
export function soundUrl(pack: string, file: string): string {
  return `${import.meta.env.BASE_URL}sounds/${pack}/${file}`;
}
