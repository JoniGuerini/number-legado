// Compara os motores Geradores (contínuo) e Ciclos (rajadas) em modo
// automático, com a mesma curva de custos, imprimindo os desbloqueios.
// Uso: node scripts/compare-engines.mjs
import Decimal from 'break_eternity.js';

const STEP = 0.25;
const COST_CURVE = 0.004;
const costOf = (i) => Decimal.pow(10, i + COST_CURVE * i * i).round();

function simContinuous(maxTime) {
  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0 }];
  const unlocks = [];
  const P_STEP = new Decimal(0.1).mul(STEP);

  for (let t = STEP; t <= maxTime; t += STEP) {
    for (let i = gens.length - 1; i >= 1; i--) {
      gens[i - 1].amount = gens[i - 1].amount.add(gens[i].amount.mul(P_STEP));
    }
    base = base.add(gens[0].amount.mul(P_STEP));

    const last = gens.length - 1;
    const cost = costOf(last);
    if (gens[last].bought === 0 && base.gte(cost)) {
      base = base.sub(cost);
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(t);
      gens.push({ amount: new Decimal(0), bought: 0 });
    }
  }
  return unlocks;
}

function simCycles(maxTime) {
  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  const cycleSteps = (i) => (5 * (i + 1)) / STEP;
  const prodPerCycle = (i) => new Decimal(0.1).mul(5 * (i + 1));

  for (let t = STEP; t <= maxTime; t += STEP) {
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleSteps(i)) {
        gen.cycleStep = 0;
        const out = gen.amount.mul(prodPerCycle(i));
        if (i === 0) base = base.add(out);
        else gens[i - 1].amount = gens[i - 1].amount.add(out);
      }
    }

    const last = gens.length - 1;
    const cost = costOf(last);
    if (gens[last].bought === 0 && base.gte(cost)) {
      base = base.sub(cost);
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(t);
      gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
    }
  }
  return unlocks;
}

// Variante com crédito do ciclo em andamento: a compra pode usar a produção
// já realizada pelo gerador 1 dentro do ciclo atual (desconta do lote a caminho).
function simCyclesCredit(maxTime) {
  let base = new Decimal(1);
  let debt = new Decimal(0);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  const cycleSteps = (i) => (5 * (i + 1)) / STEP;
  const prodPerCycle = (i) => new Decimal(0.1).mul(5 * (i + 1));

  for (let t = STEP; t <= maxTime; t += STEP) {
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleSteps(i)) {
        gen.cycleStep = 0;
        let out = gen.amount.mul(prodPerCycle(i));
        if (i === 0) {
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
    // Crédito = produção já realizada pelo gen 1 no ciclo atual, ainda não entregue
    const credit = gens[0].amount
      .mul(0.1)
      .mul(gens[0].cycleStep * STEP)
      .sub(debt);
    if (gens[last].bought === 0 && base.add(credit).gte(cost)) {
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
  }
  return unlocks;
}

const MAX = 4 * 3600; // 4h simuladas
const cont = simContinuous(MAX);
const cyc = simCycles(MAX);
const cycCredit = simCyclesCredit(MAX);

const fmtT = (s) =>
  s >= 3600 ? (s / 3600).toFixed(2) + 'h' : s >= 60 ? (s / 60).toFixed(1) + 'm' : s.toFixed(0) + 's';
const diff = (a, b) =>
  a !== undefined && b !== undefined ? (b - a >= 0 ? '+' : '−') + fmtT(Math.abs(b - a)) : '—';

console.log('gen | GERADORES | CICLOS hoje (atraso) | CICLOS c/ crédito (atraso)');
const n = Math.max(cont.length, cyc.length, cycCredit.length);
for (let i = 0; i < n; i++) {
  const a = cont[i], b = cyc[i], c = cycCredit[i];
  console.log(
    String(i + 1).padStart(3) + ' | ' +
    (a !== undefined ? fmtT(a).padStart(9) : '        —') + ' | ' +
    (b !== undefined ? fmtT(b).padStart(9) : '        —').padStart(9) + ' (' + diff(a, b).padStart(6) + ') | ' +
    (c !== undefined ? fmtT(c).padStart(9) : '        —').padStart(9) + ' (' + diff(a, c).padStart(6) + ')'
  );
}
