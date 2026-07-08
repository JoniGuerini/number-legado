import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import Decimal from 'break_eternity.js';
import { useVirtualRows } from '../../hooks/useVirtualRows';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n } from '../../lib/locale';
import { getVideoPrefs, subscribeVideoPrefs } from '../../lib/prefs';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import styles from '../Generators/Generators.module.css';
import cyc from './Cycles.module.css';

interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (em segundos) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
  /** Passos já cumpridos do ciclo atual. */
  cycleStep: number;
}

type Mode = 'manual' | 'auto';

interface Game {
  base: Decimal;
  /** Total de base já produzido na vida do save (compras não descontam). */
  totalProduced: Decimal;
  gens: Gen[];
  mode: Mode;
  /** false = ainda na tela de escolha de modo. */
  started: boolean;
  /** Date.now() do clique em Iniciar — âncora de toda a simulação. */
  startedAt?: number;
  /** Passos fixos de simulação executados desde o início. */
  steps: number;
  /** Tempo de jogo em segundos (conta a partir da 1ª compra do Gerador 1). */
  uptime: number;
}

interface CycSave {
  base: string;
  totalProduced?: string;
  gens: { amount: string; bought: number; unlockedAt?: number; cycleStep: number }[];
  uptime: number;
  mode?: Mode;
  started?: boolean;
  startedAt?: number;
  steps?: number;
  savedAt?: number;
}

const START_BASE = new Decimal(1);

/** Timestep fixo (mesma arquitetura determinística dos Geradores). */
const SIM_STEP_S = 0.25;
/** Ciclo do Gerador 1; cada gerador seguinte tem ciclo proporcionalmente
    mais longo: ciclo do gerador N = 5s × N (5s, 10s, 15s...). */
const CYCLE_BASE_S = 5;
/** Taxa média por unidade (0.1/s): a entrega por ciclo cresce na mesma
    proporção da duração, então todo gerador rende o mesmo na média — o que
    muda é a cadência (lotes mais raros e mais gordos no fundo da cadeia). */
const AVG_RATE = new Decimal(0.1);
/** Teto de passos por frame no catch-up. */
const MAX_STEPS_PER_FRAME = 2_000;

/** Duração do ciclo do gerador de índice i, em segundos. */
const cycleSecondsOf = (i: number): number => CYCLE_BASE_S * (i + 1);
/** Duração do ciclo em passos de simulação. */
const cycleStepsOf = (i: number): number => cycleSecondsOf(i) / SIM_STEP_S;
/** Entrega por unidade ao completar o ciclo: 0.1/s × duração (0.5, 1.0, 1.5...). */
const prodPerCycleOf = (i: number): Decimal => AVG_RATE.mul(cycleSecondsOf(i));

const newGen = (): Gen => ({ amount: new Decimal(0), bought: 0, cycleStep: 0 });

/** Mesma curva de custos dos Geradores, para comparar o pacing. */
const COST_CURVE = 0.004;

function costOf(i: number, bought: number): Decimal {
  return Decimal.pow(10, i + COST_CURVE * i * i)
    .mul(Decimal.pow(2, bought))
    .round();
}

/** Executa nSteps passos fixos. Função pura e determinística. */
function advance(g: Game, nSteps: number): Game {
  const gens = g.gens.map((x) => ({ ...x }));
  let base = g.base;
  let totalProduced = g.totalProduced;
  let uptime = g.uptime;

  for (let s = 0; s < nSteps; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    // Do topo da cadeia para a base: cada gerador cumpre seu ciclo e, ao
    // completar, entrega o lote inteiro ao nível de baixo de uma vez.
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;

      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleStepsOf(i)) {
        gen.cycleStep = 0;
        const out = gen.amount.mul(prodPerCycleOf(i));
        if (i === 0) {
          base = base.add(out);
          totalProduced = totalProduced.add(out);
        } else {
          gens[i - 1].amount = gens[i - 1].amount.add(out);
        }
      }
    }

    // Modo automático (estrito): só desbloqueia o próximo bloqueado ou empilha
    // o mais alto já desbloqueado — nunca níveis abaixo; se não couber, espera.
    if (g.mode === 'auto') {
      const last = gens.length - 1;
      const lastLocked = gens[last].bought === 0;
      const candidates = lastLocked ? [last, last - 1] : [last];
      for (const i of candidates) {
        if (i < 0) continue;
        const cost = costOf(i, gens[i].bought);
        if (base.lt(cost)) continue;
        const wasLocked = gens[i].bought === 0;
        base = base.sub(cost);
        gens[i].bought += 1;
        gens[i].amount = gens[i].amount.add(1);
        if (wasLocked) {
          gens[i].unlockedAt = uptime;
          if (i === last) gens.push(newGen());
        }
        break;
      }
    }
  }

  return { ...g, base, totalProduced, gens, uptime, steps: g.steps + nSteps };
}

function loadGame(saveKey: string): Game {
  const s = loadSave<CycSave>(saveKey);
  if (!s || s.gens.length === 0) {
    return {
      base: START_BASE,
      totalProduced: new Decimal(0),
      gens: [newGen()],
      mode: 'manual',
      started: false,
      steps: 0,
      uptime: 0,
    };
  }

  const started = s.started ?? true;
  const startedAt =
    s.startedAt ?? (started ? Date.now() - s.uptime * 1000 : undefined);
  const steps = s.steps ?? Math.floor(s.uptime / SIM_STEP_S);

  return {
    base: new Decimal(s.base),
    // Saves antigos não registravam: usa o saldo atual como piso.
    totalProduced: new Decimal(s.totalProduced ?? s.base),
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
      cycleStep: g.cycleStep ?? 0,
    })),
    mode: s.mode ?? 'manual',
    started,
    startedAt,
    steps,
    uptime: s.uptime,
  };
}

export default function Cycles() {
  const { t } = useI18n();
  // Amarra a instância ao slot ativo do momento da montagem
  const [saveKey] = useState(() => saveKeyFor('ciclos'));
  const [game, setGame] = useState<Game>(() => loadGame(saveKey));
  // Re-render por frame para as barras de ciclo andarem suaves.
  const [, bumpFrame] = useReducer((x: number) => x + 1, 0);
  const listRef = useRef<HTMLDivElement>(null);

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

  const genCount = game.gens.length;
  useEffect(() => {
    scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genCount]);

  // Bordas calculadas a cada render (o componente re-renderiza todo frame):
  // sempre frescas, mesmo quando a virtualização muda a altura do conteúdo
  // sem disparar eventos de scroll/resize.
  const listEl = listRef.current;
  const edges = {
    above: !!listEl && listEl.scrollTop > 4,
    below:
      !!listEl && listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4,
  };

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef(game);
  saveRef.current = game;
  useEffect(() => {
    const persist = () => {
      const g = saveRef.current;
      writeSave(saveKey, {
        base: g.base.toString(),
        totalProduced: g.totalProduced.toString(),
        gens: g.gens.map((x) => ({
          amount: x.amount.toString(),
          bought: x.bought,
          unlockedAt: x.unlockedAt,
          cycleStep: x.cycleStep,
        })),
        uptime: g.uptime,
        mode: g.mode,
        started: g.started,
        startedAt: g.startedAt,
        steps: g.steps,
        savedAt: Date.now(),
      } satisfies CycSave);
    };
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, []);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      setGame((g) => {
        if (!g.started || g.startedAt === undefined) return g;
        const target = Math.floor((Date.now() - g.startedAt) / (SIM_STEP_S * 1000));
        const todo = Math.min(target - g.steps, MAX_STEPS_PER_FRAME);
        return todo > 0 ? advance(g, todo) : g;
      });
      bumpFrame();

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const buy = (i: number) => {
    setGame((g) => {
      const cost = costOf(i, g.gens[i].bought);
      if (g.base.lt(cost)) return g;

      const gens = g.gens.map((x) => ({ ...x }));
      gens[i].bought += 1;
      gens[i].amount = gens[i].amount.add(1);
      if (gens[i].bought === 1) gens[i].unlockedAt = g.uptime;
      if (i === g.gens.length - 1) gens.push(newGen());

      return { ...g, base: g.base.sub(cost), gens };
    });
  };

  const isAuto = game.mode === 'auto';
  const showCycleBars = useSyncExternalStore(
    subscribeVideoPrefs,
    () => getVideoPrefs().showCycleBars
  );

  // Fração de segundo desde o último passo — anima as barras entre passos.
  const partial =
    game.started && game.startedAt !== undefined
      ? Math.min(
          Math.max((Date.now() - game.startedAt) / 1000 - game.steps * SIM_STEP_S, 0),
          SIM_STEP_S
        )
      : 0;

  /** Progresso do ciclo do gerador i (0..1), extrapolado dentro do passo. */
  const cycleProgress = (gen: Gen, i: number): number => {
    if (gen.amount.lte(0)) return 0;
    return Math.min((gen.cycleStep + partial / SIM_STEP_S) / cycleStepsOf(i), 1);
  };

  const dispUptime = game.uptime + (game.gens[0].bought > 0 ? partial : 0);

  // Cards fora da janela visível viram fantasmas (mesma altura, sem conteúdo)
  const virtual = useVirtualRows(listRef, game.gens.length, 8);

  const exportCsv = () => {
    const lines: string[] = [];

    lines.push('chave,valor');
    lines.push(
      `inicio_do_save,${game.startedAt !== undefined ? new Date(game.startedAt).toISOString() : ''}`
    );
    lines.push(`tempo_de_jogo_s,${game.uptime.toFixed(1)}`);
    lines.push(`tempo_de_jogo_fmt,${fmtTime(game.uptime)}`);
    lines.push(`modo,${game.mode}`);
    lines.push(`ciclo_base_s,${CYCLE_BASE_S}`);
    lines.push(`numero_base,${game.base.toString()}`);
    lines.push(`numero_base_fmt,${fmt(game.base)}`);
    lines.push(`total_produzido,${game.totalProduced.toString()}`);
    lines.push(`total_produzido_fmt,${fmt(game.totalProduced)}`);
    lines.push('');

    lines.push(
      'gerador,comprados,possui,possui_fmt,ciclo_s,produz_por_ciclo,produz_fmt,desbloqueio_s,desbloqueio_fmt,delta_desde_anterior_s,delta_fmt,aceleracao_s'
    );
    game.gens.forEach((gen, i) => {
      const perCycle = gen.amount.mul(prodPerCycleOf(i));
      const prev = i === 0 ? 0 : game.gens[i - 1].unlockedAt;
      const prevPrev = i <= 1 ? 0 : game.gens[i - 2].unlockedAt;
      const delta =
        gen.unlockedAt !== undefined && prev !== undefined
          ? gen.unlockedAt - prev
          : undefined;
      const prevDelta =
        prev !== undefined && prevPrev !== undefined ? prev - prevPrev : undefined;
      const accel =
        delta !== undefined && prevDelta !== undefined
          ? delta - prevDelta
          : undefined;

      lines.push(
        [
          i + 1,
          gen.bought,
          gen.amount.toString(),
          fmt(gen.amount),
          cycleSecondsOf(i),
          perCycle.toString(),
          fmt(perCycle),
          gen.unlockedAt !== undefined ? gen.unlockedAt.toFixed(1) : '',
          gen.unlockedAt !== undefined ? fmtTime(gen.unlockedAt) : '',
          delta !== undefined ? delta.toFixed(1) : '',
          delta !== undefined ? fmtTime(delta) : '',
          accel !== undefined ? accel.toFixed(1) : '',
        ].join(',')
      );
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciclos-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tela de escolha de modo (aparece com save resetado, antes de iniciar)
  if (!game.started) {
    return (
      <div className={styles.modeScreen}>
        <div className={styles.modeCard}>
          <h2 className={styles.modeTitle}>{t('mode.title')}</h2>
          <div className={styles.modeOptions}>
            <button
              className={`${styles.modeBtn} ${!isAuto ? styles.modeActive : ''}`}
              onClick={() => setGame((g) => ({ ...g, mode: 'manual' }))}
            >
              {t('mode.manual')}
            </button>
            <button
              className={`${styles.modeBtn} ${isAuto ? styles.modeActive : ''}`}
              onClick={() => setGame((g) => ({ ...g, mode: 'auto' }))}
            >
              {t('mode.auto')}
            </button>
          </div>
          <p className={styles.modeHint}>
            {isAuto ? t('mode.hintAuto') : t('mode.hintManual')}
          </p>
          <button
            className="btn-primary"
            onClick={() =>
              setGame((g) => ({ ...g, started: true, startedAt: Date.now(), steps: 0 }))
            }
          >
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
            {game.startedAt !== undefined
              ? new Date(game.startedAt).toLocaleString(getDateLocale(), {
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
          <span className={styles.timeValue}>{fmt(game.totalProduced)}</span>
          <span className={styles.timeLabel}>{t('common.produced')}</span>
        </div>
        <button className={styles.exportBtn} onClick={exportCsv}>
          {t('common.exportCsv')}
        </button>
        <button
          className={`${styles.exportBtn} ${isAuto ? styles.toggleOn : ''}`}
          onClick={() =>
            setGame((g) => ({ ...g, mode: g.mode === 'auto' ? 'manual' : 'auto' }))
          }
        >
          {t('gen.autoToggle', { state: isAuto ? 'on' : 'off' })}
        </button>
      </div>

      <div className={styles.baseBlock}>
        <span className={styles.baseLabel}>{t('gen.baseNumber')}</span>
        <span className={styles.baseValue}>{fmt(game.base)}</span>
        <span className={styles.baseRate}>
          +{fmtRate(game.gens[0].amount.mul(AVG_RATE))} / s
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
          {game.gens.map((gen, i) => {
            if (i < virtual.first || i > virtual.last) {
              return (
                <div
                  key={i}
                  className={styles.row}
                  style={{ height: virtual.rowHeight }}
                  aria-hidden="true"
                />
              );
            }

            const cost = costOf(i, gen.bought);
            const target = i === 0 ? 'base' : `${i}`;

            if (gen.bought === 0) {
              const progress = Math.min(game.base.div(cost).toNumber(), 1);
              return (
                <button
                  key={i}
                  className={`btn-primary ${styles.progressBtn} ${styles.unlockBtn}`}
                  disabled={isAuto || progress < 1}
                  onClick={() => buy(i)}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${progress * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className={styles.progressLabel}>{fmt(cost)}</span>
                </button>
              );
            }

            // Tempo restante do ciclo atual (contagem viva, extrapolada por frame)
            const remaining = Math.max(
              cycleSecondsOf(i) - (gen.cycleStep * SIM_STEP_S + partial),
              0
            );

            return (
              <div
                key={i}
                className={`${styles.row} ${cyc.rowWide}`}
                ref={virtual.measureRef}
              >
                <span className={styles.genName}>{i + 1}</span>

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
                  disabled={isAuto || game.base.lt(cost)}
                  onClick={() => buy(i)}
                >
                  {fmt(cost)}
                </button>

                {/* Barra do ciclo: canaleta em baixo relevo + preenchimento
                    em alto relevo (mesma linguagem do slider da Config).
                    Ocultável na Config — a coluna de tempo já mostra o ciclo. */}
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
