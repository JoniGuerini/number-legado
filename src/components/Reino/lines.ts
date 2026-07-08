/** Config data-driven das linhas de produção do Reino. Para adicionar uma
    linha nova no futuro basta ligar `enabled`, definir o teto de geradores e
    acrescentar as chaves i18n correspondentes (reino.line.*, reino.base.*,
    reino.gen.<id>.N). */

export type LineId = 'comida' | 'mineracao' | 'remedios' | 'militar';

export interface LineDef {
  id: LineId;
  /** false = aba-placeholder ("em breve"), sem cadeia ainda. */
  enabled: boolean;
  /** Teto de geradores nomeados da cadeia. */
  genCount: number;
}

export const LINES: LineDef[] = [
  { id: 'comida', enabled: true, genCount: 12 },
  { id: 'mineracao', enabled: false, genCount: 0 },
  { id: 'remedios', enabled: false, genCount: 0 },
  { id: 'militar', enabled: false, genCount: 0 },
];

export const ENABLED_LINES: LineDef[] = LINES.filter((l) => l.enabled);

export const lineDefOf = (id: LineId): LineDef => LINES.find((l) => l.id === id)!;
