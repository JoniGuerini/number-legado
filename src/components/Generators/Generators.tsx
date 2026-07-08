import { useEffect, useReducer, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { useVirtualRows } from '../../hooks/useVirtualRows';
import { fmt, fmtCost, fmtRate, fmtTime } from '../../lib/format';
import { useI18n } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import styles from './Generators.module.css';

interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (em segundos) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
  /** Quantidade do tier anterior no momento do desbloqueio (log da Atividade). */
  prevAtUnlock?: Decimal;
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
  gens: {
    amount: string;
    bought: number;
    unlockedAt?: number;
    prevAtUnlock?: string;
  }[];
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
      prevAtUnlock:
        g.prevAtUnlock !== undefined ? new Decimal(g.prevAtUnlock) : undefined,
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

/** Encarecimento por compra: cada unidade comprada custa 10% a mais. */
const COST_GROWTH = 1.1;

/** Custo do gerador N (índice i): expoente triangular i·(i+1)/2 — o salto
    entre geradores cresce a cada degrau (×10, ×100, ×1000…): 1, 10, 1K, 1M,
    10B… +10% a cada compra. */
function costOf(i: number, bought: number): Decimal {
  return Decimal.pow(10, (i * (i + 1)) / 2).mul(
    Decimal.pow(COST_GROWTH, bought)
  );
}

/** Base prevista após t segundos, assumindo nenhuma compra nova. A cascata
    sem compras é um sistema linear nilpotente com solução fechada:
    base(t) = base + Σ_j a_j · (0.1t)^(j+1) / (j+1)!
    (cada termo é a contribuição do gerador j descendo j+1 níveis). */
function baseAt(game: Game, t: number): Decimal {
  const x = new Decimal(t).mul(PROD_PER_UNIT); // 0.1t
  let value = game.base;
  let factor = x; // (0.1t)^(j+1) / (j+1)! — começa em j=0
  for (let j = 0; j < game.gens.length; j++) {
    const amount = game.gens[j].amount;
    if (amount.gt(0)) value = value.add(amount.mul(factor));
    factor = factor.mul(x).div(j + 2);
  }
  return value;
}

/** Horizonte máximo da previsão de desbloqueio (10 anos). */
const MAX_ETA_S = 10 * 365 * 86400;

/** Segundos até a base alcançar o custo, contando toda a aceleração futura
    da cascata (sem compras novas). null = fora do horizonte/sem produção. */
function timeToUnlock(game: Game, cost: Decimal): number | null {
  if (game.base.gte(cost)) return 0;
  if (baseAt(game, MAX_ETA_S).lt(cost)) return null;

  // base(t) é crescente — busca binária até a resolução do timestep
  let lo = 0;
  let hi = MAX_ETA_S;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (baseAt(game, mid).gte(cost)) hi = mid;
    else lo = mid;
  }
  return hi;
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
          if (i > 0) gens[i].prevAtUnlock = gens[i - 1].amount;
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
          prevAtUnlock: x.prevAtUnlock?.toString(),
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
      if (gens[i].bought === 1) {
        gens[i].unlockedAt = g.uptime;
        if (i > 0) gens[i].prevAtUnlock = gens[i - 1].amount;
      }
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

  // ===== Timer de desbloqueio =====
  // Previsão em timestamp absoluto, cacheada por assinatura de compras: a
  // cascata sem compras é determinística, então o timer só conta regressivo —
  // ele muda de valor apenas quando alguma unidade nova é comprada.
  const etaCacheRef = useRef<{
    signature: string;
    etas: Map<number, number | null>;
  }>({ signature: '', etas: new Map() });

  const unlockEtaAt = (i: number, cost: Decimal): number | null => {
    const signature = game.gens.map((g) => g.bought).join(',');
    const cache = etaCacheRef.current;
    if (cache.signature !== signature) {
      cache.signature = signature;
      cache.etas = new Map();
    }
    if (!cache.etas.has(i)) {
      const seconds = timeToUnlock(game, cost);
      cache.etas.set(i, seconds === null ? null : Date.now() + seconds * 1000);
    }
    return cache.etas.get(i) ?? null;
  };

  // Cards fora da janela visível viram fantasmas (mesma altura, sem conteúdo)
  const virtual = useVirtualRows(listRef, game.gens.length, 8);

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

          // Gerador recém-desbloqueado (nunca comprado): só o botão, com barra
          // de progresso, % à esquerda, custo no centro e timer à direita.
          if (gen.bought === 0) {
            const progress = Math.min(dispBase.div(cost).toNumber(), 1);
            const etaAt = progress >= 1 ? null : unlockEtaAt(i, cost);
            const etaText =
              progress >= 1
                ? fmtTime(0)
                : etaAt === null
                  ? '—'
                  : fmtTime(Math.max((etaAt - Date.now()) / 1000, 0));
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
                <span className={`${styles.progressMeta} ${styles.progressPct}`}>
                  {(Math.floor(progress * 10000) / 100).toFixed(2)}%
                </span>
                <span className={styles.progressLabel}>{fmtCost(cost)}</span>
                <span className={`${styles.progressMeta} ${styles.progressEta}`}>
                  {etaText}
                </span>
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
                {fmtCost(cost)}
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
