import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n } from '../../lib/locale';
import { loadSave, saveKeyFor } from '../../lib/storage';
// Reusa o esqueleto visual das listas de geradores (scroll, fades)
import gstyles from '../Generators/Generators.module.css';
import styles from './Activity.module.css';

type LogGame = 'geradores';

/** Campos do save que interessam ao log. */
interface GameSaveLite {
  gens: { bought: number; unlockedAt?: number; prevAtUnlock?: string }[];
  uptime: number;
  /** Date.now() do clique em Iniciar. */
  startedAt?: number;
  /** Total de base já produzido na vida do save. */
  totalProduced?: string;
}

interface Entry {
  gen: number;
  unlockedAt: number;
  /** Quantidade do tier anterior no momento do desbloqueio. */
  prevAtUnlock?: string;
  /** Intervalo desde o desbloqueio anterior. */
  delta?: number;
  /** Diferença entre este intervalo e o anterior (ritmo). */
  accel?: number;
}

/** Constrói as entradas do log a partir de um save (gens + uptime). */
function buildEntries(save: GameSaveLite | null | undefined): {
  entries: Entry[];
  uptime: number;
} {
  if (!save) return { entries: [], uptime: 0 };

  const unlocked = save.gens.flatMap((g, i) =>
    g.unlockedAt === undefined
      ? []
      : [{ gen: i + 1, unlockedAt: g.unlockedAt, prevAtUnlock: g.prevAtUnlock }]
  );

  const entries = unlocked.map((e, idx) => {
    const prev = idx === 0 ? 0 : unlocked[idx - 1].unlockedAt;
    const prevPrev = idx <= 1 ? 0 : unlocked[idx - 2].unlockedAt;
    const delta = e.unlockedAt - prev;
    const prevDelta = idx === 0 ? undefined : prev - prevPrev;
    return {
      ...e,
      delta,
      accel: prevDelta !== undefined ? delta - prevDelta : undefined,
    };
  });

  return { entries, uptime: save.uptime };
}

function readLog(key: string): {
  entries: Entry[];
  uptime: number;
  startedAt?: number;
  totalProduced?: string;
} {
  const save = loadSave<GameSaveLite>(key);
  return {
    ...buildEntries(save),
    startedAt: save?.startedAt,
    totalProduced: save?.totalProduced,
  };
}

interface ActivityProps {
  /** Leva o jogador para a aba do jogo (CTA do estado vazio). */
  onNavigate: (game: LogGame) => void;
}

/** Log de desbloqueios, com cada tempo explicado. */
export default function Activity({ onNavigate }: ActivityProps) {
  const { t } = useI18n();
  // Chave do save do slot ativo (trocar de slot remonta o componente)
  const [key] = useState(() => saveKeyFor('geradores'));
  const [log, setLog] = useState(() => readLog(key));
  const { entries, uptime, startedAt, totalProduced } = log;
  const listRef = useRef<HTMLDivElement>(null);

  // O save é gravado 1x/s; reler no mesmo ritmo mantém o log vivo.
  useEffect(() => {
    setLog(readLog(key));
    const id = setInterval(() => setLog(readLog(key)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mesma animação de scroll das listas de geradores (alvo recalculado por frame)
  const scrollAnimRef = useRef(0);
  const animateScroll = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const token = ++scrollAnimRef.current;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;

    const step = (now: number) => {
      const list = listRef.current;
      if (!list || scrollAnimRef.current !== token) return;
      const t = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToStart = () => animateScroll(() => 0);
  const scrollToEnd = () =>
    animateScroll((el) => el.scrollHeight - el.clientHeight);

  // "Colado no fim": segue os registros novos, a menos que o usuário tenha
  // rolado para cima para ler o histórico.
  const stickRef = useRef(true);

  // Entrada nova no log → rola até o fim
  const entryCount = entries.length;
  useEffect(() => {
    if (stickRef.current) scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount]);

  // Setinhas esmaecidas: aparecem quando há conteúdo além das bordas
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }));
  };

  const onListScroll = () => {
    const el = listRef.current;
    if (el) {
      stickRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    }
    updateEdges();
  };

  useEffect(() => {
    updateEdges();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      // A aba oculta tem altura 0; ao ficar visível a lista ganha tamanho e,
      // se estávamos colados no fim, recola direto (sem animação).
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      updateEdges();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount]);

  // ===== Resumo do header =====
  const last = entries[entries.length - 1];
  const avgInterval =
    entries.length > 1 ? last.unlockedAt / (entries.length - 1) : undefined;
  const sinceLast = last ? Math.max(uptime - last.unlockedAt, 0) : 0;

  /** Baixa um .csv com o que a Atividade mostra: o resumo do header e uma
      linha por desbloqueio, com valores brutos (análise) e formatados. */
  const exportCsv = () => {
    if (entries.length === 0) return;

    const lines: string[] = [];

    lines.push('chave,valor');
    lines.push(
      `inicio_do_save,${startedAt !== undefined ? new Date(startedAt).toISOString() : ''}`
    );
    lines.push(`geradores_desbloqueados,${entries.length}`);
    lines.push(`tempo_de_jogo_s,${uptime.toFixed(1)}`);
    lines.push(`tempo_de_jogo_fmt,${fmtTime(uptime)}`);
    if (totalProduced !== undefined) {
      lines.push(`total_produzido,${totalProduced}`);
      lines.push(`total_produzido_fmt,${fmt(new Decimal(totalProduced))}`);
    }
    if (avgInterval !== undefined) {
      lines.push(`media_intervalo_s,${avgInterval.toFixed(1)}`);
      lines.push(`media_intervalo_fmt,${fmtTime(avgInterval)}`);
    }
    lines.push(`desde_ultimo_s,${sinceLast.toFixed(1)}`);
    lines.push(`desde_ultimo_fmt,${fmtTime(sinceLast)}`);
    lines.push('');

    lines.push(
      'gerador,desbloqueio_s,desbloqueio_fmt,tier_anterior,tier_anterior_fmt,delta_desde_anterior_s,delta_fmt,aceleracao_s,aceleracao_fmt'
    );
    entries.forEach((entry) => {
      lines.push(
        [
          entry.gen,
          entry.unlockedAt.toFixed(1),
          fmtTime(entry.unlockedAt),
          entry.prevAtUnlock ?? '',
          entry.prevAtUnlock !== undefined
            ? fmt(new Decimal(entry.prevAtUnlock))
            : '',
          entry.delta !== undefined ? entry.delta.toFixed(1) : '',
          entry.delta !== undefined ? fmtTime(entry.delta) : '',
          entry.accel !== undefined ? entry.accel.toFixed(1) : '',
          entry.accel !== undefined
            ? `${entry.accel > 0 ? '+' : entry.accel < 0 ? '-' : ''}${fmtTime(Math.abs(entry.accel))}`
            : '',
        ].join(',')
      );
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atividade-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gameName = t('nav.geradores');

  return (
    <div className={styles.wrap}>
      {entries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {t('activity.empty', { game: gameName })}
          </p>
          <button className="btn-primary" onClick={() => onNavigate('geradores')}>
            {t('activity.cta', { game: gameName })}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {startedAt !== undefined
                  ? new Date(startedAt).toLocaleString(getDateLocale(), {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
              <span className={styles.summaryLabel}>
                {t('common.startLabel')}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{entries.length}</span>
              <span className={styles.summaryLabel}>{t('activity.unlocked')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(uptime)}</span>
              <span className={styles.summaryLabel}>{t('activity.playTime')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {totalProduced !== undefined
                  ? fmt(new Decimal(totalProduced))
                  : '—'}
              </span>
              <span className={styles.summaryLabel}>
                {t('common.produced')}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {avgInterval !== undefined ? fmtTime(avgInterval) : '—'}
              </span>
              <span className={styles.summaryLabel}>
                {t('activity.avgInterval')}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(sinceLast)}</span>
              <span className={styles.summaryLabel}>{t('activity.sinceLast')}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={gstyles.exportBtn} onClick={exportCsv}>
              {t('common.exportCsv')}
            </button>
          </div>

          <div className={gstyles.listWrap}>
            {edges.above && (
              <button
                className={`${gstyles.fade} ${gstyles.fadeTop}`}
                onClick={scrollToStart}
                aria-label={t('common.toStart')}
              >
                ↑
              </button>
            )}

            <div className={gstyles.list} ref={listRef} onScroll={onListScroll}>
              {entries.map((entry) => (
                <div key={entry.gen} className={styles.entry}>
                  <span className={styles.entryTitle}>
                    {t('activity.generator', { n: entry.gen })}
                  </span>

                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.unlockedWith')}
                      </span>
                      <span className={styles.fieldValue}>
                        {t('activity.ofPlay', { time: fmtTime(entry.unlockedAt) })}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.prevTier')}
                      </span>
                      <span className={styles.fieldValue}>
                        {entry.prevAtUnlock !== undefined
                          ? fmt(new Decimal(entry.prevAtUnlock))
                          : '—'}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.sincePrev')}
                      </span>
                      <span className={styles.fieldValue}>
                        {entry.gen === 1
                          ? t('activity.gameStart')
                          : `+${fmtTime(entry.delta ?? 0)}`}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.pace')}
                      </span>
                      {entry.accel === undefined ? (
                        <span className={styles.fieldValue}>—</span>
                      ) : entry.accel === 0 ? (
                        <span className={styles.fieldValue}>
                          {t('activity.samePace')}
                        </span>
                      ) : (
                        <span
                          className={`${styles.fieldValue} ${
                            entry.accel > 0 ? styles.slower : styles.faster
                          }`}
                        >
                          {entry.accel > 0 ? '+' : '−'}
                          {fmtTime(Math.abs(entry.accel))}{' '}
                          {entry.accel > 0
                            ? t('activity.slower')
                            : t('activity.faster')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {edges.below && (
              <button
                className={`${gstyles.fade} ${gstyles.fadeBottom}`}
                onClick={scrollToEnd}
                aria-label={t('common.toEnd')}
              >
                ↓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
