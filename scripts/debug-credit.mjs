// Instrumenta cyc vs cycCredit: produção total entregue à base ao longo do
// tempo e estado dos geradores, para achar onde o crédito perde dinheiro.
import Decimal from 'break_eternity.js';

const STEP = 0.25;
const COST_CURVE = 0.004;
const costOf = (i) => Decimal.pow(10, i + COST_CURVE * i * i).round();
const cycleSteps = (i) => (5 * (i + 1)) / STEP;
const prodPerCycle = (i) => new Decimal(0.1).mul(5 * (i + 1));

function sim(useCredit, maxTime, checkpoints) {
  let base = new Decimal(1);
  let debt = new Decimal(0);
  let totalDelivered = new Decimal(0);
  let totalSpent = new Decimal(0);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  const snaps = [];

  for (let t = STEP; t <= maxTime; t += STEP) {
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleSteps(i)) {
        gen.cycleStep = 0;
        let out = gen.amount.mul(prodPerCycle(i));
        if (i === 0) {
          totalDelivered = totalDelivered.add(out); // produção bruta
          out = out.sub(debt);
          debt = new Decimal(0);
          base = base.add(out);
        } else {
          gens[i - 1].amount = gens[i - 1].amount.add(out);
        }
      }
    }

    const last = gens.length - 1;
    const cost = costOf(last);
    const credit = useCredit
      ? gens[0].amount.mul(0.1).mul(gens[0].cycleStep * STEP).sub(debt)
      : new Decimal(0);
    if (gens[last].bought === 0 && base.add(credit).gte(cost)) {
      totalSpent = totalSpent.add(cost);
      if (base.gte(cost)) {
        base = base.sub(cost);
      } else {
        debt = debt.add(cost.sub(base));
        base = new Decimal(0);
      }
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(t);
      gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
    }

    if (checkpoints.includes(t)) {
      snaps.push({
        t,
        gens: gens.length - 1,
        base: base.toNumber(),
        debt: debt.toNumber(),
        delivered: totalDelivered.toNumber(),
        spent: totalSpent.toNumber(),
        g1: gens[0].amount.toNumber(),
        g2: gens[1] ? gens[1].amount.toNumber() : 0,
      });
    }
  }
  return { unlocks, snaps };
}

const CHECKS = [300, 600, 1200, 1800, 2400, 3000, 3600];
const a = sim(false, 3600, CHECKS);
const b = sim(true, 3600, CHECKS);

console.log('t     | HOJE: gens delivered g1        | CRÉDITO: gens delivered g1     | razão delivered');
for (let i = 0; i < CHECKS.length; i++) {
  const x = a.snaps[i], y = b.snaps[i];
  console.log(
    String(x.t).padStart(5) + ' | ' +
    String(x.gens).padStart(4) + ' ' + x.delivered.toExponential(3).padStart(10) + ' ' + x.g1.toExponential(2).padStart(9) + ' | ' +
    String(y.gens).padStart(4) + ' ' + y.delivered.toExponential(3).padStart(10) + ' ' + y.g1.toExponential(2).padStart(9) + ' | ' +
    (y.delivered / x.delivered).toFixed(4)
  );
}
console.log('\nprimeiros desbloqueios (s):');
console.log('hoje   :', a.unlocks.slice(0, 12).map((v) => v.toFixed(2)).join(', '));
console.log('crédito:', b.unlocks.slice(0, 12).map((v) => v.toFixed(2)).join(', '));
