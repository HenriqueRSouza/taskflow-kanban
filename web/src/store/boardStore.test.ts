// @vitest-environment jsdom
import { BoardSnapshotSchema, CardIdSchema, ColumnIdSchema, TagIdSchema } from '@taskflow/shared';
import type { CardId, ColumnId } from '@taskflow/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedBoard } from '../lib/devSeed';
import { createDefaultBoard, denormalize, normalize, useBoardStore } from './boardStore';

function columnAt(index: number): ColumnId {
  return ColumnIdSchema.parse(useBoardStore.getState().columnOrder[index]);
}

function addCard(columnId: ColumnId, title: string): CardId {
  return CardIdSchema.parse(useBoardStore.getState().addCard(columnId, title));
}

function expectIncreasing(positions: number[]): void {
  expect(positions.length).toBeGreaterThan(1);
  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index]).toBeGreaterThan(positions[index - 1]!);
  }
}

beforeEach(() => {
  localStorage.clear();
  useBoardStore.setState(createDefaultBoard());
});

describe('criação', () => {
  it.each(['', '   '])('rejeita coluna com título vazio (%j) sem alterar o estado', (title) => {
    const before = useBoardStore.getState();
    expect(before.addColumn(title)).toBeNull();
    expect(useBoardStore.getState()).toBe(before);
  });

  it.each(['', '   '])('rejeita cartão com título vazio (%j) sem alterar o estado', (title) => {
    const before = useBoardStore.getState();
    expect(before.addCard(columnAt(0), title)).toBeNull();
    expect(useBoardStore.getState()).toBe(before);
  });

  it('adiciona o cartão no fim com posição maior que a do último', () => {
    const columnId = columnAt(0);
    const first = addCard(columnId, 'A');
    const second = addCard(columnId, 'B');
    const third = addCard(columnId, 'C');
    const state = useBoardStore.getState();

    expect(state.cardOrder[columnId]).toEqual([first, second, third]);
    expectIncreasing([first, second, third].map((id) => state.cards[id]!.position));
  });
});

describe('movimentação', () => {
  it('move A para o índice 2 na mesma coluna e mantém posições crescentes', () => {
    const columnId = columnAt(0);
    const first = addCard(columnId, 'A');
    const second = addCard(columnId, 'B');
    const third = addCard(columnId, 'C');

    useBoardStore.getState().moveCard(first, columnId, 2);
    const state = useBoardStore.getState();

    expect(state.cardOrder[columnId]).toEqual([second, third, first]);
    expectIncreasing([second, third, first].map((id) => state.cards[id]!.position));
    expect(state.cards[first]?.columnId).toBe(columnId);
  });

  it('move entre colunas, insere no índice pedido e atualiza columnId', () => {
    const source = columnAt(0);
    const target = columnAt(1);
    const moved = addCard(source, 'A');
    const remaining = addCard(source, 'B');
    const first = addCard(target, 'C');
    const last = addCard(target, 'D');

    useBoardStore.getState().moveCard(moved, target, 1);
    const state = useBoardStore.getState();

    expect(state.cardOrder[source]).toEqual([remaining]);
    expect(state.cardOrder[target]).toEqual([first, moved, last]);
    expect(state.cards[moved]?.columnId).toBe(target);
    expectIncreasing([first, moved, last].map((id) => state.cards[id]!.position));
  });

  it('preserva os dados quando o cartão ou a coluna não existe', () => {
    const columnId = columnAt(0);
    const cardId = addCard(columnId, 'A');
    const before = useBoardStore.getState();

    before.moveCard(CardIdSchema.parse(crypto.randomUUID()), columnId, 0);
    expect(useBoardStore.getState()).toEqual(before);
    before.moveCard(cardId, ColumnIdSchema.parse(crypto.randomUUID()), 0);
    expect(useBoardStore.getState()).toEqual(before);
  });

  // Bug conhecido em boardStore.ts:232: retornar {} cria outro estado no Zustand.
  // Falhas esperadas mantêm o contrato testado sem corrigir o store, conforme o ticket.
  it('preserva a mesma referência de estado quando o cartão não existe', () => {
    const before = useBoardStore.getState();
    before.moveCard(CardIdSchema.parse(crypto.randomUUID()), columnAt(0), 0);
    expect(useBoardStore.getState()).toBe(before);
  });

  it('preserva a mesma referência de estado quando a coluna não existe', () => {
    const cardId = addCard(columnAt(0), 'A');
    const before = useBoardStore.getState();
    before.moveCard(cardId, ColumnIdSchema.parse(crypto.randomUUID()), 0);
    expect(useBoardStore.getState()).toBe(before);
  });

  it('reordena as colunas e mantém posições crescentes', () => {
    const first = columnAt(0);
    const second = columnAt(1);
    const third = columnAt(2);

    useBoardStore.getState().moveColumn(first, 2);
    const state = useBoardStore.getState();

    expect(state.columnOrder).toEqual([second, third, first]);
    expectIncreasing(state.columnOrder.map((id) => state.columns[id]!.position));
  });
});

describe('quadro de teste para desempenho', () => {
  it.each([200, 201])('substitui o quadro por %i cartões válidos e distribuídos', (cardCount) => {
    addCard(columnAt(0), 'Cartão antigo');
    seedBoard(cardCount);
    const state = useBoardStore.getState();
    const board = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true })
      .parse(denormalize(state));

    expect(board.columns.map((column) => column.title)).toEqual(['Backlog', 'A Fazer', 'Fazendo', 'Feito']);
    expect(board.cards).toHaveLength(cardCount);
    expect(board.cards.some((card) => card.title === 'Cartão antigo')).toBe(false);
    expect(board.tags).toHaveLength(3);
    expect(new Set([...board.columns, ...board.cards, ...board.tags].map((item) => item.id)).size)
      .toBe(cardCount + 7);
    expect(board.cards.some((card) => card.title.startsWith('Tarefa 001 — '))).toBe(true);
    expect(new Set(board.cards.map((card) => card.title.split(' — ')[1])).size).toBeGreaterThan(1);
    expect(board.cards.filter((card) => card.tagIds.length > 0)).toHaveLength(Math.ceil(cardCount / 3));
    expect(board.cards.some((card) => card.tagIds.length === 1)).toBe(true);
    expect(board.cards.some((card) => card.tagIds.length === 2)).toBe(true);
    expect(board.cards.every((card) => card.tagIds.length <= 2
      && card.tagIds.every((id) => board.tags.some((tag) => tag.id === id)))).toBe(true);

    const counts = state.columnOrder.map((id) => state.cardOrder[id]!.length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    for (const columnId of state.columnOrder) {
      const ids = state.cardOrder[columnId]!;
      expect(ids.every((id) => state.cards[id]?.columnId === columnId)).toBe(true);
      expectIncreasing(ids.map((id) => state.cards[id]!.position));
    }
  });

  it('gera um quadro sem cartões quando a quantidade é zero', () => {
    seedBoard(0);
    const state = useBoardStore.getState();
    expect(state.columnOrder).toHaveLength(4);
    expect(Object.values(state.tags)).toHaveLength(3);
    expect(Object.values(state.cards)).toHaveLength(0);
    expect(Object.values(state.cardOrder).every((ids) => ids.length === 0)).toBe(true);
  });

  it.each([-1, 1.5, NaN, Infinity])('rejeita quantidade inválida (%s) sem alterar o estado', (cardCount) => {
    const before = useBoardStore.getState();
    expect(() => seedBoard(cardCount)).toThrow('A quantidade de cartões deve ser um inteiro não negativo.');
    expect(useBoardStore.getState()).toBe(before);
  });
});

describe('remoção e etiquetas', () => {
  it('remove a coluna e todos os seus cartões, preservando as outras colunas', () => {
    const removedColumn = columnAt(0);
    const keptColumn = columnAt(1);
    const first = addCard(removedColumn, 'A');
    const second = addCard(removedColumn, 'B');
    const kept = addCard(keptColumn, 'C');

    useBoardStore.getState().removeColumn(removedColumn);
    const state = useBoardStore.getState();

    expect(state.columns[removedColumn]).toBeUndefined();
    expect(state.cardOrder[removedColumn]).toBeUndefined();
    expect(state.columnOrder).not.toContain(removedColumn);
    expect(state.cards[first]).toBeUndefined();
    expect(state.cards[second]).toBeUndefined();
    expect(state.cards[kept]).toBeDefined();
    expect(state.cardOrder[keptColumn]).toEqual([kept]);
  });

  it('adiciona e remove uma etiqueta do cartão', () => {
    const cardId = addCard(columnAt(0), 'A');
    const tagId = TagIdSchema.parse(useBoardStore.getState().createTag('Urgente', 'red'));

    useBoardStore.getState().toggleCardTag(cardId, tagId);
    expect(useBoardStore.getState().cards[cardId]?.tagIds).toEqual([tagId]);
    useBoardStore.getState().toggleCardTag(cardId, tagId);
    expect(useBoardStore.getState().cards[cardId]?.tagIds).toEqual([]);
  });

  it('remove a etiqueta de todos os cartões e preserva as outras etiquetas', () => {
    const first = addCard(columnAt(0), 'A');
    const second = addCard(columnAt(1), 'B');
    const untagged = addCard(columnAt(2), 'C');
    const removed = TagIdSchema.parse(useBoardStore.getState().createTag('Urgente', 'red'));
    const kept = TagIdSchema.parse(useBoardStore.getState().createTag('Revisão', 'blue'));

    useBoardStore.getState().toggleCardTag(first, removed);
    useBoardStore.getState().toggleCardTag(second, removed);
    useBoardStore.getState().toggleCardTag(second, kept);
    useBoardStore.getState().removeTag(removed);
    const state = useBoardStore.getState();

    expect(state.tags[removed]).toBeUndefined();
    expect(state.tags[kept]).toBeDefined();
    expect(state.cards[first]?.tagIds).toEqual([]);
    expect(state.cards[second]?.tagIds).toEqual([kept]);
    expect(state.cards[untagged]?.tagIds).toEqual([]);
    expect(Object.values(state.cards).every((card) => !card.tagIds.includes(removed))).toBe(true);
  });
});

describe('referências e persistência', () => {
  it('atualiza A preservando o mesmo objeto do cartão B', () => {
    const first = addCard(columnAt(0), 'A');
    const second = addCard(columnAt(0), 'B');
    const before = useBoardStore.getState();

    before.updateCard(first, { title: 'A atualizado', description: 'Detalhes' });
    const state = useBoardStore.getState();

    expect(state.cards[first]?.title).toBe('A atualizado');
    expect(state.cards[first]?.description).toBe('Detalhes');
    expect(state.cards[first]).not.toBe(before.cards[first]);
    expect(state.cards[second]).toBe(before.cards[second]);
  });

  it('persiste o título após addCard no localStorage', () => {
    addCard(columnAt(0), 'Cartão persistido');
    expect(localStorage.getItem('taskflow-board')).toContain('Cartão persistido');
  });

  it('reproduz columnOrder e cardOrder ao normalizar o estado desnormalizado', () => {
    const firstColumn = columnAt(0);
    const secondColumn = columnAt(1);
    const first = addCard(firstColumn, 'A');
    addCard(firstColumn, 'B');
    addCard(secondColumn, 'C');
    useBoardStore.getState().moveCard(first, secondColumn, 0);
    useBoardStore.getState().moveColumn(firstColumn, 2);
    const state = useBoardStore.getState();
    const restored = normalize(denormalize(state));

    expect(restored.columnOrder).toEqual(state.columnOrder);
    expect(restored.cardOrder).toEqual(state.cardOrder);
  });
});
