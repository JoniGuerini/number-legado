import { useRef, type RefObject } from 'react';

/**
 * Janela virtual para listas de linhas uniformes que re-renderizam a cada
 * frame: calcula quais índices estão visíveis no scroll (com folga) para as
 * demais linhas serem renderizadas como fantasmas de mesma altura — o layout,
 * o scrollHeight e as setinhas de navegação ficam idênticos, só o custo some.
 *
 * Lê scrollTop/clientHeight direto do ref durante o render: como os
 * componentes de jogo re-renderizam todo frame (extrapolação visual), o
 * recorte se mantém fresco sem listeners próprios.
 *
 * A altura medida vive num ref (NUNCA em estado): com linhas de alturas
 * ligeiramente diferentes (texto quebrado no mobile), medir via setState
 * fazia cada linha "corrigir" a das outras em loop infinito (React #185).
 * O valor entra em vigor no próximo re-render natural (todo frame).
 */
export function useVirtualRows(
  listRef: RefObject<HTMLDivElement>,
  count: number,
  gapPx: number,
  estimateRowPx = 80,
  overscan = 6
) {
  const rowHeightRef = useRef(estimateRowPx);

  /** Callback ref para linhas reais: mede a altura de verdade do card. */
  const measureRef = (el: HTMLElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) rowHeightRef.current = h;
  };

  const rowHeight = rowHeightRef.current;
  const el = listRef.current;
  const top = el?.scrollTop ?? 0;
  const viewH = el?.clientHeight ?? 0;

  const stride = rowHeight + gapPx;
  const first = Math.max(0, Math.floor(top / stride) - overscan);
  const last = Math.min(count - 1, Math.ceil((top + viewH) / stride) + overscan);

  return { first, last, rowHeight, measureRef };
}
