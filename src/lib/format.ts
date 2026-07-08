import Decimal from 'break_eternity.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];

/** Trunca (não arredonda) para n casas — estilo odômetro: "0.5" só aparece
    quando o valor realmente vale 0.5. O epsilon evita que resíduo de ponto
    flutuante (0.4999...9) derrube o dígito que deveria estar completo. */
function truncTo(num: number, decimals: number): string {
  const f = 10 ** decimals;
  return (Math.floor(num * f + 1e-9) / f).toFixed(decimals);
}

/** Sufixo de letras infinito: 0='aa'...'az', 26='ba'...675='zz',
    676='aaa'...'zzz', depois 'aaaa' e assim por diante. */
function letterSuffix(index: number): string {
  let len = 2;
  let count = 26 ** len;
  let i = index;
  while (i >= count) {
    i -= count;
    len++;
    count = 26 ** len;
  }
  let s = '';
  for (let k = 0; k < len; k++) {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

/** Formata número grande com sufixo curto (1.2K... 5.6No) e, a partir de onde
    seria o decilhão (10^33), sufixos de letras sem fim (1.2aa... zz, aaa...).
    Aceita Decimal ou number. */
export function fmt(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.sign < 0) return '-' + fmt(d.neg());
  if (d.eq(0)) return '0';

  if (d.lt(1000)) {
    const num = d.toNumber();
    return Number.isInteger(num) || num >= 100
      ? Math.floor(num + 1e-9).toString()
      : truncTo(num, 1);
  }

  const exp = d.log10().toNumber();
  // Além do alcance de expoente legível, delega pro toString do Decimal ("ee42"...)
  if (!Number.isFinite(exp) || exp >= 1e15) return d.toString();

  const tier = Math.floor(exp / 3);
  const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
  const body = scaled >= 100 ? truncTo(scaled, 0) : truncTo(scaled, 1);
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier] : letterSuffix(tier - SUFFIXES.length);
  return body + suffix;
}

export function fmtMoney(n: Decimal | number): string {
  return '$ ' + fmt(n);
}

/** Preço de compra: mantém 2 casas decimais enquanto o valor é pequeno
    (< 1000), pra que o encarecimento em % por compra apareça no botão; acima
    disso delega pro formatador curto com sufixo (K, M…), onde os centavos
    seriam irrelevantes. */
export function fmtCost(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.lt(1000)) return truncTo(d.toNumber(), 2);
  return fmt(d);
}

/** Taxa por segundo, sempre com 1 casa quando pequena */
export function fmtRate(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.lt(1000)) {
    const num = d.toNumber();
    if (!Number.isInteger(num)) return truncTo(num, 1);
  }
  return fmt(d);
}

/** Idade aproximada, sem precisão de segundos: "há pouco" (<1min), depois
    "5m", e a partir de 1h duas casas de grandeza ("2h 05m", "3d 04h"). */
export function fmtAge(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  if (m < 1) return 'há pouco';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${(h % 24).toString().padStart(2, '0')}h`;
}

/** Tempo decorrido em segundos → "2m 05s" / "45s" / "1h 12m".
    Arredonda pra BAIXO (semântica de cronômetro): "5s" só aparece quando
    5s reais já passaram. (O ceil original do Coders era pra tempo restante.) */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
}
