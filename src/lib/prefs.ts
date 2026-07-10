/** Preferências de vídeo: telemetria (quais cardzinhos do topo aparecem) e
    tema de cores. Vive na mesma chave de config do som — os módulos gravam
    por merge. */

const CONFIG_KEY = 'number-legado:config';

/* ===== Tema de cores ===== */

export type ThemeId =
  | 'neutro'
  | 'claro'
  | 'midnight'
  | 'creme'
  | 'floresta'
  | 'oceano'
  | 'ameixa'
  | 'salvia';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  /** Amostras da paleta (fundo, card, acento, texto) para o seletor. */
  preview: [string, string, string, string];
}

/** Básicos: o dark e o light neutros, sem cor de identidade. */
export const BASIC_THEMES: ThemeInfo[] = [
  { id: 'neutro', name: 'Dark', preview: ['#070707', '#111111', '#bcb09a', '#e0e0e0'] },
  { id: 'claro', name: 'Light', preview: ['#dedede', '#f4f4f4', '#2f3f58', '#262626'] },
];

/** Coloridos: cada um com base e acento próprios. */
export const COLOR_THEMES: ThemeInfo[] = [
  { id: 'midnight', name: 'Azul meia-noite', preview: ['#0c0e12', '#131620', '#bcb09a', '#d8dce2'] },
  { id: 'creme', name: 'Creme terracota', preview: ['#e8dcc8', '#f7f0e2', '#a34a24', '#3a2e24'] },
  { id: 'floresta', name: 'Floresta', preview: ['#0a100c', '#121a14', '#c48a5a', '#dde6de'] },
  { id: 'oceano', name: 'Oceano', preview: ['#070d10', '#0f171c', '#e08a78', '#dce6ea'] },
  { id: 'ameixa', name: 'Ameixa', preview: ['#0c0a10', '#15121c', '#d4b85a', '#e6e2ec'] },
  { id: 'salvia', name: 'Sálvia', preview: ['#d4ddd4', '#eaf0ea', '#5c2a44', '#1e2820'] },
];

export const THEMES: ThemeInfo[] = [...BASIC_THEMES, ...COLOR_THEMES];

/** Cor da moldura do navegador (theme-color) por tema. */
const THEME_BG: Record<ThemeId, string> = {
  neutro: '#070707',
  claro: '#dedede',
  midnight: '#0c0e12',
  creme: '#e8dcc8',
  floresta: '#0a100c',
  oceano: '#070d10',
  ameixa: '#0c0a10',
  salvia: '#d4ddd4',
};

function applyTheme(theme: ThemeId): void {
  // O tema padrão (neutro) vive no :root; os demais via data-theme
  if (theme === 'neutro') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_BG[theme]);
}

export interface VideoPrefs {
  showFps: boolean;
  showFrameTime: boolean;
  showBattery: boolean;
  /** Heap JS usado (só Chromium expõe performance.memory). */
  showMemory: boolean;
  /** Total de nós de DOM na página — proxy do peso da árvore renderizada. */
  showDomNodes: boolean;
  theme: ThemeId;
}

const DEFAULTS: VideoPrefs = {
  // Telemetria off por padrão — o jogador liga o que quiser (e fica salvo).
  showFps: false,
  showFrameTime: false,
  showBattery: false,
  showMemory: false,
  showDomNodes: false,
  theme: 'neutro',
};

function readStored(): Partial<VideoPrefs> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Partial<VideoPrefs>) : {};
  } catch {
    return {};
  }
}

let prefs: VideoPrefs = { ...DEFAULTS, ...readStored() };
// Saves antigos: tema removido (ex.: 'neve', 'custom') volta pro padrão
if (!(prefs.theme in THEME_BG)) {
  prefs = { ...prefs, theme: DEFAULTS.theme };
}
const listeners = new Set<() => void>();

// Aplica o tema salvo assim que o módulo carrega (antes do primeiro paint)
applyTheme(prefs.theme);

export function getVideoPrefs(): VideoPrefs {
  return prefs;
}

export function setVideoPref<K extends keyof VideoPrefs>(
  key: K,
  value: VideoPrefs[K]
): void {
  prefs = { ...prefs, [key]: value };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...stored, [key]: value }));
  } catch {
    // Sem localStorage — vale só pra sessão
  }
  if (key === 'theme') applyTheme(prefs.theme);
  listeners.forEach((fn) => fn());
}

/** Restaura as preferências de vídeo (tema + telemetria) ao padrão.
    Preserva as chaves de som que dividem a mesma entrada de config. */
export function resetVideoPrefs(): void {
  prefs = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...stored, ...DEFAULTS }));
  } catch {
    // Sem localStorage — vale só pra sessão
  }
  applyTheme(prefs.theme);
  listeners.forEach((fn) => fn());
}

/** Para useSyncExternalStore: componentes reagem na hora aos toggles. */
export function subscribeVideoPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
