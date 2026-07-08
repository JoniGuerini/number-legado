import { useState, useSyncExternalStore } from 'react';
import type { GameTab } from '../../App';
import {
  getDateLocale,
  LOCALES,
  resetLocale,
  setLocale,
  useI18n,
  type TKey,
} from '../../lib/locale';
import {
  getVideoPrefs,
  resetVideoPrefs,
  setVideoPref,
  subscribeVideoPrefs,
  THEMES,
  type VideoPrefs,
} from '../../lib/prefs';
import {
  getSoundVolume,
  isSoundOn,
  playPress,
  resetSound,
  setSoundOn,
  setSoundVolume,
} from '../../lib/sound';
import {
  loadSave,
  nextSlotName,
  saveKeyForSlot,
  type SlotMeta,
} from '../../lib/storage';
import styles from './Settings.module.css';

const GAMES: GameTab[] = ['geradores'];

/** Campos que sinalizam progresso iniciado no save. */
interface SaveProbe {
  started?: boolean;
}

/** Há progresso para zerar? (jogo de fato iniciado, não só o save gravado
    automaticamente — conta pela saída da tela de escolha de modo). */
function hasProgress(slotId: string, game: GameTab): boolean {
  const s = loadSave<SaveProbe>(saveKeyForSlot(slotId, game));
  return s?.started === true;
}

const VIDEO_TOGGLES: {
  key: Exclude<keyof VideoPrefs, 'theme'>;
  label: TKey;
}[] = [
  { key: 'showFps', label: 'video.fps' },
  { key: 'showFrameTime', label: 'video.frameTime' },
  { key: 'showBattery', label: 'video.battery' },
  { key: 'showMemory', label: 'video.memory' },
  { key: 'showDomNodes', label: 'video.domNodes' },
];

type ConfigTab = 'saves' | 'temas' | 'som' | 'video' | 'idioma';

const TABS: ConfigTab[] = ['saves', 'temas', 'som', 'video', 'idioma'];

/** Card de tema pintado com as cores dele mesmo, com mini-mockup dentro. */
function ThemeCard({
  theme,
  active = false,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  active?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useI18n();
  const [bg, paper, accentColor, ink] = theme.preview;
  return (
    <button
      className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
      style={{ background: bg, ['--theme-accent' as string]: accentColor }}
      onClick={onSelect}
      disabled={active}
    >
      {/* Mini-mockup: um card do tema com texto e barra de acento */}
      <span
        className={styles.themeMock}
        style={{ background: paper }}
        aria-hidden="true"
      >
        <span className={styles.themeMockTitle} style={{ background: accentColor }} />
        <span
          className={styles.themeMockLine}
          style={{ background: ink, opacity: 0.55 }}
        />
        <span className={styles.themeMockBar} style={{ background: accentColor }} />
      </span>

      <span className={styles.themeName} style={{ color: ink }}>
        {t(`theme.${theme.id}`)}
      </span>
    </button>
  );
}

const fmtSlotDate = (ms: number, dateLocale: string): string =>
  new Date(ms).toLocaleString(dateLocale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

interface SettingsProps {
  onReset: (slotId: string, game: GameTab) => void;
  slots: SlotMeta[];
  activeSlotId: string;
  onCreateSlot: (name?: string) => void;
  onSwitchSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
}

export default function Settings({
  onReset,
  slots,
  activeSlotId,
  onCreateSlot,
  onSwitchSlot,
  onDeleteSlot,
  onRenameSlot,
}: SettingsProps) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<ConfigTab>('saves');
  // Slot com as opções (carregar / renomear / zerar) abertas abaixo dele
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  // Rascunho do nome no painel expandido (renomear)
  const [renameDraft, setRenameDraft] = useState('');
  // Criação de save: input com nome pré-preenchido antes de confirmar
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [volume, setVolume] = useState(getSoundVolume());
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  // Confirmação em duas etapas do botão de restaurar configs
  const [confirmReset, setConfirmReset] = useState(false);

  const toggleSound = () => {
    setSoundOn(!soundOn);
    setSoundOnState(!soundOn);
  };

  // Restaura temas, som, vídeo e idioma ao padrão (não toca nos jogos salvos).
  const resetAllConfig = () => {
    resetVideoPrefs();
    resetSound();
    setVolume(getSoundVolume());
    setSoundOnState(isSoundOn());
    resetLocale();
    setConfirmReset(false);
  };

  const confirmCreate = () => {
    onCreateSlot(createName);
    setCreating(false);
  };
  const videoPrefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.tabs}>
        {TABS.map((id) => (
          <button
            key={id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`tab.${id}`)}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {tab === 'saves' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('saves.title')}</h2>
            <p className={styles.sectionHint}>{t('saves.hint')}</p>
            <div className={styles.sectionBody}>
              {slots.map((slot) => {
                const active = slot.id === activeSlotId;
                const expanded = slot.id === expandedSlotId;
                // Nenhum dos 3 modos iniciado: save vazio (sem data pra mostrar)
                const empty = !GAMES.some((g) => hasProgress(slot.id, g));
                return (
                  <div key={slot.id} className={styles.slotBlock}>
                    <div className={styles.slotRow}>
                      <button
                        className={`${styles.option} ${active ? styles.active : ''}`}
                        onClick={() => {
                          if (expanded) {
                            setExpandedSlotId(null);
                          } else {
                            setExpandedSlotId(slot.id);
                            setRenameDraft(slot.name);
                          }
                        }}
                      >
                        <span>
                          {slot.name}
                          <span className={styles.slotDate}>
                            {' · '}
                            {empty
                              ? t('saves.noData')
                              : fmtSlotDate(slot.lastPlayedAt, getDateLocale())}
                          </span>
                        </span>
                        <span className={styles.badge}>
                          {active && t('saves.active')}
                          <svg
                            className={`${styles.caret} ${expanded ? styles.caretUp : ''}`}
                            width="9"
                            height="6"
                            viewBox="0 0 9 6"
                            aria-hidden="true"
                          >
                            <path
                              d="M1 1.5 L4.5 4.5 L8 1.5"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>
                      {/* The active save can't be deleted, so its button
                          doesn't render — the card takes the full row */}
                      {!active && (
                        <button
                          className={`${styles.slotDelete} ${styles.slotDeleteOn}`}
                          onClick={() => onDeleteSlot(slot.id)}
                          aria-label={t('saves.deleteAria', { name: slot.name })}
                        >
                          {/* SVG instead of the ✕ character: the glyph size
                              varied between macOS and Windows (fallback font) */}
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 10 10"
                            aria-hidden="true"
                          >
                            <path
                              d="M1 1 L9 9 M9 1 L1 9"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {expanded && (
                      <div className={styles.slotOptions}>
                        <div className={styles.nameRow}>
                          <input
                            className={styles.nameInput}
                            value={renameDraft}
                            maxLength={40}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                onRenameSlot(slot.id, renameDraft);
                            }}
                            aria-label={t('saves.nameAria', { name: slot.name })}
                          />
                          <button
                            className="btn-secondary"
                            disabled={
                              !renameDraft.trim() ||
                              renameDraft.trim() === slot.name
                            }
                            onClick={() => onRenameSlot(slot.id, renameDraft)}
                          >
                            {t('saves.rename')}
                          </button>
                        </div>
                        {!active && (
                          <button
                            className={`btn-primary ${styles.loadBtn}`}
                            onClick={() => {
                              onSwitchSlot(slot.id);
                              setExpandedSlotId(null);
                            }}
                          >
                            {t('saves.load')}
                          </button>
                        )}
                        <div className={styles.resetRow}>
                          {GAMES.map((game) => (
                            <button
                              key={game}
                              className={styles.dangerBtn}
                              disabled={!hasProgress(slot.id, game)}
                              onClick={() => onReset(slot.id, game)}
                            >
                              {t('saves.reset', { game: t(`nav.${game}`) })}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {creating ? (
                <div className={styles.nameRow}>
                  <input
                    className={styles.nameInput}
                    value={createName}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCreate();
                      if (e.key === 'Escape') setCreating(false);
                    }}
                    aria-label={t('saves.newNameAria')}
                  />
                  <button className="btn-primary" onClick={confirmCreate}>
                    {t('saves.confirmCreate')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setCreating(false)}
                  >
                    {t('saves.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setCreateName(nextSlotName());
                    setCreating(true);
                  }}
                >
                  {t('saves.create')}
                </button>
              )}
            </div>
          </section>
        )}

        {tab === 'som' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('sound.title')}</h2>
            <p className={styles.sectionHint}>{t('sound.hint')}</p>
            <div className={styles.sectionBody}>
              <button
                className={styles.option}
                role="switch"
                aria-checked={soundOn}
                onClick={toggleSound}
              >
                <span>{t('sound.enabled')}</span>
                <span
                  className={`${styles.switch} ${soundOn ? styles.switchOn : ''}`}
                  aria-hidden="true"
                >
                  <span className={styles.switchThumb} />
                </span>
              </button>
              <div className={styles.volumeRow}>
                <div className={styles.sliderShell}>
                  {/* Canaleta (baixo relevo) e preenchimento (alto relevo) */}
                  <div className={styles.trackGroove} aria-hidden="true" />
                  <div
                    className={styles.trackFill}
                    style={{ width: `${Math.round(volume * 100)}%` }}
                    aria-hidden="true"
                  />
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                    onPointerUp={() => playPress()}
                    aria-label={t('sound.volumeAria')}
                  />
                </div>
                <span className={styles.volumeValue}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </section>
        )}

        {tab === 'temas' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('themes.title')}</h2>
            <p className={styles.sectionHint}>{t('themes.hint')}</p>

            <span className={styles.subLabel}>{t('themes.active')}</span>
            {(() => {
              const active =
                THEMES.find((th) => th.id === videoPrefs.theme) ?? THEMES[0];
              return <ThemeCard theme={active} active />;
            })()}

            <span className={styles.subLabel}>{t('themes.available')}</span>
            <div className={styles.themeGrid}>
              {THEMES.filter((th) => th.id !== videoPrefs.theme).map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  onSelect={() => setVideoPref('theme', theme.id)}
                />
              ))}
            </div>
          </section>
        )}

        {tab === 'video' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('video.title')}</h2>
            <p className={styles.sectionHint}>{t('video.hint')}</p>
            <div className={styles.sectionBody}>
              {/* Master switch: on when every card is on; toggles all at once */}
              {(() => {
                const allOn = VIDEO_TOGGLES.every((tg) => videoPrefs[tg.key]);
                return (
                  <button
                    className={styles.option}
                    role="switch"
                    aria-checked={allOn}
                    onClick={() =>
                      VIDEO_TOGGLES.forEach((tg) =>
                        setVideoPref(tg.key, !allOn)
                      )
                    }
                  >
                    <span>{t('video.all')}</span>
                    <span
                      className={`${styles.switch} ${allOn ? styles.switchOn : ''}`}
                      aria-hidden="true"
                    >
                      <span className={styles.switchThumb} />
                    </span>
                  </button>
                );
              })()}
              <span className={styles.subLabel}>{t('video.individual')}</span>
              {VIDEO_TOGGLES.map((toggle) => {
                const on = videoPrefs[toggle.key];
                return (
                  <button
                    key={toggle.key}
                    className={styles.option}
                    role="switch"
                    aria-checked={on}
                    onClick={() => setVideoPref(toggle.key, !on)}
                  >
                    <span>{t(toggle.label)}</span>
                    <span
                      className={`${styles.switch} ${on ? styles.switchOn : ''}`}
                      aria-hidden="true"
                    >
                      <span className={styles.switchThumb} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'idioma' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lang.title')}</h2>
            <p className={styles.sectionHint}>{t('lang.hint')}</p>
            <div className={styles.sectionBody}>
              {LOCALES.map((l) => {
                const active = l.id === locale;
                return (
                  <button
                    key={l.id}
                    className={`${styles.option} ${active ? styles.active : ''}`}
                    onClick={() => setLocale(l.id)}
                  >
                    <span>{l.name}</span>
                    {active && (
                      <span className={styles.badge}>{t('saves.active')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className={styles.footer}>
        {confirmReset ? (
          <div className={styles.resetConfirm}>
            <span className={styles.resetWarn}>{t('config.resetWarn')}</span>
            <div className={styles.resetActions}>
              <button className="btn-primary" onClick={resetAllConfig}>
                {t('config.resetConfirm')}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setConfirmReset(false)}
              >
                {t('saves.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => setConfirmReset(true)}
          >
            {t('config.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
