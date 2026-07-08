import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useI18n } from '../../lib/locale';
import styles from './FullscreenToggle.module.css';

/** Lembra a preferência de tela cheia entre sessões/refresh. */
const FLAG_KEY = 'number-legado:fullscreen';

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
function writeFlag(on: boolean): void {
  try {
    localStorage.setItem(FLAG_KEY, on ? '1' : '0');
  } catch {
    // Sem localStorage — preferência vale só pra sessão
  }
}

/** Botão fixo no topo que entra/sai de tela cheia (Fullscreen API).
    Não renderiza em navegadores sem suporte (ex.: iOS Safari). */
export default function FullscreenToggle() {
  const { t } = useI18n();
  const [isFull, setIsFull] = useState(false);
  const [supported] = useState(
    () =>
      typeof document !== 'undefined' &&
      typeof document.documentElement.requestFullscreen === 'function'
  );
  // Distingue "saiu da tela cheia" (Esc) de "página sendo recarregada":
  // no unload não limpamos a flag, então a intenção sobrevive ao refresh.
  const unloadingRef = useRef(false);

  // Espelha o estado real no ícone e na flag de preferência.
  useEffect(() => {
    if (!supported) return;
    const onChange = () => {
      const full = !!document.fullscreenElement;
      setIsFull(full);
      if (full) writeFlag(true);
      else if (!unloadingRef.current) writeFlag(false);
    };
    const onBeforeUnload = () => {
      unloadingRef.current = true;
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [supported]);

  // O navegador proíbe entrar em tela cheia no load (exige gesto do usuário).
  // Se a preferência era "tela cheia", reentra no primeiro clique/tecla.
  useEffect(() => {
    if (!supported || !readFlag() || document.fullscreenElement) return;
    const reenter = (e: Event) => {
      // Esc não deve disparar reentrada
      if (e instanceof KeyboardEvent && e.key === 'Escape') return;
      cleanup();
      void document.documentElement.requestFullscreen().catch(() => {});
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', reenter);
      window.removeEventListener('keydown', reenter);
    };
    window.addEventListener('pointerdown', reenter);
    window.addEventListener('keydown', reenter);
    return cleanup;
  }, [supported]);

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const label = isFull ? t('fullscreen.exit') : t('fullscreen.enter');

  return (
    <button
      className={styles.btn}
      onClick={toggle}
      aria-label={label}
      aria-pressed={isFull}
      title={label}
    >
      {isFull ? (
        <Minimize className={styles.icon} aria-hidden="true" />
      ) : (
        <Maximize className={styles.icon} aria-hidden="true" />
      )}
    </button>
  );
}
