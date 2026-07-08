import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import Generators from './components/Generators/Generators';
import Activity from './components/Activity/Activity';
import Settings from './components/Settings/Settings';
import FpsMeter, { VersionBadge } from './components/FpsMeter/FpsMeter';
import FullscreenToggle from './components/FullscreenToggle/FullscreenToggle';
import { useWakeLock } from './hooks/useWakeLock';
import { useI18n } from './lib/locale';
import { playPress, playRelease } from './lib/sound';
import {
  clearSave,
  createSlot,
  deleteSlot,
  getActiveSlotId,
  listSlots,
  renameSlot,
  saveKeyForSlot,
  switchSlot,
} from './lib/storage';
import styles from './App.module.css';

export type GameTab = 'geradores';
type Page = GameTab | 'atividade';

/* A última página visitada sobrevive ao refresh */
const PAGE_KEY = 'number-legado:page';
const PAGES: Page[] = ['geradores', 'atividade'];

function readStoredPage(): Page {
  try {
    const stored = localStorage.getItem(PAGE_KEY);
    if (stored && (PAGES as string[]).includes(stored)) return stored as Page;
  } catch {
    // Sem localStorage — cai no padrão
  }
  return 'geradores';
}

export default function App() {
  useWakeLock();
  const { t } = useI18n();

  // Feedback sonoro global: um som ao pressionar qualquer botão habilitado e
  // outro (variação mais leve) ao soltar — sensação de tecla física.
  // CAPTURE, não bubble: o React processa o clique (compra etc.) de forma
  // síncrona antes de o evento chegar ao document, e a compra bem-sucedida
  // costuma DESABILITAR o botão (preço sobe > saldo) — no bubble, o clique
  // que funcionou era avaliado contra o DOM pós-compra e ficava mudo.
  useEffect(() => {
    // Um registro por pointerId: dois dedos no touch não engolem o soltar.
    const down = new Set<number>();

    const onPointerDown = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button');
      if (btn && !btn.disabled && !btn.hasAttribute('data-nosound')) {
        down.add(e.pointerId);
        playPress();
      }
    };
    // O soltar toca mesmo se o dedo/cursor saiu do botão (como tecla real)
    const onPointerUp = (e: PointerEvent) => {
      if (down.delete(e.pointerId)) playRelease();
    };
    // Gesto cancelado (virou scroll etc.): esquece o toque sem som de soltar
    const onPointerCancel = (e: PointerEvent) => {
      down.delete(e.pointerId);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }, []);

  const [page, setPage] = useState<Page>(readStoredPage);
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // Sem localStorage — vale só pra sessão
    }
  }, [page]);

  // Config vive num modal sobre a interface (não é mais uma página exclusiva)
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);
  // Trocar a key remonta o componente da aba, zerando só aquele jogo.
  const [resetKeys, setResetKeys] = useState({ geradores: 0 });

  // ===== Slots de save =====
  const [slots, setSlots] = useState(listSlots);
  const [activeSlotId, setActiveSlotId] = useState(getActiveSlotId);

  // Zera um modo de um slot específico; se for o ativo, remonta o jogo.
  const resetGame = (slotId: string, game: GameTab) => {
    clearSave(saveKeyForSlot(slotId, game));
    if (slotId === activeSlotId) {
      setResetKeys((keys) => ({ ...keys, [game]: keys[game] + 1 }));
    }
  };
  // Muda a cada troca de slot: remonta os jogos, que carregam do slot novo
  const [slotEpoch, setSlotEpoch] = useState(0);

  const refreshSlots = () => {
    setSlots(listSlots());
    setActiveSlotId(getActiveSlotId());
  };

  // Cria sem trocar: o jogador carrega o save novo quando quiser
  const handleCreateSlot = (name?: string) => {
    createSlot(name);
    refreshSlots();
  };

  const handleRenameSlot = (id: string, name: string) => {
    renameSlot(id, name);
    refreshSlots();
  };

  const handleSwitchSlot = (id: string) => {
    if (id === activeSlotId) return;
    switchSlot(id);
    refreshSlots();
    setSlotEpoch((e) => e + 1);
  };

  const handleDeleteSlot = (id: string) => {
    if (id === activeSlotId) return;
    deleteSlot(id);
    refreshSlots();
  };

  return (
    <div className={styles.frame}>
      {/* Fileira de controles do topo-direito: telemetria, fullscreen e a
          engrenagem de Config colada na borda */}
      <div className={styles.topRight}>
        <FpsMeter />
        <FullscreenToggle />
        <button
          className={`${styles.cornerBtn} ${styles.cornerBtnSquare} ${settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label={t('nav.config')}
          aria-pressed={settingsOpen}
          title={t('nav.config')}
        >
          <SettingsIcon className={styles.cornerIcon} aria-hidden="true" />
        </button>
      </div>
      <VersionBadge />

      {/* As telas ficam sempre montadas para o progresso não resetar ao trocar de aba. */}
      <main
        className={`${styles.contentFull} ${page !== 'geradores' ? styles.hidden : ''}`}
      >
        <Generators key={`${slotEpoch}:${resetKeys.geradores}`} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'atividade' ? styles.hidden : ''}`}
      >
        {/* Remonta ao zerar o jogo (ou trocar de slot) para o log acompanhar */}
        <Activity
          key={`${slotEpoch}:${resetKeys.geradores}`}
          onNavigate={setPage}
        />
      </main>

      <footer className={styles.footer}>
        <nav className={styles.tabs}>
          {PAGES.map((p) => (
            <button
              key={p}
              className={`${styles.tab} ${page === p && !settingsOpen ? styles.active : ''}`}
              onClick={() => {
                setSettingsOpen(false);
                setPage(p);
              }}
            >
              {t(`nav.${p}`)}
            </button>
          ))}
        </nav>
      </footer>

      {settingsOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings
              onReset={resetGame}
              slots={slots}
              activeSlotId={activeSlotId}
              onCreateSlot={handleCreateSlot}
              onSwitchSlot={handleSwitchSlot}
              onDeleteSlot={handleDeleteSlot}
              onRenameSlot={handleRenameSlot}
            />
          </div>
        </div>
      )}
    </div>
  );
}
