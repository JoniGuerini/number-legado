// Simulação do modo automático para tunar a curva de custos.
// Uso: node scripts/simulate-balance.mjs
import Decimal from 'break_eternity.js';

const P = new Decimal(0.1); // produção por unidade /s
const DT = 1; // resolução da simulação (s) — suficiente p/ deltas de minutos

function costOf(i, c) {
  return Decimal.pow(10, i + c * i * i);
}

function simulate(c, maxGens, maxTime) {
  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0 }];
  const unlocks = [];
  let t = 0;

  while (t < maxTime && unlocks.length < maxGens) {
    for (let i = gens.length - 1; i >= 1; i--) {
      gens[i - 1].amount = gens[i - 1].amount.add(gens[i].amount.mul(P).mul(DT));
    }
    base = base.add(gens[0].amount.mul(P).mul(DT));

    const last = gens.length - 1;
    const cost = costOf(last, c);
    if (gens[last].bought === 0 && base.gte(cost)) {
      base = base.sub(cost);
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(t);
      gens.push({ amount: new Decimal(0), bought: 0 });
    }
    t += DT;
  }
  return unlocks;
}

const fmtMin = (s) =>
  s >= 3600
    ? `${(s / 3600).toFixed(1)}h`
    : s >= 60
      ? `${(s / 60).toFixed(1)}m`
      : `${s.toFixed(0)}s`;

const CHECKPOINTS = [5, 10, 20, 30, 40, 50];
const MAX_TIME = 12 * 3600; // 12h de jogo simulado

for (const c of [0, 0.002, 0.004, 0.008]) {
  const unlocks = simulate(c, 51, MAX_TIME);
  const parts = CHECKPOINTS.map((n) => {
    if (unlocks.length <= n) return `g${n}: —`;
    const delta = unlocks[n] - unlocks[n - 1];
    return `g${n}: Δ${fmtMin(delta)}`;
  });
  const total =
    unlocks.length > 50 ? `total até g51: ${fmtMin(unlocks[50])}` : `chegou só a g${unlocks.length}`;
  console.log(`c=${c}  ${parts.join('  ')}  |  ${total}`);
}
