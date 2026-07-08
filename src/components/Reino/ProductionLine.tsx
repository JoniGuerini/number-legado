/** UI de UMA linha de produção do Reino. Componente controlado: recebe o
    estado da linha e callbacks do Reino (que é dono do loop e do save). A
    linguagem visual reaproveita os estilos de Geradores/Ciclos — o que muda é
    a coluna de nomes (geradores nomeados) e o recurso base. */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { fmt, fmtCost, fmtRate, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n, type TKey } from '../../lib/locale';
import { getVideoPrefs, subscribeVideoPrefs } from '../../lib/prefs';
import styles from '../Generators/Generators.module.css';
import cyc from '../Cycles/Cycles.module.css';
import rn from './Reino.module.css';
import {
  CYCLE_BASE_S,
  SIM_STEP_S,
  cycleSecondsOf,
  cycleStepsOf,
  costOf,
  prodPerCycleOf,
  ratePerSecOf,
  type Gen,
  type Line,
  type Mode,
} from './engine';
import type { LineId } from './lines';

interface ProductionLineProps {
  line: Line;
  lineId: LineId;
  onBuy: (i: number) => void;
  onStart: () => void;
  onSetMode: (mode: Mode) => void;
  onToggleAuto: () => void;
}

/** Colunas do card do gerador nomeado: nome largo + 3 stats + botão.
    Inline porque precisa vencer o grid padrão de `.row` de forma confiável
    entre navegadores (o mobile cai para flex-column e ignora isto). */
const NAMED_ROW_COLS = '150px 110px 170px 150px 120px';

export default function ProductionLine({
  line,
  lineId,
  onBuy,
  onStart,
  onSetMode,
  onToggleAuto,
}: ProductionLineProps) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const showCycleBars = useSyncExternalStore(
    subscribeVideoPrefs,
    () => getVideoPrefs().showCycleBars
  );

  const genName = (i: number): string => t(`reino.gen.${lineId}.${i + 1}` as TKey);
  const baseName = t(`reino.base.${lineId}` as TKey);

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
      const p = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToStart = () => animateScroll(() => 0);
  const scrollToEnd = () => animateScroll((el) => el.scrollHeight - el.clientHeight);

  const genCount = line.gens.length;
  useEffect(() => {
    scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genCount]);

  // Bordas recalculadas a cada render (o Reino re-renderiza todo frame).
  const listEl = listRef.current;
  const edges = {
    above: !!listEl && listEl.scrollTop > 4,
    below:
      !!listEl && listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4,
  };

  const isAuto = line.mode === 'auto';

  // Fração de segundo desde o último passo — anima as barras entre passos.
  const partial =
    line.started && line.startedAt !== undefined
      ? Math.min(
          Math.max((Date.now() - line.startedAt) / 1000 - line.steps * SIM_STEP_S, 0),
          SIM_STEP_S
        )
      : 0;

  const cycleProgress = (gen: Gen, i: number): number => {
    if (gen.amount.lte(0)) return 0;
    return Math.min((gen.cycleStep + partial / SIM_STEP_S) / cycleStepsOf(i), 1);
  };

  const dispUptime = line.uptime + (line.gens[0].bought > 0 ? partial : 0);

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push('chave,valor');
    lines.push(
      `inicio_do_save,${line.startedAt !== undefined ? new Date(line.startedAt).toISOString() : ''}`
    );
    lines.push(`tempo_de_jogo_s,${line.uptime.toFixed(1)}`);
    lines.push(`tempo_de_jogo_fmt,${fmtTime(line.uptime)}`);
    lines.push(`modo,${line.mode}`);
    lines.push(`ciclo_base_s,${CYCLE_BASE_S}`);
    lines.push(`recurso_base,${baseName}`);
    lines.push(`base,${line.base.toString()}`);
    lines.push(`base_fmt,${fmt(line.base)}`);
    lines.push(`total_produzido,${line.totalProduced.toString()}`);
    lines.push(`total_produzido_fmt,${fmt(line.totalProduced)}`);
    lines.push('');

    lines.push(
      'gerador,nome,comprados,possui,possui_fmt,ciclo_s,produz_por_ciclo,produz_fmt,desbloqueio_s,desbloqueio_fmt'
    );
    line.gens.forEach((gen, i) => {
      const perCycle = gen.amount.mul(prodPerCycleOf(i));
      lines.push(
        [
          i + 1,
          genName(i),
          gen.bought,
          gen.amount.toString(),
          fmt(gen.amount),
          cycleSecondsOf(i),
          perCycle.toString(),
          fmt(perCycle),
          gen.unlockedAt !== undefined ? gen.unlockedAt.toFixed(1) : '',
          gen.unlockedAt !== undefined ? fmtTime(gen.unlockedAt) : '',
        ].join(',')
      );
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reino-${lineId}-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tela de escolha de modo (save resetado, antes de iniciar a linha)
  if (!line.started) {
    return (
      <div className={styles.modeScreen}>
        <div className={styles.modeCard}>
          <h2 className={styles.modeTitle}>{t('mode.title')}</h2>
          <div className={styles.modeOptions}>
            <button
              className={`${styles.modeBtn} ${!isAuto ? styles.modeActive : ''}`}
              onClick={() => onSetMode('manual')}
            >
              {t('mode.manual')}
            </button>
            <button
              className={`${styles.modeBtn} ${isAuto ? styles.modeActive : ''}`}
              onClick={() => onSetMode('auto')}
            >
              {t('mode.auto')}
            </button>
          </div>
          <p className={styles.modeHint}>
            {isAuto ? t('mode.hintAuto') : t('mode.hintManual')}
          </p>
          <button className="btn-primary" onClick={onStart}>
            {t('common.start')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.corner}>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>
            {line.startedAt !== undefined
              ? new Date(line.startedAt).toLocaleString(getDateLocale(), {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}
          </span>
          <span className={styles.timeLabel}>{t('common.startLabel')}</span>
        </div>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>{fmtTime(dispUptime)}</span>
          <span className={styles.timeLabel}>{t('common.time')}</span>
        </div>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>{fmt(line.totalProduced)}</span>
          <span className={styles.timeLabel}>{t('common.produced')}</span>
        </div>
        <button className={styles.exportBtn} onClick={exportCsv}>
          {t('common.exportCsv')}
        </button>
        <button
          className={`${styles.exportBtn} ${isAuto ? styles.toggleOn : ''}`}
          onClick={onToggleAuto}
        >
          {t('gen.autoToggle', { state: isAuto ? 'on' : 'off' })}
        </button>
      </div>

      <div className={styles.baseBlock}>
        <span className={styles.baseLabel}>{baseName}</span>
        <span className={styles.baseValue}>{fmt(line.base)}</span>
        <span className={styles.baseRate}>
          +{fmtRate(line.gens[0].amount.mul(ratePerSecOf(0)))} / s
        </span>
      </div>

      <div className={styles.listWrap}>
        {edges.above && (
          <button
            className={`${styles.fade} ${styles.fadeTop}`}
            onClick={scrollToStart}
            aria-label={t('common.toStart')}
          >
            ↑
          </button>
        )}

        <div className={styles.list} ref={listRef}>
          {line.gens.map((gen, i) => {
            const cost = costOf(i, gen.bought);
            const target = i === 0 ? baseName : genName(i - 1);

            if (gen.bought === 0) {
              const progress = Math.min(line.base.div(cost).toNumber(), 1);
              return (
                <button
                  key={i}
                  className={`btn-primary ${styles.progressBtn} ${styles.unlockBtn}`}
                  disabled={progress < 1}
                  onClick={() => onBuy(i)}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${progress * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className={styles.progressLabel}>
                    {genName(i)} · {fmtCost(cost)}
                  </span>
                </button>
              );
            }

            const remaining = Math.max(
              cycleSecondsOf(i) - (gen.cycleStep * SIM_STEP_S + partial),
              0
            );

            return (
              <div
                key={i}
                className={styles.row}
                style={{ gridTemplateColumns: NAMED_ROW_COLS }}
              >
                <span className={rn.genName}>{genName(i)}</span>

                <div className={styles.statsRow}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>{t('gen.owns')}</span>
                    <span className={styles.statValue}>{fmt(gen.amount)}</span>
                  </div>

                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      {t('gen.produces', { target })}
                    </span>
                    <span className={styles.statValue}>
                      +{fmt(gen.amount.mul(prodPerCycleOf(i)))}{' '}
                      {t('cyc.perCycleSuffix')}
                    </span>
                  </div>

                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      {t('cyc.cycleEvery', { time: fmtTime(cycleSecondsOf(i)) })}
                    </span>
                    <span className={styles.statValue}>
                      {fmtTime(Math.ceil(remaining))}
                    </span>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  disabled={line.base.lt(cost)}
                  onClick={() => onBuy(i)}
                >
                  {fmtCost(cost)}
                </button>

                {showCycleBars && (
                  <div className={cyc.cycleTrack} aria-hidden="true">
                    <div className={cyc.cycleGroove} />
                    <div
                      className={cyc.cycleFill}
                      style={{ width: `${cycleProgress(gen, i) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {edges.below && (
          <button
            className={`${styles.fade} ${styles.fadeBottom}`}
            onClick={scrollToEnd}
            aria-label={t('common.toEnd')}
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}
