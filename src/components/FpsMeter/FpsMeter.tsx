import { useEffect, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../../lib/locale';
import { getVideoPrefs, subscribeVideoPrefs } from '../../lib/prefs';
import styles from './FpsMeter.module.css';

const BUILD_TIME_MS = new Date(__BUILD_TIME__).getTime();

interface FrameStats {
  fps: number;
  avgMs: number;
  maxMs: number;
  /** Heap JS usado em MB — null onde performance.memory não existe. */
  heapMb: number | null;
  /** Total de elementos no documento. */
  domNodes: number;
}

/** performance.memory é não-padrão (só Chromium). */
interface PerformanceMemory {
  usedJSHeapSize: number;
}

/** Battery Status API (Chrome/Edge; Safari e Firefox não expõem). */
interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
}

/** Desktops sem bateria reportam uma bateria "fantasma": 100%, carregando,
    com 0s restantes de carga — a API não tem um sinal explícito de "sem
    bateria", então filtramos essa assinatura. */
const isPhantomBattery = (m: BatteryManager): boolean =>
  m.charging && m.level === 1 && m.chargingTime === 0;

function useBattery() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(
    null
  );

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };
    if (!nav.getBattery) return;

    let disposed = false;
    let manager: BatteryManager | null = null;
    const update = () => {
      if (manager && !disposed) {
        setBattery(
          isPhantomBattery(manager)
            ? null
            : { level: manager.level, charging: manager.charging }
        );
      }
    };

    void nav.getBattery().then((m) => {
      if (disposed) return;
      manager = m;
      update();
      m.addEventListener('levelchange', update);
      m.addEventListener('chargingchange', update);
      m.addEventListener('chargingtimechange', update);
    });

    return () => {
      disposed = true;
      manager?.removeEventListener('levelchange', update);
      manager?.removeEventListener('chargingchange', update);
      manager?.removeEventListener('chargingtimechange', update);
    };
  }, []);

  return battery;
}

/** Mede FPS e frame time via requestAnimationFrame, atualizando o display 2x por segundo. */
/** Consulta o version.json do servidor (renovado a cada deploy) e avisa
    quando existe uma versão mais nova que a carregada. */
function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    // No dev não existe version.json — o hot reload já cumpre o papel
    if (!import.meta.env.PROD) return;

    let disposed = false;
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data: { buildTime?: string } = await res.json();
        if (
          !disposed &&
          data.buildTime &&
          new Date(data.buildTime).getTime() > BUILD_TIME_MS + 1000
        ) {
          setAvailable(true);
        }
      } catch {
        // Offline/erro de rede — tenta de novo no próximo ciclo
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, []);

  return available;
}

export default function FpsMeter() {
  const { t } = useI18n();
  const [stats, setStats] = useState<FrameStats>({
    fps: 0,
    avgMs: 0,
    maxMs: 0,
    heapMb: null,
    domNodes: 0,
  });
  const battery = useBattery();
  const updateAvailable = useUpdateAvailable();
  const prefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);

  useEffect(() => {
    let rafId: number;
    let frames = 0;
    let maxDelta = 0;
    let windowStart = performance.now();
    let lastFrame = windowStart;
    const perf = performance as Performance & { memory?: PerformanceMemory };

    const tick = (now: number) => {
      frames++;
      maxDelta = Math.max(maxDelta, now - lastFrame);
      lastFrame = now;

      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        setStats({
          fps: Math.round((frames * 1000) / elapsed),
          avgMs: elapsed / frames,
          maxMs: maxDelta,
          heapMb: perf.memory ? perf.memory.usedJSHeapSize / 1048576 : null,
          domNodes: document.getElementsByTagName('*').length,
        });
        frames = 0;
        maxDelta = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className={styles.bar}>
      <div className={styles.pill}>
        <span className={import.meta.env.DEV ? styles.envDev : styles.envProd}>
          {import.meta.env.DEV ? 'localhost' : t('fps.production')}
        </span>
      </div>
      {prefs.showFps && (
        <div className={styles.pill}>
          <span className={styles.value}>{stats.fps}</span>
          <span className={styles.label}>fps</span>
        </div>
      )}
      {prefs.showFrameTime && (
        <div className={styles.pill}>
          <span className={styles.value}>{stats.avgMs.toFixed(1)}</span>
          <span className={styles.label}>ms</span>
          <span className={styles.divider} />
          <span className={styles.label}>{t('fps.max')}</span>
          <span className={styles.value}>{stats.maxMs.toFixed(1)}</span>
        </div>
      )}
      {prefs.showBattery && battery && (
        <div className={styles.pill}>
          <span
            className={`${styles.value} ${
              battery.level <= 0.2 && !battery.charging ? styles.batteryLow : ''
            }`}
          >
            {battery.charging ? '⚡' : ''}
            {Math.round(battery.level * 100)}%
          </span>
          <span className={styles.label}>bat</span>
        </div>
      )}
      {prefs.showMemory && stats.heapMb !== null && (
        <div className={styles.pill}>
          <span className={styles.value}>{stats.heapMb.toFixed(0)}</span>
          <span className={styles.label}>MB</span>
        </div>
      )}
      {prefs.showDomNodes && (
        <div className={styles.pill}>
          <span className={styles.value}>{stats.domNodes}</span>
          <span className={styles.label}>dom</span>
        </div>
      )}
      {updateAvailable ? (
        <button
          className={`${styles.pill} ${styles.updatePill}`}
          onClick={() => window.location.reload()}
        >
          {t('fps.newVersion')}
        </button>
      ) : (
        <div className={styles.pill}>
          <span className={styles.value}>v{__APP_VERSION__}</span>
        </div>
      )}
    </div>
  );
}
