/** Internationalization: per-locale dictionary files, language persisted in
    localStorage and a reactive hook in the same pattern as prefs
    (useSyncExternalStore).

    Usage: const { t } = useI18n(); t('nav.geradores'); t('saves.deleteAria', { name: '...' })

    Adding a language (checklist):
    1. Create `src/lib/locale/xx.ts` exporting `const xx: Dict` — the compiler
       enforces every key.
    2. Register it below in LOCALES (autonym), DICTS, HTML_LANG, DATE_LOCALE.
    3. Add its prefix to detectLocale() if it should be auto-detected. */

import { useSyncExternalStore } from 'react';
import { pt, type TKey } from './pt';
import { en } from './en';
import { es } from './es';

export type { Dict, TKey } from './pt';

export type Locale = 'pt' | 'en' | 'es';

const LOCALE_KEY = 'number-legado:locale';

/** Language names in themselves (autonyms) — never translated. */
export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'pt', name: 'Português (Brasil)' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];

const DICTS: Record<Locale, Record<TKey, string>> = { pt, en, es };

const HTML_LANG: Record<Locale, string> = { pt: 'pt-BR', en: 'en', es: 'es' };

const DATE_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

/* ============================================================
   Store (same pattern as prefs.ts)
   ============================================================ */

/** Best match for the OS/browser language (first visit only). */
function detectLocale(): Locale {
  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    if (lang?.toLowerCase().startsWith('pt')) return 'pt';
    if (lang?.toLowerCase().startsWith('es')) return 'es';
    if (lang?.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

const isLocale = (v: string | null): v is Locale =>
  v !== null && v in DICTS;

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // No localStorage — fall through to detection
  }
  // No explicit choice yet: follow the OS/browser language
  return detectLocale();
}

let locale: Locale = readStored();
const listeners = new Set<() => void>();

function applyLocale(l: Locale): void {
  document.documentElement.lang = HTML_LANG[l];
}

applyLocale(locale);

export function getLocale(): Locale {
  return locale;
}

export function setLocale(l: Locale): void {
  locale = l;
  try {
    localStorage.setItem(LOCALE_KEY, l);
  } catch {
    // No localStorage — the choice lasts for the session only
  }
  applyLocale(l);
  listeners.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Restaura o idioma ao padrão: esquece a escolha salva e volta a seguir o
    idioma do sistema/navegador. */
export function resetLocale(): void {
  try {
    localStorage.removeItem(LOCALE_KEY);
  } catch {
    // Sem localStorage — nada a limpar
  }
  locale = detectLocale();
  applyLocale(locale);
  listeners.forEach((fn) => fn());
}

/** Date locale (toLocaleString) matching the UI language. */
export function getDateLocale(): string {
  return DATE_LOCALE[locale];
}

/** Pure translation (no reactivity) — for use outside components. */
export function translate(
  key: TKey,
  params?: Record<string, string | number>
): string {
  let s = DICTS[locale][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

/** Reactive hook: components re-render when the language changes. */
export function useI18n() {
  const current = useSyncExternalStore(subscribeLocale, getLocale);
  const t = (key: TKey, params?: Record<string, string | number>): string => {
    let s = DICTS[current][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };
  return { t, locale: current };
}
