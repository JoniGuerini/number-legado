import { useEffect } from 'react';

/**
 * Screen Wake Lock — impede a tela de hibernar enquanto o jogo está
 * visível. O SO libera o lock automaticamente quando a aba sai de foco
 * ou é minimizada; o listener de visibilitychange readquire na volta.
 * Em navegadores sem suporte (ou contexto não-HTTPS), não faz nada.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Sem permissão/bateria baixa — segue sem wake lock
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => {});
    };
  }, []);
}
