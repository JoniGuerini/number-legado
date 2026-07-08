import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/locale';
import { CHANGELOG, type PatchNote } from '../../data/changelog';
import styles from './PatchNotes.module.css';

/** Categorias de mudança, na ordem de exibição. As chaves batem com os
    campos opcionais de PatchNote; o label é o cabeçalho da seção. */
const SECTIONS: { key: keyof PatchNote; label: string }[] = [
  { key: 'major', label: 'Major features' },
  { key: 'minor', label: 'Minor features' },
  { key: 'qol', label: 'Quality of life' },
  { key: 'fixes', label: 'Fixes' },
];

/** Nível de destaque do release (último número da versão é 0):
    MINOR (0.x.0) = "grande", MAJOR (x.0.0) = "massivo". PATCH retorna null.
    Releases de destaque ganham faixa e cor azul no topo, estilo Steam. */
type FeatureTier = 'minor' | 'major';

function featureTier(version: string): FeatureTier | null {
  const parts = version.replace(/^v/, '').split('.');
  if (parts.length !== 3 || parts[2] !== '0') return null;
  return parts[1] === '0' ? 'major' : 'minor';
}

const TIER_LABEL: Record<FeatureTier, string> = {
  minor: 'Feature release',
  major: 'Major update',
};

/** Corpo do card: resumo + seções por categoria. */
function PatchBody({ patch }: { patch: PatchNote }) {
  return (
    <>
      <p className={styles.summary}>{patch.summary}</p>

      <div className={styles.sections}>
        {SECTIONS.map(({ key, label }) => {
          const items = patch[key] as string[] | undefined;
          if (!items || items.length === 0) return null;
          return (
            <section key={key} className={styles.section}>
              <div className={styles.sectionLabel} data-cat={key}>
                <span className={styles.dot} aria-hidden="true" />
                {label}
              </div>
              <ul className={styles.items}>
                {items.map((note, i) => (
                  <li key={i} className={styles.note} data-cat={key}>
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Um card de versão. Releases de destaque (feature) ficam sempre abertos e
    com faixa; os patches pequenos começam colapsados e abrem ao clicar. */
function PatchEntry({ patch }: { patch: PatchNote }) {
  const tier = featureTier(patch.version);
  const collapsible = tier === null;
  const [open, setOpen] = useState(false);
  const expanded = !collapsible || open;

  const toggle = () => collapsible && setOpen((o) => !o);

  return (
    <article
      className={`${styles.entry} ${tier ? styles.entryFeature : ''} ${
        collapsible ? styles.collapsible : ''
      }`}
    >
      {tier && <div className={styles.featureBanner}>{TIER_LABEL[tier]}</div>}

      <header
        className={styles.header}
        onClick={toggle}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
      >
        <h2 className={styles.version}>{patch.version}</h2>
        <span className={styles.title}>{patch.title}</span>
        <span className={styles.date}>
          {patch.date} · {patch.time ?? '—'}
        </span>
        {collapsible && (
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </header>

      {expanded && <PatchBody patch={patch} />}
    </article>
  );
}

/** Aba Notas: o histórico de versões do laboratório. */
export default function PatchNotes() {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  const updateEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdges({
      above: el.scrollTop > 4,
      below: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  }, []);

  // Bordas recalculadas ao rolar, ao redimensionar a janela e sempre que o
  // conteúdo mudar de altura (cards expandindo/colapsando → ResizeObserver).
  useEffect(() => {
    const el = listRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    const ro = new ResizeObserver(updateEdges);
    ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const animate = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;
    const step = (now: number) => {
      const list = listRef.current;
      if (!list) return;
      const p = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return (
    <div className={styles.wrap}>
      {edges.above && (
        <button
          className={`${styles.fade} ${styles.fadeTop}`}
          onClick={() => animate(() => 0)}
          aria-label={t('common.toStart')}
        >
          ↑
        </button>
      )}
      <div className={styles.list} ref={listRef}>
        <div className={styles.inner} ref={innerRef}>
          {CHANGELOG.map((patch) => (
            <PatchEntry key={patch.version} patch={patch} />
          ))}
        </div>
      </div>
      {edges.below && (
        <button
          className={`${styles.fade} ${styles.fadeBottom}`}
          onClick={() => animate((el) => el.scrollHeight - el.clientHeight)}
          aria-label={t('common.toEnd')}
        >
          ↓
        </button>
      )}
    </div>
  );
}
