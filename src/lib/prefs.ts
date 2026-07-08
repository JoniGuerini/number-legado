/** Preferências de vídeo: telemetria (quais cardzinhos do topo aparecem) e
    tema de cores. Vive na mesma chave de config do som — os módulos gravam
    por merge. */

const CONFIG_KEY = 'number-legado:config';

/* ===== Tema de cores ===== */

export type ThemeId = 'neutro' | 'midnight' | 'creme' | 'verde';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  /** Amostras da paleta (fundo, card, acento, texto) para o seletor. */
  preview: [string, string, string, string];
}

export const THEMES: ThemeInfo[] = [
  { id: 'neutro', name: 'Dark neutro', preview: ['#070707', '#111111', '#bcb09a', '#e0e0e0'] },
  { id: 'midnight', name: 'Azul meia-noite', preview: ['#0c0e12', '#131620', '#bcb09a', '#d8dce2'] },
  { id: 'creme', name: 'Creme terracota', preview: ['#e8dcc8', '#f7f0e2', '#a34a24', '#3a2e24'] },
  { id: 'verde', name: 'Verde musgo', preview: ['#0a0f0a', '#111811', '#cfa63a', '#dde3dd'] },
];

/** Cor da moldura do navegador (theme-color) por tema. */
const THEME_BG: Record<ThemeId, string> = {
  neutro: '#070707',
  midnight: '#0c0e12',
  creme: '#e8dcc8',
  verde: '#0a0f0a',
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
  /** Barras de progresso do ciclo (Ciclos e Reino). Coluna de tempo já mostra
      o restante, então o jogador pode ocultá-las por gosto. */
  showCycleBars: boolean;
  theme: ThemeId;
}

const DEFAULTS: VideoPrefs = {
  // Telemetria off por padrão — o jogador liga o que quiser (e fica salvo).
  showFps: false,
  showFrameTime: false,
  showBattery: false,
  showMemory: false,
  showDomNodes: false,
  // Exceção: barras de progresso do ciclo vêm ligadas.
  showCycleBars: true,
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
  if (key === 'theme') applyTheme(value as ThemeId);
  listeners.forEach((fn) => fn());
}

/** Restaura as preferências de vídeo (tema + telemetria + barras) ao padrão.
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
