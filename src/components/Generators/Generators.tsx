import { useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Marcos de posse (10, 100, 1000…) já resgatados em fragmentos. */
  claimed: number;
  /** Níveis de investimento em fragmentos — cada um dobra a produção. */
  boost: number;
}

type Mode = 'manual' | 'auto';

interface Game {
  base: Decimal;
  /** Total de base já produzido na vida do save (compras não descontam). */
  totalProduced: Decimal;
  /** Recurso paralelo: 1 por marco de posse resgatado nos geradores. */
  fragments: number;
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
  /** Níveis permanentes de prestígio — cada um dobra a produção global. */
  prestigeLevels: number;
  /** Quantas vezes o jogador já prestigou — sobe o gerador mínimo da próxima. */
  prestigeCount: number;
}

interface GenSave {
  base: string;
  totalProduced?: string;
  fragments?: number;
  gens: {
    amount: string;
    bought: number;
    unlockedAt?: number;
    prevAtUnlock?: string;
    claimed?: number;
    boost?: number;
  }[];
  uptime: number;
  mode?: Mode;
  started?: boolean;
  startedAt?: number;
  steps?: number;
  prestigeLevels?: number;
  prestigeCount?: number;
  /** Date.now() do momento do save (informativo/migração de saves antigos). */
  savedAt?: number;
}

const START_BASE = new Decimal(1);

/** Cada unidade de um gerador produz 0.1 do nível anterior por segundo. */
const PROD_PER_UNIT = new Decimal(0.1);

const newGen = (): Gen => ({
  amount: new Decimal(0),
  bought: 0,
  claimed: 0,
  boost: 0,
});

function loadGame(saveKey: string): Game {
  const s = loadSave<GenSave>(saveKey);
  if (!s || s.gens.length === 0) {
    return {
      base: START_BASE,
      totalProduced: new Decimal(0),
      fragments: 0,
      gens: [newGen()],
      mode: 'manual',
      started: false,
      steps: 0,
      uptime: 0,
      prestigeLevels: 0,
      prestigeCount: 0,
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
    fragments: s.fragments ?? 0,
    // claimed default 0: marcos antigos ficam pendentes (recompensa retroativa)
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
      prevAtUnlock:
        g.prevAtUnlock !== undefined ? new Decimal(g.prevAtUnlock) : undefined,
      claimed: g.claimed ?? 0,
      boost: g.boost ?? 0,
    })),
    mode: s.mode ?? 'manual',
    started,
    startedAt,
    steps,
    uptime: s.uptime,
    prestigeLevels: s.prestigeLevels ?? 0,
    // Saves that prestiged before prestigeCount existed: assume at least 1
    // so they cannot re-prestige at the old G3 gate.
    prestigeCount: s.prestigeCount ?? ((s.prestigeLevels ?? 0) > 0 ? 1 : 0),
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

/** Marcos de posse alcançados por um gerador: 1 ao possuir 10, 2 aos 100,
    3 aos 1.000… (floor do log10; o epsilon segura resíduo de ponto flutuante
    quando a quantidade encosta na potência exata). */
function milestonesOf(amount: Decimal): number {
  if (amount.lt(10)) return 0;
  return amount.mul(1 + 1e-9).log10().floor().toNumber();
}

/** Fragmentos acumulados pelos n primeiros marcos de um gerador. Cada marco
    concede o dobro do anterior (1, 2, 4, 8…), então a soma fecha em 2^n − 1. */
function fragmentsForMilestones(n: number): number {
  return 2 ** n - 1;
}

/** Fragmentos pendentes de resgate: o que os marcos alcançados renderam
    menos o que os marcos já resgatados renderam. */
function pendingFragmentsOf(gen: Gen): number {
  return (
    fragmentsForMilestones(milestonesOf(gen.amount)) -
    fragmentsForMilestones(gen.claimed)
  );
}

/** Custo (em fragmentos) do próximo nível de investimento. Cada gerador tem
    a sua base — o gerador i começa custando o dobro do anterior (1, 2, 4…) —
    e cada nível comprado dobra o próximo: 2^(i + nível). */
function boostCostOf(i: number, boost: number): number {
  return 2 ** (i + boost);
}

/** Multiplicador de produção do gerador: ×2 por nível investido. */
function boostMultOf(boost: number): Decimal {
  return Decimal.pow(2, boost);
}

/** Multiplicador global permanente: ×2 por nível de prestígio. */
function prestigeMultOf(levels: number): Decimal {
  return Decimal.pow(2, levels);
}

/** Maior gerador com pelo menos 1 unidade comprada (1-based); 0 se nenhum. */
function highestUnlocked(gens: Gen[]): number {
  let max = 0;
  for (let i = 0; i < gens.length; i++) {
    if (gens[i].bought > 0) max = i + 1;
  }
  return max;
}

/** Faixa de 5 geradores: 1º prestígio no G5, 2º no G10, 3º no G15… */
const PRESTIGE_GEN_STEP = 5;

/** Gerador mínimo (1-based) pra prestigiar de novo, dado quantas vezes já prestigou. */
function prestigeGateOf(prestigeCount: number): number {
  return PRESTIGE_GEN_STEP * (prestigeCount + 1);
}

/** Níveis ganhos ao prestigiar: floor(maiorGerador / 5) — G5–G9 → +1, G10–G14 → +2… */
function prestigeGainOf(gens: Gen[]): number {
  return Math.floor(highestUnlocked(gens) / PRESTIGE_GEN_STEP);
}

/** Base prevista após t segundos, assumindo nenhuma compra nova. A cascata
    sem compras é um sistema linear nilpotente com solução fechada:
    base(t) = base + Σ_j a_j · Π_{k≤j} m_k · (0.1t)^(j+1) / (j+1)!
    (cada termo é a contribuição do gerador j descendo j+1 níveis; m_k é o
    multiplicador de investimento de cada nível atravessado no caminho).
    O prestígio multiplica a produção de cada elo da cascata. */
function baseAt(game: Game, t: number): Decimal {
  const prestige = prestigeMultOf(game.prestigeLevels);
  const x = new Decimal(t).mul(PROD_PER_UNIT).mul(prestige); // 0.1t × prestígio
  let value = game.base;
  let factor = x; // (0.1t·P)^(j+1) / (j+1)! — começa em j=0
  let mults = new Decimal(1); // Π m_k dos níveis j, j-1… 0
  for (let j = 0; j < game.gens.length; j++) {
    mults = mults.mul(boostMultOf(game.gens[j].boost));
    const amount = game.gens[j].amount;
    if (amount.gt(0)) value = value.add(amount.mul(mults).mul(factor));
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

  // Produção por passo de cada gerador (0.1×0.25s × 2^boost × 2^prestígio) —
  // níveis de investimento e prestígio não mudam durante o advance.
  const prestige = prestigeMultOf(g.prestigeLevels);
  const prodStep = gens.map((x) =>
    PROD_PER_STEP.mul(boostMultOf(x.boost)).mul(prestige)
  );

  for (let s = 0; s < nSteps; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    // Cada unidade do gerador N produz 0.1 (×2 por investimento × prestígio)
    // do N-1 por s.
    for (let i = gens.length - 1; i >= 1; i--) {
      gens[i - 1].amount = gens[i - 1].amount.add(gens[i].amount.mul(prodStep[i]));
    }
    const income = gens[0].amount.mul(prodStep[0]);
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
          if (i === last) {
            gens.push(newGen());
            // boost 0 no gerador recém-criado; prestígio já entra no passo
            prodStep.push(PROD_PER_STEP.mul(prestige));
          }
        }
        break;
      }
    }
  }

  return { ...g, base, totalProduced, gens, uptime, steps: g.steps + nSteps };
}

export default function Generators({
  cornerHost,
}: {
  /** Fileira do topo-esquerdo do App onde o toggle de Automático é portalado
      (ao lado do card de versão, que empurra em vez de sobrepor). */
  cornerHost?: HTMLElement | null;
}) {
  const { t } = useI18n();
  // Amarra a instância ao slot ativo do momento da montagem
  const [saveKey] = useState(() => saveKeyFor('geradores'));
  const [game, setGame] = useState<Game>(() => loadGame(saveKey));
  // Confirmação em duas etapas do botão de prestígio
  const [confirmPrestige, setConfirmPrestige] = useState(false);
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
        fragments: g.fragments,
        gens: g.gens.map((x) => ({
          amount: x.amount.toString(),
          bought: x.bought,
          unlockedAt: x.unlockedAt,
          prevAtUnlock: x.prevAtUnlock?.toString(),
          claimed: x.claimed,
          boost: x.boost,
        })),
        uptime: g.uptime,
        mode: g.mode,
        started: g.started,
        startedAt: g.startedAt,
        steps: g.steps,
        prestigeLevels: g.prestigeLevels,
        prestigeCount: g.prestigeCount,
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

  // Resgata de uma vez todos os fragmentos pendentes do gerador i
  // (o rendimento dos marcos alcançados menos o dos já resgatados).
  const claim = (i: number) => {
    setGame((g) => {
      const pending = pendingFragmentsOf(g.gens[i]);
      if (pending <= 0) return g;

      const gens = g.gens.map((x) => ({ ...x }));
      gens[i].claimed = milestonesOf(gens[i].amount);
      return { ...g, fragments: g.fragments + pending, gens };
    });
  };

  // Resgata os pendentes de todos os geradores num clique só
  const claimAll = () => {
    setGame((g) => {
      let total = 0;
      const gens = g.gens.map((x) => {
        const pending = pendingFragmentsOf(x);
        if (pending <= 0) return x;
        total += pending;
        return { ...x, claimed: milestonesOf(x.amount) };
      });
      if (total <= 0) return g;
      return { ...g, fragments: g.fragments + total, gens };
    });
  };

  // Investe fragmentos no gerador i: um nível dobra a produção dele e o
  // próximo nível passa a custar o dobro.
  const buyBoost = (i: number) => {
    setGame((g) => {
      const cost = boostCostOf(i, g.gens[i].boost);
      if (g.fragments < cost) return g;

      const gens = g.gens.map((x) => ({ ...x }));
      gens[i].boost += 1;
      return { ...g, fragments: g.fragments - cost, gens };
    });
  };

  // Prestígio: sacrifica a run e ganha níveis permanentes (produção ×2 cada).
  // Volta à tela de modo com o multiplicador já ativo. O próximo gate sobe
  // (G3 → G6 → G9…) pra não prestigiar de novo no mínimo da run anterior.
  const doPrestige = () => {
    setGame((g) => {
      const gate = prestigeGateOf(g.prestigeCount);
      const highest = highestUnlocked(g.gens);
      const gain = prestigeGainOf(g.gens);
      if (highest < gate || gain <= 0) return g;
      return {
        base: START_BASE,
        totalProduced: new Decimal(0),
        fragments: 0,
        gens: [newGen()],
        mode: g.mode,
        started: false,
        steps: 0,
        uptime: 0,
        prestigeLevels: g.prestigeLevels + gain,
        prestigeCount: g.prestigeCount + 1,
      };
    });
    setConfirmPrestige(false);
  };

  // ===== Compra contínua (segurar o botão) =====
  // Pointer down executa a 1ª compra na hora; segurando, após uma pausa
  // curta a ação repete até soltar (as ações já no-op sem saldo).
  const holdRef = useRef<{ timeout: number; interval: number | null } | null>(
    null
  );

  const stopHold = () => {
    if (!holdRef.current) return;
    clearTimeout(holdRef.current.timeout);
    if (holdRef.current.interval !== null) clearInterval(holdRef.current.interval);
    holdRef.current = null;
  };

  const startHold = (action: () => void) => {
    stopHold();
    action();
    const timeout = window.setTimeout(() => {
      if (holdRef.current) holdRef.current.interval = window.setInterval(action, 80);
    }, 400);
    holdRef.current = { timeout, interval: null };
  };

  useEffect(() => stopHold, []);

  /** Props de segurar-pra-repetir; o clique de mouse é ignorado (a compra já
      aconteceu no pointer down) mas Enter/Espaço seguem funcionando. */
  const holdProps = (action: () => void) => ({
    onPointerDown: () => startHold(action),
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) action(); // e.detail 0 = clique via teclado
    },
  });

  const isAuto = game.mode === 'auto';
  const prestigeGate = prestigeGateOf(game.prestigeCount);
  const prestigeGain = prestigeGainOf(game.gens);
  const canPrestige =
    highestUnlocked(game.gens) >= prestigeGate && prestigeGain > 0;
  const nextPrestigeMult = prestigeMultOf(
    game.prestigeLevels + (canPrestige ? prestigeGain : 0)
  );

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

  /** Taxa de produção por unidade do gerador i
      (0.1/s × 2^investimentos × 2^prestígio). */
  const unitRate = (i: number): Decimal =>
    PROD_PER_UNIT.mul(boostMultOf(game.gens[i].boost)).mul(
      prestigeMultOf(game.prestigeLevels)
    );

  /** Quantidade exibida do gerador i: real + o que o gerador i+1 produziu
      desde o último passo. */
  const dispAmount = (i: number): Decimal => {
    const gen = game.gens[i];
    const feeder = game.gens[i + 1];
    if (!feeder || partial === 0) return gen.amount;
    return gen.amount.add(feeder.amount.mul(unitRate(i + 1)).mul(partial));
  };

  const partialIncome =
    partial === 0
      ? new Decimal(0)
      : game.gens[0].amount.mul(unitRate(0)).mul(partial);
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
    // Compras, investimentos e prestígio mudam a curva → invalidam o cache
    const signature =
      `${game.prestigeLevels}|` +
      game.gens.map((g) => `${g.bought}:${g.boost}`).join(',');
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

  // Índice do próximo gerador ainda bloqueado (alvo do timer de desbloqueio).
  const nextLockedIdx = game.gens.findIndex((g) => g.bought === 0);
  const nextUnlockCost =
    nextLockedIdx >= 0 ? costOf(nextLockedIdx, 0) : null;

  // Cache do ETA "se eu investir +1 neste gerador" — mesma assinatura do ETA
  // atual, chaveado pelo índice do boost. Só recalcula no hover implícito
  // (render dos cards visíveis) quando compras/boosts mudam.
  const boostEtaCacheRef = useRef<{
    signature: string;
    nowS: number | null;
    after: Map<number, number | null>;
  }>({ signature: '', nowS: null, after: new Map() });

  /** Texto do tooltip do botão investir: quanto o próximo desbloqueio
      encolhe se este gerador ganhar +1 nível agora. */
  const investTooltip = (i: number): string => {
    if (nextLockedIdx < 0 || nextUnlockCost === null) {
      return t('frag.investTipReady');
    }
    const signature =
      `${game.prestigeLevels}|` +
      game.gens.map((g) => `${g.bought}:${g.boost}`).join(',');
    const cache = boostEtaCacheRef.current;
    if (cache.signature !== signature) {
      cache.signature = signature;
      cache.nowS = timeToUnlock(game, nextUnlockCost);
      cache.after = new Map();
    }
    if (!cache.after.has(i)) {
      const boosted: Game = {
        ...game,
        gens: game.gens.map((g, j) =>
          j === i ? { ...g, boost: g.boost + 1 } : g
        ),
      };
      cache.after.set(i, timeToUnlock(boosted, nextUnlockCost));
    }
    const nowS = cache.nowS;
    const afterS = cache.after.get(i) ?? null;

    if (nowS === 0) return t('frag.investTipReady');
    if (nowS === null && afterS === null) return t('frag.investTipUnknown');
    if (nowS === null && afterS !== null) {
      return t('frag.investTipUnlocks', { after: fmtTime(afterS) });
    }
    if (nowS !== null && afterS === null) return t('frag.investTipUnknown');

    const saved = Math.max((nowS as number) - (afterS as number), 0);
    if (saved < 0.5) return t('frag.investTipNoChange', { now: fmtTime(nowS!) });
    return t('frag.investTipSave', {
      now: fmtTime(nowS!),
      after: fmtTime(afterS!),
      saved: fmtTime(saved),
    });
  };

  // Cards fora da janela visível viram fantasmas (mesma altura, sem conteúdo)
  const virtual = useVirtualRows(listRef, game.gens.length, 8);

  // Tela de escolha de modo (aparece com save resetado / pós-prestígio)
  if (!game.started) {
    return (
      <div className={styles.modeScreen}>
        <div className={styles.modeCard}>
          {game.prestigeLevels > 0 && (
            <span className={styles.prestigeBadge}>
              {t('prestige.mult', {
                mult: fmt(prestigeMultOf(game.prestigeLevels)),
              })}
            </span>
          )}
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
      {/* Auto + prestígio: portalados pra fileira do topo-esquerdo do App */}
      {cornerHost &&
        createPortal(
          <>
            <button
              className={`${styles.exportBtn} ${isAuto ? styles.toggleOn : ''}`}
              onClick={() =>
                setGame((g) => ({
                  ...g,
                  mode: g.mode === 'auto' ? 'manual' : 'auto',
                }))
              }
            >
              {t('gen.autoToggle', { state: isAuto ? 'on' : 'off' })}
            </button>
            {game.prestigeLevels > 0 && !canPrestige && (
              <span className={`${styles.exportBtn} ${styles.prestigePill}`}>
                {t('prestige.mult', {
                  mult: fmt(prestigeMultOf(game.prestigeLevels)),
                })}
              </span>
            )}
            {canPrestige &&
              (confirmPrestige ? (
                <>
                  <button
                    className={`${styles.exportBtn} ${styles.prestigeConfirm}`}
                    onClick={doPrestige}
                  >
                    {t('prestige.confirm', {
                      gain: prestigeGain,
                      mult: fmt(nextPrestigeMult),
                    })}
                  </button>
                  <button
                    className={styles.exportBtn}
                    onClick={() => setConfirmPrestige(false)}
                  >
                    {t('prestige.cancel')}
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.exportBtn} ${styles.prestigeBtn}`}
                  onClick={() => setConfirmPrestige(true)}
                >
                  {t('prestige.preview', {
                    gain: prestigeGain,
                    mult: fmt(nextPrestigeMult),
                  })}
                </button>
              ))}
          </>,
          cornerHost
        )}

      <div className={styles.resources}>
        <div className={styles.resourceCard}>
          <span className={styles.resourceLabel}>{t('gen.baseNumber')}</span>
          <div className={styles.resourceRow}>
            <span className={styles.resourceValue}>{fmt(dispBase)}</span>
            <span className={styles.resourceRate}>
              +{fmtRate(dispAmount(0).mul(unitRate(0)))} / s
            </span>
          </div>
        </div>
        <div className={styles.resourceCard}>
          <span className={styles.resourceLabel}>{t('frag.label')}</span>
          <div className={styles.resourceRow}>
            <span className={styles.resourceValue}>{fmt(game.fragments)}</span>
          </div>
        </div>
      </div>

      {/* Header + lista num bloco só, com o mesmo gap de 8px dos cards */}
      <div className={styles.tableArea}>
        {/* Card-header fixo acima da lista: títulos de todas as colunas (os
            cards mostram só valores; no mobile os cards viram pilha vertical,
            o header some e os rótulos voltam pra dentro de cada card).
            Antes da primeira compra só existe o botão de desbloqueio na
            lista — sem cards de stats, o header não tem o que titular. */}
        {game.gens[0].bought > 0 && (
        <div className={`${styles.row} ${styles.headerRow}`}>
          <span className={styles.headerCell}>{t('gen.colGen')}</span>
          <span className={styles.headerCell}>{t('gen.owns')}</span>
          <span className={styles.headerCell}>{t('gen.colProduces')}</span>
          <span className={styles.headerCell}>{t('gen.colLevel')}</span>
          <span className={styles.headerCell}>
            {t('frag.next')}
            {/* Com 2+ geradores com pendência, atalho pra resgatar tudo */}
            {game.gens.filter((x) => pendingFragmentsOf(x) > 0).length >= 2 && (
              <button
                className={styles.claimAll}
                onClick={claimAll}
                aria-label={t('frag.claimAllAria')}
              >
                {t('frag.claimAll')}
              </button>
            )}
          </span>
          <div className={styles.actions}>
            <span className={`${styles.headerCell} ${styles.headerBoost}`}>
              {t('gen.colInvest')}
            </span>
            <span className={`${styles.headerCell} ${styles.headerBuy}`}>
              {t('gen.colBuy')}
            </span>
          </div>
        </div>
        )}

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
                ? t('gen.unlockReady')
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

          // Fragmentos pendentes: rendimento dos marcos alcançados menos o dos
          // já resgatados (cada marco vale o dobro do anterior: 1, 2, 4, 8…).
          // Sem pendência, o chip vira medidor de progresso até o próximo marco
          // (próxima potência de 10 de posse) — mesmo tamanho, altura uniforme.
          const pending = pendingFragmentsOf(gen);
          const nextMilestone = Decimal.pow(10, milestonesOf(gen.amount) + 1);
          const fragPct = Math.min(
            dispAmount(i).div(nextMilestone).toNumber() * 100,
            100
          );

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
                    +{fmtRate(dispAmount(i).mul(unitRate(i)))} / s
                  </span>
                </div>

                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('gen.colLevel')}</span>
                  <span className={styles.statValue}>{fmt(gen.boost)}</span>
                </div>

                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('frag.next')}</span>
                  <span className={styles.statValue}>
                    {fragPct.toFixed(2)}%
                    {/* Pendentes: só o número, clicável, resgata tudo */}
                    {pending > 0 && (
                      <button
                        className={styles.fragClaim}
                        onClick={() => claim(i)}
                        aria-label={t('frag.claimAria', { n: fmt(pending) })}
                      >
                        +{fmt(pending)}
                      </button>
                    )}
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                <div className={styles.actionsTray}>
                  <button
                    className={`btn-secondary ${styles.boostBtn}`}
                    disabled={game.fragments < boostCostOf(i, gen.boost)}
                    {...holdProps(() => buyBoost(i))}
                    aria-label={t('frag.investAria', {
                      n: i + 1,
                      cost: boostCostOf(i, gen.boost),
                    })}
                    data-tip={investTooltip(i)}
                  >
                    {t('frag.investBtn', { cost: fmt(boostCostOf(i, gen.boost)) })}
                  </button>
                </div>

                <div className={styles.actionsTray}>
                  <button
                    className="btn-primary"
                    disabled={isAuto || game.base.lt(cost)}
                    {...holdProps(() => buy(i))}
                  >
                    {fmtCost(cost)}
                  </button>
                </div>
              </div>
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
    </div>
  );
}
