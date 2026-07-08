import { useEffect, useReducer, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { useVirtualRows } from '../../hooks/useVirtualRows';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import styles from './Generators.module.css';

interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (em segundos) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
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

interface GenSave {
  base: string;
  totalProduced?: string;
  gens: { amount: string; bought: number; unlockedAt?: number }[];
  uptime: number;
  mode?: Mode;
  started?: boolean;
  startedAt?: number;
  steps?: number;
  /** Date.now() do momento do save (informativo/migração de saves antigos). */
  savedAt?: number;
}

const START_BASE = new Decimal(1);

/** Cada unidade de um gerador produz 0.1 do nível anterior por segundo. */
const PROD_PER_UNIT = new Decimal(0.1);

const newGen = (): Gen => ({ amount: new Decimal(0), bought: 0 });

function loadGame(saveKey: string): Game {
  const s = loadSave<GenSave>(saveKey);
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
  // Migração de saves de antes do timestep fixo: aproxima a âncora e os passos
  // já executados pelo que dá pra inferir (um Zerar dá partida limpa).
  const startedAt =
    s.startedAt ?? (started ? Date.now() - s.uptime * 1000 : undefined);
  const steps =
    s.steps ??
    (started && startedAt !== undefined && s.savedAt !== undefined
      ? Math.floor((s.savedAt - startedAt) / (SIM_STEP_S * 1000))
      : Math.floor(s.uptime / SIM_STEP_S));

  return {
    base: new Decimal(s.base),
    // Saves antigos não registravam: usa o saldo atual como piso.
    totalProduced: new Decimal(s.totalProduced ?? s.base),
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
    })),
    mode: s.mode ?? 'manual',
    started,
    startedAt,
    steps,
    uptime: s.uptime,
  };
  // O tempo fechado/oculto é recuperado pelo próprio loop: o alvo de passos
  // vem do relógio de parede, então o jogo corre atrás sozinho ao carregar.
}

/** Agressividade da curva de custos: cada tier custa 10^(2c) a mais que o
    degrau anterior, fazendo o intervalo entre desbloqueios crescer ~2-3% por
    gerador (dobra a cada ~30). Tunado via scripts/simulate-balance.mjs. */
const COST_CURVE = 0.004;

/** Custo do gerador N (índice i): 10^(i + c·i²), dobrando a cada compra.
    O termo quadrático faz cada desbloqueio demorar mais que o anterior.
    O round() corrige o erro de ponto flutuante do pow do break_eternity
    (2^3 sai como 7.999...), já que custos são sempre inteiros. */
function costOf(i: number, bought: number): Decimal {
  return Decimal.pow(10, i + COST_CURVE * i * i)
    .mul(Decimal.pow(2, bought))
    .round();
}

/** Timestep FIXO da simulação. O jogo avança sempre em passos de exatamente
    0.25s, ancorados no startedAt — o estado é função pura do nº de passos,
    então duas máquinas com o mesmo save executam a mesma sequência de contas
    e ficam idênticas, não importa se a aba ficou aberta, oculta ou fechada.
    (Passo variável causava drift: o erro de integração do crescimento composto
    depende do tamanho do passo e compõe ao longo das horas.) */
const SIM_STEP_S = 0.25;
/** Produção por unidade em um passo (0.1/s × 0.25s). */
const PROD_PER_STEP = PROD_PER_UNIT.mul(SIM_STEP_S);
/** Teto de passos executados por frame durante o catch-up, pra não travar a
    UI ao reabrir (2h fechada ≈ 29k passos → alcança em ~15 frames). */
const MAX_STEPS_PER_FRAME = 2_000;

/** Executa nSteps passos fixos de simulação. Função pura e determinística. */
function advance(g: Game, nSteps: number): Game {
  const gens = g.gens.map((x) => ({ ...x }));
  let base = g.base;
  let totalProduced = g.totalProduced;
  let uptime = g.uptime;

  for (let s = 0; s < nSteps; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    // Cada unidade do gerador N produz 0.1 do gerador N-1 por segundo.
    for (let i = gens.length - 1; i >= 1; i--) {
      gens[i - 1].amount = gens[i - 1].amount.add(gens[i].amount.mul(PROD_PER_STEP));
    }
    const income = gens[0].amount.mul(PROD_PER_STEP);
    base = base.add(income);
    totalProduced = totalProduced.add(income);

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

export default function Generators() {
  const { t } = useI18n();
  // Amarra a instância ao slot ativo do momento da montagem
  const [saveKey] = useState(() => saveKeyFor('geradores'));
  const [game, setGame] = useState<Game>(() => loadGame(saveKey));
  // Re-render a cada frame para a extrapolação visual (a simulação em si só
  // avança nos passos fixos — isto é pura cosmética de display).
  const [, bumpFrame] = useReducer((x: number) => x + 1, 0);
  const listRef = useRef<HTMLDivElement>(null);

  // Animação de scroll própria: o smooth nativo congela o alvo na chamada e o
  // Chrome/macOS encerra a animação quando o layout muda no meio (nossa lista
  // re-renderiza todo frame). Aqui o alvo é recalculado a cada frame, então a
  // rolagem sempre aterrissa no fim/começo reais, em qualquer navegador.
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

  // Um gerador novo apareceu → rola a lista até o fim de verdade, incluindo o
  // card bloqueado do próximo (o alvo vivo acompanha o layout assentando).
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
        })),
        uptime: g.uptime,
        mode: g.mode,
        started: g.started,
        startedAt: g.startedAt,
        steps: g.steps,
        savedAt: Date.now(),
      } satisfies GenSave);
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

    // O relógio de parede dita quantos passos fixos já deveriam ter sido
    // executados desde o startedAt; o frame só corre atrás da diferença.
    // Estado = f(nº de passos) → determinístico entre máquinas e sessões.
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
      // Primeira compra do último gerador desbloqueia o próximo.
      if (i === g.gens.length - 1) gens.push(newGen());

      return { ...g, base: g.base.sub(cost), gens };
    });
  };

  const isAuto = game.mode === 'auto';

  // ===== Extrapolação visual entre passos fixos =====
  // Fração de segundo desde o último passo executado; os valores exibidos
  // avançam suavemente com ela, sem tocar no estado determinístico.
  const partial =
    game.started && game.startedAt !== undefined
      ? Math.min(
          Math.max((Date.now() - game.startedAt) / 1000 - game.steps * SIM_STEP_S, 0),
          SIM_STEP_S
        )
      : 0;

  /** Quantidade exibida do gerador i: real + o que o gerador i+1 produziu
      desde o último passo. */
  const dispAmount = (i: number): Decimal => {
    const gen = game.gens[i];
    const feeder = game.gens[i + 1];
    if (!feeder || partial === 0) return gen.amount;
    return gen.amount.add(feeder.amount.mul(PROD_PER_UNIT).mul(partial));
  };

  const partialIncome =
    partial === 0
      ? new Decimal(0)
      : game.gens[0].amount.mul(PROD_PER_UNIT).mul(partial);
  const dispBase = game.base.add(partialIncome);
  const dispTotal = game.totalProduced.add(partialIncome);

  const dispUptime = game.uptime + (game.gens[0].bought > 0 ? partial : 0);

  // Cards fora da janela visível viram fantasmas (mesma altura, sem conteúdo)
  const virtual = useVirtualRows(listRef, game.gens.length, 8);

  /** Baixa um .csv com a progressão atual: metadados + uma linha por gerador,
      com valores brutos (análise) e formatados (leitura). */
  const exportCsv = () => {
    const lines: string[] = [];

    lines.push('chave,valor');
    lines.push(
      `inicio_do_save,${game.startedAt !== undefined ? new Date(game.startedAt).toISOString() : ''}`
    );
    lines.push(`tempo_de_jogo_s,${game.uptime.toFixed(1)}`);
    lines.push(`tempo_de_jogo_fmt,${fmtTime(game.uptime)}`);
    lines.push(`modo,${game.mode}`);
    lines.push(`numero_base,${game.base.toString()}`);
    lines.push(`numero_base_fmt,${fmt(game.base)}`);
    lines.push(`total_produzido,${game.totalProduced.toString()}`);
    lines.push(`total_produzido_fmt,${fmt(game.totalProduced)}`);
    lines.push(
      `producao_base_por_s,${game.gens[0].amount.mul(PROD_PER_UNIT).toString()}`
    );
    lines.push('');

    lines.push(
      'gerador,comprados,possui,possui_fmt,produz_por_s,produz_fmt,desbloqueio_s,desbloqueio_fmt,delta_desde_anterior_s,delta_fmt,aceleracao_s'
    );
    game.gens.forEach((gen, i) => {
      const prod = gen.amount.mul(PROD_PER_UNIT);
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
          prod.toString(),
          fmtRate(prod),
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
    a.download = `geradores-${stamp}.csv`;
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
          <span className={styles.timeValue}>{fmt(dispTotal)}</span>
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
        <span className={styles.baseValue}>{fmt(dispBase)}</span>
        <span className={styles.baseRate}>
          +{fmtRate(dispAmount(0).mul(PROD_PER_UNIT))} / s
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

          // Gerador recém-desbloqueado (nunca comprado): só o botão, centralizado,
          // com barra de progresso mostrando o quão perto o jogador está do custo.
          if (gen.bought === 0) {
            const progress = Math.min(dispBase.div(cost).toNumber(), 1);
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

          return (
            <div key={i} className={styles.row} ref={virtual.measureRef}>
              <span className={styles.genName}>{i + 1}</span>

              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('gen.owns')}</span>
                  <span className={styles.statValue}>{fmt(dispAmount(i))}</span>
                </div>

                <div className={styles.stat}>
                  <span className={styles.statLabel}>
                    {t('gen.produces', { target })}
                  </span>
                  <span className={styles.statValue}>
                    +{fmtRate(dispAmount(i).mul(PROD_PER_UNIT))} / s
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
