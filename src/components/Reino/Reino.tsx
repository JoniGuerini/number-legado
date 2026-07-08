/** Modo Reino: várias linhas de produção medievais, navegáveis por sub-abas.
    Um único loop de frame avança TODAS as linhas ativas (cada uma ancorada no
    próprio startedAt), então elas continuam determinísticas mesmo iniciadas em
    momentos diferentes. O save é uma chave por slot com o estado de cada linha.

    Nesta entrega só a linha de Comida está ativa; as demais são placeholders. */

import { useEffect, useReducer, useRef, useState } from 'react';
import { useI18n, type TKey } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import ProductionLine from './ProductionLine';
import styles from './Reino.module.css';
import {
  MAX_STEPS_PER_FRAME,
  SIM_STEP_S,
  advanceLine,
  buyGen,
  loadLine,
  serializeLine,
  type Line,
  type LineSave,
  type Mode,
} from './engine';
import { ENABLED_LINES, LINES, lineDefOf, type LineId } from './lines';

type Lines = Partial<Record<LineId, Line>>;

interface ReinoSave {
  lines: Partial<Record<LineId, LineSave>>;
}

function loadReino(saveKey: string): Lines {
  const s = loadSave<ReinoSave>(saveKey);
  const lines: Lines = {};
  for (const def of ENABLED_LINES) {
    lines[def.id] = loadLine(s?.lines?.[def.id]);
  }
  return lines;
}

function serializeReino(lines: Lines): ReinoSave {
  const out: Partial<Record<LineId, LineSave>> = {};
  for (const def of ENABLED_LINES) {
    const l = lines[def.id];
    if (l) out[def.id] = serializeLine(l);
  }
  return { lines: out };
}

export default function Reino() {
  const { t } = useI18n();
  const [saveKey] = useState(() => saveKeyFor('reino'));
  const [lines, setLines] = useState<Lines>(() => loadReino(saveKey));
  // Re-render por frame para as barras de ciclo andarem suaves.
  const [, bumpFrame] = useReducer((x: number) => x + 1, 0);
  const [activeLine, setActiveLine] = useState<LineId>('comida');

  const setLine = (id: LineId, updater: (l: Line) => Line) =>
    setLines((ls) => (ls[id] ? { ...ls, [id]: updater(ls[id]!) } : ls));

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef(lines);
  saveRef.current = lines;
  useEffect(() => {
    const persist = () => writeSave(saveKey, serializeReino(saveRef.current));
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, [saveKey]);

  // Loop único: avança todas as linhas ativas a partir do relógio de parede.
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setLines((ls) => {
        let changed = false;
        const next: Lines = { ...ls };
        for (const def of ENABLED_LINES) {
          const g = next[def.id];
          if (!g || !g.started || g.startedAt === undefined) continue;
          const target = Math.floor((Date.now() - g.startedAt) / (SIM_STEP_S * 1000));
          const todo = Math.min(target - g.steps, MAX_STEPS_PER_FRAME);
          if (todo > 0) {
            next[def.id] = advanceLine(g, todo, def.genCount);
            changed = true;
          }
        }
        return changed ? next : ls;
      });
      bumpFrame();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const def = lineDefOf(activeLine);
  const line = lines[activeLine];
  // Na tela de escolha de modo (linha ativa ainda não iniciada) não faz sentido
  // mostrar as tabs de linhas — nada foi criado ainda.
  const onModeSelect = def.enabled && !!line && !line.started;

  return (
    <div className={styles.reino}>
      {!onModeSelect && (
        <nav className={styles.lineTabs}>
          {LINES.map((l) => (
            <button
              key={l.id}
              className={`${styles.lineTab} ${activeLine === l.id ? styles.lineTabActive : ''}`}
              onClick={() => setActiveLine(l.id)}
            >
              {t(`reino.line.${l.id}` as TKey)}
            </button>
          ))}
        </nav>
      )}

      {def.enabled && line ? (
        <ProductionLine
          line={line}
          lineId={def.id}
          onBuy={(i) => setLine(def.id, (g) => buyGen(g, i, def.genCount))}
          onStart={() =>
            setLine(def.id, (g) => ({
              ...g,
              started: true,
              startedAt: Date.now(),
              steps: 0,
            }))
          }
          onSetMode={(mode: Mode) => setLine(def.id, (g) => ({ ...g, mode }))}
          onToggleAuto={() =>
            setLine(def.id, (g) => ({
              ...g,
              mode: g.mode === 'auto' ? 'manual' : 'auto',
            }))
          }
        />
      ) : (
        <div className={styles.placeholder}>
          <span>{t('reino.soon')}</span>
        </div>
      )}
    </div>
  );
}
