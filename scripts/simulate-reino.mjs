// Tuning da linha de Comida do Reino (12 geradores, teto finito).
// Espelha exatamente src/components/Reino/engine.ts (batelada por ciclo,
// passo fixo de 0.25s, auto-compra do próximo gerador). Uso:
//   node scripts/simulate-reino.mjs
import Decimal from 'break_eternity.js';

const SIM_STEP_S = 0.25;
const CAP = 12;
const MAX_TIME = 48 * 3600; // 48h de jogo simulado (headroom p/ curvas duras)

// Tempo de ciclo (geométrico): base * cycleGrowth^i
const makeCycleFn = ({ base, cycleGrowth }) => (i) => base * Math.pow(cycleGrowth, i);

// Produção por ciclo DESACOPLADA do tempo, crescimento ARITMÉTICO:
// prodBase + prodStep*i → 0.3, 0.4, 0.5…
const makeProdFn = ({ prodBase, prodStep }) => (i) =>
  new Decimal(prodBase).add(new Decimal(prodStep).mul(i));

// Expoente = slope*i + curve*i^2. Em i=0 dá 10^0 = 1, então o 1º gerador
// (Ceifeiro) é sempre comprável com a base inicial e o jogo arranca; o
// encarecimento se concentra nos geradores seguintes.
const buyGrowthOf = (i) => 1 + 0.1 + 0.02 * i; // 1.10, 1.12, 1.14…
function costOf(i, bought, slope, curve) {
  return Decimal.pow(10, slope * i + curve * i * i)
    .round()
    .mul(Decimal.pow(buyGrowthOf(i), bought));
}

function simulate(params) {
  const cycleSecondsOf = makeCycleFn(params);
  const cycleStepsOf = (i) => cycleSecondsOf(i) / SIM_STEP_S;
  const prodPerCycleOf = makeProdFn(params);

  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  let uptime = 0;
  const steps = Math.floor(MAX_TIME / SIM_STEP_S);

  for (let s = 0; s < steps && unlocks.length < CAP; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleStepsOf(i)) {
        gen.cycleStep = 0;
        const out = gen.amount.mul(prodPerCycleOf(i));
        if (i === 0) base = base.add(out);
        else gens[i - 1].amount = gens[i - 1].amount.add(out);
      }
    }

    const last = gens.length - 1;
    const cost = costOf(last, 0, params.slope, params.curve);
    if (gens[last].bought === 0 && base.gte(cost)) {
      base = base.sub(cost);
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(uptime);
      if (gens.length < CAP) gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
    }
  }
  return unlocks;
}

const fmt = (s) =>
  s == null
    ? '—'
    : s >= 3600
      ? `${(s / 3600).toFixed(1)}h`
      : s >= 60
        ? `${(s / 60).toFixed(1)}m`
        : `${s.toFixed(0)}s`;

// Ciclo 2s ×3, produção 0.3 +0.1/nível (fixos). Varia só o custo.
const base = { base: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1 };
const CANDIDATES = [
  { label: 'Camponês=25  slope1.36 c.04', ...base, slope: 1.36, curve: 0.04 },
];

// Formatador de número curto (K, M, B…) só para a tabela de custos.
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function n(dec) {
  const s = dec.toString();
  if (dec.lt(1000)) return Math.round(dec.toNumber()).toString();
  const exp = Math.floor(dec.log10().toNumber());
  const tier = Math.floor(exp / 3);
  const scaled = dec.div(Decimal.pow(10, tier * 3)).toNumber();
  return (scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled)) + (SUF[tier] ?? 'e' + tier * 3);
}

// Tabela do ciclo e da taxa por gerador (o ponto crítico do ×3)
console.log('\n=== Ciclo e taxa por gerador (2s ×3, prod 0.3 +0.1) ===');
for (let i = 0; i < 12; i++) {
  const sec = 2 * Math.pow(3, i);
  const prod = 0.3 + 0.1 * i;
  console.log(`  g${i + 1}: ciclo ${fmt(sec)} (${sec}s), entrega ${prod.toFixed(1)}/ciclo → ${(prod / sec).toFixed(5)}/s`);
}

for (const c of CANDIDATES) {
  console.log(`\n### ${c.label}`);
  console.log('  Custo da 1ª compra por gerador:');
  const NAMES = ['Ceifeiro', 'Camponês', 'Lavrador', 'Feitor', 'Aldeia', 'Vila', 'Feudo', 'Nobre', 'Barão', 'Conde', 'Duque', 'Reino'];
  for (let i = 0; i < 12; i++) {
    console.log(`    g${i + 1} ${NAMES[i].padEnd(9)} ${n(costOf(i, 0, c.slope, c.curve))}`);
  }
  console.log('  Comprar VÁRIOS do mesmo (custo da N-ésima unidade):');
  for (const gi of [0, 1, 2]) {
    const pct = ((buyGrowthOf(gi) - 1) * 100).toFixed(0);
    const buys = [0, 4, 9, 24, 49, 99].map((b) => `${b + 1}ª=${n(costOf(gi, b, c.slope, c.curve))}`);
    console.log(`    ${NAMES[gi].padEnd(9)} (+${pct}%): ${buys.join('  ')}`);
  }

  const u = simulate(c);
  const perGen = u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ');
  console.log('  Ritmo no automático (compra 1 de cada):');
  console.log(`    ${perGen}`);
  console.log(`    chegou a g${u.length} em ${fmt(u[u.length - 1])}`);
}
