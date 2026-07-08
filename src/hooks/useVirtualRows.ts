import { useState, type RefObject } from 'react';

/**
 * Janela virtual para listas de linhas uniformes que re-renderizam a cada
 * frame: calcula quais índices estão visíveis no scroll (com folga) para as
 * demais linhas serem renderizadas como fantasmas de mesma altura — o layout,
 * o scrollHeight e as setinhas de navegação ficam idênticos, só o custo some.
 *
 * Lê scrollTop/clientHeight direto do ref durante o render: como os
 * componentes de jogo re-renderizam todo frame (extrapolação visual), o
 * recorte se mantém fresco sem listeners próprios.
 */
export function useVirtualRows(
  listRef: RefObject<HTMLDivElement>,
  count: number,
  gapPx: number,
  estimateRowPx = 80,
  overscan = 6
) {
  const [rowHeight, setRowHeight] = useState(estimateRowPx);

  /** Callback ref para linhas reais: mede a altura de verdade do card. */
  const measureRef = (el: HTMLElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0 && Math.abs(h - rowHeight) > 0.5) setRowHeight(h);
  };

  const el = listRef.current;
  const top = el?.scrollTop ?? 0;
  const viewH = el?.clientHeight ?? 0;

  const stride = rowHeight + gapPx;
  const first = Math.max(0, Math.floor(top / stride) - overscan);
  const last = Math.min(count - 1, Math.ceil((top + viewH) / stride) + overscan);

  return { first, last, rowHeight, measureRef };
}
