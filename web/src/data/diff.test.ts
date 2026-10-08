// @vitest-environment jsdom
import { CardIdSchema, ColumnIdSchema } from '@taskflow/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultBoard, useBoardStore } from '../store/boardStore';
import { diffBoard } from './diff';

beforeEach(() => {
  localStorage.clear();
  useBoardStore.setState(createDefaultBoard());
});

function columnId() {
  return ColumnIdSchema.parse(useBoardStore.getState().columnOrder[0]);
}

function addCard(title: string) {
  return CardIdSchema.parse(useBoardStore.getState().addCard(columnId(), title));
}

describe('diffBoard', () => {
  it('não marca mudanças no mesmo objeto de estado', () => {
    const state = useBoardStore.getState();
    expect(diffBoard(state, state)).toEqual([]);
  });

  it('não marca mudanças em outro objeto de estado com as mesmas entidades', () => {
    addCard('A');
    const state = useBoardStore.getState();
    expect(diffBoard(state, {
      ...state,
      columns: { ...state.columns },
      cards: { ...state.cards },
      tags: { ...state.tags },
    })).toEqual([]);
  });

  it('marca somente o cartão adicionado', () => {
    const before = useBoardStore.getState();
    const id = addCard('A');
    expect(diffBoard(before, useBoardStore.getState())).toEqual([{ kind: 'card', id }]);
  });

  it('marca somente a coluna renomeada', () => {
    const id = columnId();
    const before = useBoardStore.getState();
    before.renameColumn(id, 'Revisão');
    expect(diffBoard(before, useBoardStore.getState())).toEqual([{ kind: 'column', id }]);
  });

  it('marca a coluna removida e seus dois cartões', () => {
    const id = columnId();
    const first = addCard('A');
    const second = addCard('B');
    const before = useBoardStore.getState();
    before.removeColumn(id);
    expect(diffBoard(before, useBoardStore.getState())).toEqual([
      { kind: 'column', id },
      { kind: 'card', id: first },
      { kind: 'card', id: second },
    ]);
  });

  it('atualizar A preserva a referência de B e não o marca', () => {
    const first = addCard('A');
    const second = addCard('B');
    const before = useBoardStore.getState();
    before.updateCard(first, { title: 'A atualizado' });
    const after = useBoardStore.getState();
    expect(after.cards[second]).toBe(before.cards[second]);
    expect(diffBoard(before, after)).toEqual([{ kind: 'card', id: first }]);
  });
});
