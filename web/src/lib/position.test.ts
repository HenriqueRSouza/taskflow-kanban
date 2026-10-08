import { describe, expect, it } from 'vitest';
import { needsRebalance, positionAtIndex, positionBetween, rebalancedPositions } from './position';

describe('positionBetween', () => {
  it.each([
    [undefined, undefined, 1024],
    [1024, undefined, 2048],
    [undefined, 1024, 512],
    [1024, 2048, 1536],
  ])('calcula a posição entre %s e %s', (before, after, expected) => {
    expect(positionBetween(before, after)).toBe(expected);
  });
});

describe('positionAtIndex', () => {
  it.each([
    [0, 512],
    [1, 1536],
    [2, 3072],
    [-10, 512],
    [10, 3072],
  ])('insere no índice %s respeitando os limites da lista', (index, expected) => {
    expect(positionAtIndex([1024, 2048], index)).toBe(expected);
  });

  it('insere em uma lista vazia', () => {
    expect(positionAtIndex([], 0)).toBe(1024);
  });
});

describe('rebalanceamento', () => {
  it('mantém posições com espaço suficiente', () => {
    expect(needsRebalance([1024, 2048])).toBe(false);
  });

  it('detecta vizinhos separados por menos de 1e-6', () => {
    expect(needsRebalance([1024, 1024 + 5e-7])).toBe(true);
  });

  it('detecta posições iguais', () => {
    expect(needsRebalance([1024, 1024])).toBe(true);
  });

  it('distribui três posições com intervalos de 1024', () => {
    expect(rebalancedPositions(3)).toEqual([1024, 2048, 3072]);
  });

  it('precisa rebalancear após inserções repetidas no início', () => {
    const positions: number[] = [];
    let rebalanceDetected = false;

    for (let index = 0; index < 60; index += 1) {
      positions.unshift(positionAtIndex(positions, 0));
      rebalanceDetected ||= needsRebalance(positions);
    }

    // Cada inserção divide a primeira posição por dois, esgotando o espaço entre vizinhos.
    expect(positions).toHaveLength(60);
    expect(rebalanceDetected).toBe(true);
    expect(needsRebalance(rebalancedPositions(positions.length))).toBe(false);
  });
});
