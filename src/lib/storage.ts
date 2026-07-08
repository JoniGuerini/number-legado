/** Persistência em localStorage com sistema de slots de save.

    O conteúdo dos saves e o motor que os consome não mudam — os slots só
    resolvem QUAL chave é lida/gravada, então a sincronia determinística e o
    catch-up ficam intactos. */

import { translate } from './locale';

export type SaveGame = 'geradores';

/** Chaves antigas (pré-slots), migradas para o primeiro slot. */
const LEGACY_KEYS: Record<SaveGame, string> = {
  geradores: 'number-legado:geradores',
};

const SLOTS_META_KEY = 'number-legado:slots';
const GAMES: SaveGame[] = ['geradores'];

export interface SlotMeta {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
}

interface SlotsState {
  activeId: string;
  slots: SlotMeta[];
}

const slotKey = (slotId: string, game: SaveGame): string =>
  `number-legado:slot:${slotId}:${game}`;

const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function readMeta(): SlotsState | null {
  try {
    const raw = localStorage.getItem(SLOTS_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as SlotsState;
    return meta.slots?.length > 0 ? meta : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: SlotsState): void {
  try {
    localStorage.setItem(SLOTS_META_KEY, JSON.stringify(meta));
  } catch {
    // Sem localStorage — slots valem só pra sessão
  }
}

/** Garante que o sistema de slots existe; na primeira vez, migra os saves
    antigos (chaves fixas) para dentro do "Save 1" — cópia literal das
    strings, preservando startedAt/steps byte a byte. */
function ensureMeta(): SlotsState {
  const existing = readMeta();
  if (existing) return existing;

  const slot: SlotMeta = {
    id: genId(),
    name: 'Save 1',
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
  };

  for (const game of GAMES) {
    try {
      const raw = localStorage.getItem(LEGACY_KEYS[game]);
      if (raw !== null) {
        localStorage.setItem(slotKey(slot.id, game), raw);
        localStorage.removeItem(LEGACY_KEYS[game]);
      }
    } catch {
      // segue sem migrar este jogo
    }
  }

  const meta: SlotsState = { activeId: slot.id, slots: [slot] };
  writeMeta(meta);
  return meta;
}

/** Chave de save do jogo no slot ativo. */
export function saveKeyFor(game: SaveGame): string {
  return slotKey(ensureMeta().activeId, game);
}

/** Chave de save do jogo num slot específico (ativo ou não). */
export function saveKeyForSlot(slotId: string, game: SaveGame): string {
  return slotKey(slotId, game);
}

export function getActiveSlotId(): string {
  return ensureMeta().activeId;
}

export function listSlots(): SlotMeta[] {
  return [...ensureMeta().slots].sort((a, b) => a.createdAt - b.createdAt);
}

/** Next available generic name, localized
    ("Save N" / "Jogo salvo N" / "Partida N"). */
export function nextSlotName(): string {
  const meta = ensureMeta();
  const maxN = meta.slots.reduce((max, s) => {
    const m = /^(?:Save|Jogo salvo|Partida) (\d+)$/.exec(s.name);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return translate('saves.defaultName', { n: maxN + 1 });
}

/** Cria um slot vazio (sem trocar para ele), com nome opcional. */
export function createSlot(name?: string): SlotMeta {
  const meta = ensureMeta();
  const slot: SlotMeta = {
    id: genId(),
    name: name?.trim() || nextSlotName(),
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
  };
  writeMeta({ ...meta, slots: [...meta.slots, slot] });
  return slot;
}

/** Renomeia um slot (nome vazio é ignorado). */
export function renameSlot(id: string, name: string): void {
  const meta = ensureMeta();
  const trimmed = name.trim();
  if (!trimmed) return;
  writeMeta({
    ...meta,
    slots: meta.slots.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
  });
}

export function switchSlot(id: string): void {
  const meta = ensureMeta();
  if (!meta.slots.some((s) => s.id === id)) return;
  writeMeta({
    activeId: id,
    slots: meta.slots.map((s) =>
      s.id === id ? { ...s, lastPlayedAt: Date.now() } : s
    ),
  });
}

/** Exclui um slot (não permite excluir o ativo) e apaga os saves dele. */
export function deleteSlot(id: string): void {
  const meta = ensureMeta();
  if (id === meta.activeId) return;
  for (const game of GAMES) {
    try {
      localStorage.removeItem(slotKey(id, game));
    } catch {
      // segue
    }
  }
  writeMeta({ ...meta, slots: meta.slots.filter((s) => s.id !== id) });
}

export function loadSave<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSave(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function clearSave(key: string): void {
  localStorage.removeItem(key);
}
