/** Motor determinístico de uma linha de produção do Reino.

    É uma cópia do motor cíclico de Ciclos (batelada por ciclo), com um TETO
    finito de geradores. Cada linha é uma cadeia independente: estado = função
    pura do nº de passos fixos, ancorado no próprio startedAt da linha, então
    duas máquinas com o mesmo save produzem a MESMA sequência de contas —
    requisito para ranking justo bit a bit. */

import Decimal from 'break_eternity.js';

/** Timestep fixo (mesma arquitetura determinística dos outros modos). */
export const SIM_STEP_S = 0.25;
/** Ciclo do Gerador 1, em segundos. O Reino tem uma economia propositalmente
    mais lenta que Ciclos: começa em 2s e triplica a cada nível. */
export const CYCLE_BASE_S = 2;
/** Fator de crescimento do ciclo entre um gerador e o seguinte (geométrico):
    ciclo do gerador N = 2s × 3^(N-1) → 2s, 6s, 18s, 54s… */
export const CYCLE_GROWTH = 3;
/** Entrega por ciclo do Gerador 1, por unidade. A produção é DESACOPLADA do
    tempo e cresce de forma ARITMÉTICA (+0.1 por nível): 0.3, 0.4, 0.5, 0.6…
    Como o ciclo triplica e a entrega só soma 0.1, a taxa por segundo despenca
    nos geradores mais fundos (ciclos longos, entrega modesta). */
export const PROD_BASE = 0.3;
export const PROD_STEP = 0.1;
/** Teto de passos por frame no catch-up. */
export const MAX_STEPS_PER_FRAME = 2_000;
/** Curva de custos do Reino. O expoente é `SLOPE·i + CURVE·i²`: em i=0 dá
    10^0 = 1 (o 1º gerador é sempre comprável e o jogo arranca). Calibrada para
    o 2º gerador (Camponês) custar ~25 e escalar dali (Lavrador ~759, etc.). */
const COST_SLOPE = 1.36;
const COST_CURVE = 0.04;
/** Encarecimento por unidade repetida do MESMO gerador, em porcentagem (não
    dobra): o gerador i sobe (10 + 2·i)% a cada compra — g1 +10%, g2 +12%,
    g3 +14%… Assim compensa empilhar dezenas/centenas do mesmo gerador. */
const BUY_GROWTH_BASE = 0.1;
const BUY_GROWTH_STEP = 0.02;
const START_BASE = new Decimal(1);

export type Mode = 'manual' | 'auto';

export interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (s) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
  /** Passos já cumpridos do ciclo atual. */
  cycleStep: number;
}

export interface Line {
  base: Decimal;
  /** Total de base já produzido na vida da linha (compras não descontam). */
  totalProduced: Decimal;
  gens: Gen[];
  mode: Mode;
  /** false = ainda na tela de escolha de modo. */
  started: boolean;
  /** Date.now() do clique em Iniciar — âncora da simulação da linha. */
  startedAt?: number;
  /** Passos fixos executados desde o início. */
  steps: number;
  /** Tempo de jogo (s), conta a partir da 1ª compra do Gerador 1. */
  uptime: number;
}

/** Forma serializada (Decimals viram string; nada de float não-determinístico). */
export interface LineSave {
  base: string;
  totalProduced: string;
  gens: { amount: string; bought: number; unlockedAt?: number; cycleStep: number }[];
  mode: Mode;
  started: boolean;
  startedAt?: number;
  steps: number;
  uptime: number;
}

/** Duração do ciclo do gerador de índice i, em segundos (crescimento geométrico). */
export const cycleSecondsOf = (i: number): number => CYCLE_BASE_S * Math.pow(CYCLE_GROWTH, i);
/** Duração do ciclo em passos de simulação. */
export const cycleStepsOf = (i: number): number => cycleSecondsOf(i) / SIM_STEP_S;
/** Entrega por unidade ao completar o ciclo (curva própria, independente do
    tempo de ciclo): PROD_BASE + PROD_STEP·i → 0.3, 0.4, 0.5, 0.6… */
export const prodPerCycleOf = (i: number): Decimal =>
  new Decimal(PROD_BASE).add(new Decimal(PROD_STEP).mul(i));
/** Taxa média por unidade do gerador i, por segundo (entrega/ciclo ÷ duração).
    Cai a cada nível, já que o ciclo cresce mais rápido que a entrega. */
export const ratePerSecOf = (i: number): Decimal =>
  prodPerCycleOf(i).div(cycleSecondsOf(i));

/** Fator de encarecimento por compra do gerador i (ex.: 1.10, 1.12, 1.14…). */
export const buyGrowthOf = (i: number): number =>
  1 + BUY_GROWTH_BASE + BUY_GROWTH_STEP * i;

/** Custo do gerador N (índice i) na próxima compra: custo-base × (fator%)^comprados.
    O round() arredonda só o CUSTO-BASE (deixa 1, 25, 759… limpos e corrige o
    pow do break_eternity); o fator em % é aplicado por cima SEM arredondar,
    então as repetições ficam fracionárias (ex.: 1.10, 1.21) e o aumento por
    compra aparece de verdade, inclusive nas casas decimais. */
export const costOf = (i: number, bought: number): Decimal =>
  Decimal.pow(10, COST_SLOPE * i + COST_CURVE * i * i)
    .round()
    .mul(Decimal.pow(buyGrowthOf(i), bought));

export const newGen = (): Gen => ({ amount: new Decimal(0), bought: 0, cycleStep: 0 });

export const newLine = (): Line => ({
  base: START_BASE,
  totalProduced: new Decimal(0),
  gens: [newGen()],
  mode: 'manual',
  started: false,
  steps: 0,
  uptime: 0,
});

export function loadLine(s: LineSave | undefined): Line {
  if (!s || !s.gens || s.gens.length === 0) return newLine();
  return {
    base: new Decimal(s.base),
    totalProduced: new Decimal(s.totalProduced ?? s.base),
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
      cycleStep: g.cycleStep ?? 0,
    })),
    mode: s.mode ?? 'manual',
    started: s.started ?? false,
    startedAt: s.startedAt,
    steps: s.steps ?? 0,
    uptime: s.uptime ?? 0,
  };
}

export function serializeLine(g: Line): LineSave {
  return {
    base: g.base.toString(),
    totalProduced: g.totalProduced.toString(),
    gens: g.gens.map((x) => ({
      amount: x.amount.toString(),
      bought: x.bought,
      unlockedAt: x.unlockedAt,
      cycleStep: x.cycleStep,
    })),
    mode: g.mode,
    started: g.started,
    startedAt: g.startedAt,
    steps: g.steps,
    uptime: g.uptime,
  };
}

/** Executa nSteps passos fixos. Função pura e determinística. O genCap limita
    a cadeia: ao comprar o último gerador não se cria um novo além do teto. */
export function advanceLine(line: Line, nSteps: number, genCap: number): Line {
  const gens = line.gens.map((x) => ({ ...x }));
  let base = line.base;
  let totalProduced = line.totalProduced;
  let uptime = line.uptime;

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

    // Modo automático (estrito): só desbloqueia o PRÓXIMO bloqueado ou empilha
    // o MAIS ALTO já desbloqueado — nunca níveis abaixo. Se não couber nenhum
    // dos dois no saldo, espera. Prioriza desbloquear o próximo (índice maior);
    // com a cadeia toda no teto, segue empilhando o último.
    if (line.mode === 'auto') {
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
          if (i === last && gens.length < genCap) gens.push(newGen());
        }
        break;
      }
    }
  }

  return { ...line, base, totalProduced, gens, uptime, steps: line.steps + nSteps };
}

/** Compra manual de 1 unidade do gerador i (respeitando o teto). Pura. */
export function buyGen(line: Line, i: number, genCap: number): Line {
  const cost = costOf(i, line.gens[i].bought);
  if (line.base.lt(cost)) return line;

  const gens = line.gens.map((x) => ({ ...x }));
  gens[i].bought += 1;
  gens[i].amount = gens[i].amount.add(1);
  if (gens[i].bought === 1) gens[i].unlockedAt = line.uptime;
  // Primeira compra do último gerador desbloqueia o próximo, até o teto.
  if (i === gens.length - 1 && gens.length < genCap) gens.push(newGen());

  return { ...line, base: line.base.sub(cost), gens };
}
