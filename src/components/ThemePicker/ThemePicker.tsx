import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from 'lucide-react';
import { useI18n } from '../../lib/locale';
import {
  BASIC_THEMES,
  COLOR_THEMES,
  getVideoPrefs,
  setVideoPref,
  subscribeVideoPrefs,
  THEMES,
  type ThemeInfo,
} from '../../lib/prefs';
import styles from './ThemePicker.module.css';

/** Card de tema pintado com as cores dele mesmo, com mini-mockup dentro. */
function ThemeCard({
  theme,
  active = false,
  onSelect,
}: {
  theme: ThemeInfo;
  active?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useI18n();
  const [bg, paper, accentColor, ink] = theme.preview;
  return (
    <button
      className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
      style={{ background: bg }}
      onClick={onSelect}
      disabled={active}
    >
      <span
        className={styles.themeMock}
        style={{ background: paper }}
        aria-hidden="true"
      >
        <span
          className={styles.themeMockTitle}
          style={{ background: accentColor }}
        />
        <span
          className={styles.themeMockLine}
          style={{ background: ink, opacity: 0.55 }}
        />
        <span
          className={styles.themeMockBar}
          style={{ background: accentColor }}
        />
      </span>

      <span className={styles.themeName} style={{ color: ink }}>
        {t(`theme.${theme.id}`)}
      </span>
    </button>
  );
}

interface ThemePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Botão do topo + modal grande com a biblioteca de temas. */
export default function ThemePicker({ open, onOpenChange }: ThemePickerProps) {
  const { t } = useI18n();
  const videoPrefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const active =
    THEMES.find((th) => th.id === videoPrefs.theme) ?? THEMES[0];

  // Modal no body: o botão vive no .topRight (z-index 5); se o overlay
  // ficasse lá dentro, o .topLeft (versão / automático / prestígio) ficaria
  // na mesma camada e não seria escurecido.
  const modal =
    open &&
    createPortal(
      <div className={styles.backdrop} onClick={() => onOpenChange(false)}>
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="themePickerTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.head}>
            <h2 id="themePickerTitle" className={styles.title}>
              {t('themes.title')}
            </h2>
            <p className={styles.hint}>{t('themes.hint')}</p>
          </header>

          <div className={styles.body}>
            <span className={styles.subLabel}>{t('themes.active')}</span>
            <ThemeCard theme={active} active />

            <span className={styles.subLabel}>{t('themes.basic')}</span>
            <div className={styles.themeGrid}>
              {BASIC_THEMES.filter((th) => th.id !== videoPrefs.theme).map(
                (theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    onSelect={() => setVideoPref('theme', theme.id)}
                  />
                )
              )}
            </div>

            <span className={styles.subLabel}>{t('themes.colored')}</span>
            <div className={styles.themeGrid}>
              {COLOR_THEMES.filter((th) => th.id !== videoPrefs.theme).map(
                (theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    onSelect={() => setVideoPref('theme', theme.id)}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        className={`${styles.btn} ${open ? styles.btnOn : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-label={t('themes.open')}
        aria-pressed={open}
        title={t('themes.open')}
      >
        <Palette className={styles.icon} aria-hidden="true" />
      </button>
      {modal}
    </>
  );
}
