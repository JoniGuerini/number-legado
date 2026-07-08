// Auto-mode simulation to study the unlock pacing of the cost curve.
// Usage: node scripts/simulate-balance.mjs
import Decimal from 'break_eternity.js';

const P = new Decimal(0.1); // production per unit /s
const DT = 1; // simulation resolution (s) — enough for minute-scale deltas

// Same curve as the game: triangular exponent (jumps of ×10, ×100, ×1000…).
function costOf(i) {
  return Decimal.pow(10, (i * (i + 1)) / 2);
}

function simulate(maxGens, maxTime) {
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
    const cost = costOf(last);
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
  s >= 86400
    ? `${(s / 86400).toFixed(1)}d`
    : s >= 3600
      ? `${(s / 3600).toFixed(1)}h`
      : s >= 60
        ? `${(s / 60).toFixed(1)}m`
        : `${s.toFixed(0)}s`;

const MAX_GENS = 30;
const MAX_TIME = 30 * 86400; // 30 days of simulated play

const unlocks = simulate(MAX_GENS, MAX_TIME);
unlocks.forEach((t, n) => {
  const delta = n === 0 ? t : t - unlocks[n - 1];
  console.log(
    `g${String(n + 1).padStart(2)}  at ${fmtMin(t).padStart(7)}  Δ${fmtMin(delta)}`
  );
});
if (unlocks.length < MAX_GENS) {
  console.log(`stopped at g${unlocks.length} within ${fmtMin(MAX_TIME)}`);
}
