/*
 * Ordenação por posição fracionária (docs/PLANEJAMENTO.md §4.3).
 *
 * Cada coluna/cartão guarda um número `position`. Para inserir um item entre
 * A (1024) e B (2048) basta dar a ele 1536 — só UM registro muda no banco,
 * em vez de renumerar a lista inteira a cada arrasto.
 */

export const POSITION_STEP = 1024;

/** Menor distância aceitável entre vizinhos antes de renumerar a lista. */
const MIN_GAP = 1e-6;

/** Posição entre dois vizinhos; `undefined` significa início/fim da lista. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined) return after === undefined ? POSITION_STEP : after / 2;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}

/**
 * Posição para inserir um item no índice `index` de uma lista já ordenada
 * (a lista NÃO deve conter o próprio item que está sendo movido).
 */
export function positionAtIndex(sortedPositions: readonly number[], index: number): number {
  const clamped = Math.max(0, Math.min(index, sortedPositions.length));
  return positionBetween(sortedPositions[clamped - 1], sortedPositions[clamped]);
}

/** Indica se os vizinhos ficaram próximos demais e a lista deve ser renumerada. */
export function needsRebalance(sortedPositions: readonly number[]): boolean {
  return sortedPositions.slice(1).some((position, i) => position - (sortedPositions[i] ?? -Infinity) < MIN_GAP);
}

/** Posições igualmente espaçadas para `count` itens: 1024, 2048, 3072… */
export function rebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
