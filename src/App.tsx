import { useEffect, useState } from 'react';
import { History, Settings as SettingsIcon, Swords } from 'lucide-react';
import Generators from './components/Generators/Generators';
import Activity from './components/Activity/Activity';
import Combat from './components/Combat/Combat';
import Settings from './components/Settings/Settings';
import ThemePicker from './components/ThemePicker/ThemePicker';
import { ErrorBoundary } from './components/ErrorBoundary';
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
type Page = GameTab | 'atividade' | 'combate';

/* A última página visitada sobrevive ao refresh */
const PAGE_KEY = 'number-legado:page';
const PAGES: Page[] = ['geradores', 'atividade', 'combate'];

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
  // Host do topo-esquerdo: os jogos portalam seus cardzinhos pra cá, na mesma
  // fileira do card de versão (estado, não ref: precisa re-renderizar ao montar)
  const [topLeftEl, setTopLeftEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // Sem localStorage — vale só pra sessão
    }
  }, [page]);

  // Config e Temas vivem em modais sobre a interface
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
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
      {/* Fileira de controles do topo-direito: telemetria, fullscreen,
          Atividade, Combate e Config — ícones colados na borda */}
      <div className={styles.topRight}>
        <FpsMeter />
        <FullscreenToggle />
        <ThemePicker
          open={themesOpen}
          onOpenChange={(open) => {
            if (open) setSettingsOpen(false);
            setThemesOpen(open);
          }}
        />
        <button
          className={`${styles.cornerBtn} ${styles.cornerBtnSquare} ${page === 'atividade' && !settingsOpen && !themesOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setSettingsOpen(false);
            setThemesOpen(false);
            setPage((p) => (p === 'atividade' ? 'geradores' : 'atividade'));
          }}
          aria-label={t('nav.atividade')}
          aria-pressed={page === 'atividade' && !settingsOpen && !themesOpen}
          title={t('nav.atividade')}
        >
          <History className={styles.cornerIcon} aria-hidden="true" />
        </button>
        <button
          className={`${styles.cornerBtn} ${styles.cornerBtnSquare} ${page === 'combate' && !settingsOpen && !themesOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setSettingsOpen(false);
            setThemesOpen(false);
            setPage((p) => (p === 'combate' ? 'geradores' : 'combate'));
          }}
          aria-label={t('nav.combate')}
          aria-pressed={page === 'combate' && !settingsOpen && !themesOpen}
          title={t('nav.combate')}
        >
          <Swords className={styles.cornerIcon} aria-hidden="true" />
        </button>
        <button
          className={`${styles.cornerBtn} ${styles.cornerBtnSquare} ${settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setThemesOpen(false);
            setSettingsOpen((o) => !o);
          }}
          aria-label={t('nav.config')}
          aria-pressed={settingsOpen}
          title={t('nav.config')}
        >
          <SettingsIcon className={styles.cornerIcon} aria-hidden="true" />
        </button>
      </div>
      {/* Fileira do topo-esquerdo: versão + cardzinhos que os jogos portalam
          aqui (ex.: toggle de Automático) — o flex empurra sem sobrepor,
          mesmo quando o card de versão alarga (aviso de versão nova) */}
      <div className={styles.topLeft} ref={setTopLeftEl}>
        <VersionBadge />
      </div>

      {/* As telas ficam sempre montadas para o progresso não resetar ao trocar de aba. */}
      <ErrorBoundary
        message={t('crash.message')}
        reloadLabel={t('crash.reload')}
      >
        <main
          className={`${styles.contentFull} ${page !== 'geradores' ? styles.hidden : ''}`}
        >
          <Generators
            key={`${slotEpoch}:${resetKeys.geradores}`}
            cornerHost={page === 'geradores' ? topLeftEl : null}
            active={page === 'geradores'}
          />
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
        <main
          className={`${styles.contentFull} ${page !== 'combate' ? styles.hidden : ''}`}
        >
          <Combat />
        </main>
      </ErrorBoundary>

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
