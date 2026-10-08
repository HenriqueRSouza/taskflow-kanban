import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BoardSnapshotSchema, CardSchema, ColumnSchema, TagSchema } from "@taskflow/shared";
import type { Card, CardId, Column, ColumnId, Tag, TagColor, TagId } from "@taskflow/shared";
import { newCardId, newColumnId, newTagId } from "../lib/ids.ts";
import { needsRebalance, positionAtIndex, rebalancedPositions } from "../lib/position.ts";

/*
 * Store global do quadro (docs/PLANEJAMENTO.md §4.2 e §6).
 *
 * Os dados ficam NORMALIZADOS: objetos indexados por ID + listas de IDs com a
 * ordem. Mover um cartão troca só duas listas de IDs; os objetos dos outros
 * cartões continuam com a mesma referência, então o React não os re-renderiza.
 */

export interface BoardData {
  columns: Record<ColumnId, Column>;
  cards: Record<CardId, Card>;
  tags: Record<TagId, Tag>;
  /** IDs das colunas na ordem de exibição. */
  columnOrder: ColumnId[];
  /** IDs dos cartões de cada coluna, na ordem de exibição. */
  cardOrder: Record<ColumnId, CardId[]>;
}

/** Formato "plano" (listas), igual ao da API — é o que vai para o localStorage. */
const StoredBoardSchema = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true });
type StoredBoard = { columns: Column[]; cards: Card[]; tags: Tag[] };

export interface BoardActions {
  /** Substitui todo o quadro (ex.: dados recebidos da API). */
  hydrate: (board: StoredBoard) => void;

  addColumn: (title: string) => ColumnId | null;
  renameColumn: (id: ColumnId, title: string) => void;
  removeColumn: (id: ColumnId) => void;
  moveColumn: (id: ColumnId, toIndex: number) => void;

  addCard: (columnId: ColumnId, title: string) => CardId | null;
  updateCard: (id: CardId, changes: Partial<Pick<Card, "title" | "description">>) => void;
  removeCard: (id: CardId) => void;
  /** Move o cartão para `toColumnId` (pode ser a mesma coluna) no índice `toIndex`. */
  moveCard: (id: CardId, toColumnId: ColumnId, toIndex: number) => void;

  createTag: (name: string, color: TagColor) => TagId | null;
  removeTag: (id: TagId) => void;
  toggleCardTag: (cardId: CardId, tagId: TagId) => void;
}

export type BoardStore = BoardData & BoardActions;

// ---------- funções puras auxiliares ----------

const now = () => new Date().toISOString();
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Converte as listas planas para o formato normalizado. */
export function normalize(board: StoredBoard): BoardData {
  const columns = [...board.columns].sort(byPosition);
  const cards = [...board.cards].sort(byPosition);

  const cardOrder = Object.fromEntries(columns.map((c) => [c.id, [] as CardId[]])) as Record<ColumnId, CardId[]>;
  for (const card of cards) cardOrder[card.columnId]?.push(card.id);

  return {
    columns: Object.fromEntries(columns.map((c) => [c.id, c])) as Record<ColumnId, Column>,
    cards: Object.fromEntries(
      cards.filter((card) => card.columnId in cardOrder).map((card) => [card.id, card]),
    ) as Record<CardId, Card>,
    tags: Object.fromEntries(board.tags.map((t) => [t.id, t])) as Record<TagId, Tag>,
    columnOrder: columns.map((c) => c.id),
    cardOrder,
  };
}

/** Converte o formato normalizado de volta para listas planas. */
export function denormalize(data: BoardData): StoredBoard {
  return {
    columns: data.columnOrder.flatMap((id) => data.columns[id] ?? []),
    cards: data.columnOrder.flatMap((colId) => (data.cardOrder[colId] ?? []).flatMap((id) => data.cards[id] ?? [])),
    tags: Object.values(data.tags),
  };
}

/** Quadro inicial quando não há nada salvo. */
export function createDefaultBoard(): BoardData {
  const titles = ["A Fazer", "Fazendo", "Feito"];
  const positions = rebalancedPositions(titles.length);
  const columns = titles.map((title, i): Column => ({ id: newColumnId(), title, position: positions[i] ?? 0 }));
  return normalize({ columns, cards: [], tags: [] });
}

/** Valida um título com as mesmas regras da API; devolve `null` se inválido. */
function cleanTitle(schema: typeof ColumnSchema.shape.title, raw: string): string | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Insere `id` na `order` no índice pedido e calcula a nova posição dele.
 * Se os vizinhos ficarem próximos demais, renumera a lista inteira.
 * Devolve a nova ordem e um mapa id → posição com tudo que mudou.
 */
function insertAt<Id extends string>(
  order: readonly Id[],
  id: Id,
  toIndex: number,
  positionOf: (id: Id) => number,
): { order: Id[]; positions: Map<Id, number> } {
  const others = order.filter((other) => other !== id);
  const index = Math.max(0, Math.min(toIndex, others.length));
  const nextOrder = [...others.slice(0, index), id, ...others.slice(index)];

  const position = positionAtIndex(others.map(positionOf), index);
  const positions = new Map<Id, number>([[id, position]]);

  const sorted = nextOrder.map((item) => positions.get(item) ?? positionOf(item));
  if (needsRebalance(sorted)) {
    const fresh = rebalancedPositions(nextOrder.length);
    nextOrder.forEach((item, i) => positions.set(item, fresh[i] ?? 0));
  }
  return { order: nextOrder, positions };
}

// ---------- store ----------

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      ...createDefaultBoard(),

      hydrate: (board) => set(normalize(board)),

      addColumn: (rawTitle) => {
        const title = cleanTitle(ColumnSchema.shape.title, rawTitle);
        if (!title) return null;
        const { columns, columnOrder } = get();
        const last = columnOrder.at(-1);
        const column: Column = {
          id: newColumnId(),
          title,
          position: positionAtIndex(last ? [columns[last]?.position ?? 0] : [], 1),
        };
        set((s) => ({
          columns: { ...s.columns, [column.id]: column },
          columnOrder: [...s.columnOrder, column.id],
          cardOrder: { ...s.cardOrder, [column.id]: [] },
        }));
        return column.id;
      },

      renameColumn: (id, rawTitle) => {
        const title = cleanTitle(ColumnSchema.shape.title, rawTitle);
        const column = get().columns[id];
        if (!title || !column || column.title === title) return;
        set((s) => ({ columns: { ...s.columns, [id]: { ...column, title } } }));
      },

      removeColumn: (id) =>
        set((s) => {
          const { [id]: _removed, ...columns } = s.columns;
          const { [id]: cardIds = [], ...cardOrder } = s.cardOrder;
          const cards = { ...s.cards };
          for (const cardId of cardIds) delete cards[cardId];
          return { columns, cardOrder, cards, columnOrder: s.columnOrder.filter((c) => c !== id) };
        }),

      moveColumn: (id, toIndex) =>
        set((s) => {
          if (!s.columns[id]) return s;
          const { order, positions } = insertAt(s.columnOrder, id, toIndex, (c) => s.columns[c]?.position ?? 0);
          const columns = { ...s.columns };
          for (const [colId, position] of positions) {
            const column = columns[colId];
            if (column) columns[colId] = { ...column, position };
          }
          return { columnOrder: order, columns };
        }),

      addCard: (columnId, rawTitle) => {
        const title = cleanTitle(CardSchema.shape.title, rawTitle);
        const { cards, cardOrder } = get();
        const ids = cardOrder[columnId];
        if (!title || !ids) return null;
        const timestamp = now();
        const card: Card = {
          id: newCardId(),
          columnId,
          title,
          description: null,
          tagIds: [],
          position: positionAtIndex(
            ids.map((cardId) => cards[cardId]?.position ?? 0),
            ids.length,
          ),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({
          cards: { ...s.cards, [card.id]: card },
          cardOrder: { ...s.cardOrder, [columnId]: [...ids, card.id] },
        }));
        return card.id;
      },

      updateCard: (id, changes) => {
        const card = get().cards[id];
        if (!card) return;
        const next: Card = { ...card, updatedAt: now() };
        if (changes.title !== undefined) {
          const title = cleanTitle(CardSchema.shape.title, changes.title);
          if (!title) return;
          next.title = title;
        }
        if (changes.description !== undefined) next.description = changes.description?.trim() || null;
        set((s) => ({ cards: { ...s.cards, [id]: next } }));
      },

      removeCard: (id) =>
        set((s) => {
          const card = s.cards[id];
          if (!card) return s;
          const { [id]: _removed, ...cards } = s.cards;
          const ids = s.cardOrder[card.columnId] ?? [];
          return { cards, cardOrder: { ...s.cardOrder, [card.columnId]: ids.filter((c) => c !== id) } };
        }),

      moveCard: (id, toColumnId, toIndex) =>
        set((s) => {
          const card = s.cards[id];
          const target = s.cardOrder[toColumnId];
          if (!card || !target) return s;

          const { order, positions } = insertAt(target, id, toIndex, (c) => s.cards[c]?.position ?? 0);
          const cards = { ...s.cards };
          const timestamp = now();
          for (const [cardId, position] of positions) {
            const current = cards[cardId];
            if (current) cards[cardId] = { ...current, position, updatedAt: timestamp };
          }
          cards[id] = { ...(cards[id] ?? card), columnId: toColumnId };

          const cardOrder: Record<ColumnId, CardId[]> = { ...s.cardOrder, [toColumnId]: order };
          if (card.columnId !== toColumnId) {
            cardOrder[card.columnId] = (s.cardOrder[card.columnId] ?? []).filter((c) => c !== id);
          }
          return { cards, cardOrder };
        }),

      createTag: (rawName, color) => {
        const name = cleanTitle(TagSchema.shape.name, rawName);
        if (!name) return null;
        const tag: Tag = { id: newTagId(), name, color };
        set((s) => ({ tags: { ...s.tags, [tag.id]: tag } }));
        return tag.id;
      },

      removeTag: (id) =>
        set((s) => {
          const { [id]: _removed, ...tags } = s.tags;
          const cards = { ...s.cards };
          for (const card of Object.values(s.cards)) {
            if (card.tagIds.includes(id)) cards[card.id] = { ...card, tagIds: card.tagIds.filter((t) => t !== id) };
          }
          return { tags, cards };
        }),

      toggleCardTag: (cardId, tagId) =>
        set((s) => {
          const card = s.cards[cardId];
          if (!card || !s.tags[tagId]) return s;
          const tagIds = card.tagIds.includes(tagId)
            ? card.tagIds.filter((t) => t !== tagId)
            : [...card.tagIds, tagId];
          return { cards: { ...s.cards, [cardId]: { ...card, tagIds, updatedAt: now() } } };
        }),
    }),
    {
      name: "taskflow-board",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Salva só os dados, em formato plano (as ações não são serializáveis).
      partialize: (state) => denormalize(state),
      // Dado vindo do localStorage é "externo": valida antes de usar. Se estiver
      // corrompido ou num formato antigo, mantém o quadro padrão.
      merge: (persisted, current) => {
        const result = StoredBoardSchema.safeParse(persisted);
        return result.success ? { ...current, ...normalize(result.data) } : current;
      },
    },
  ),
);

// ---------- seletores ----------
// Cada componente assina só o pedaço de que precisa: um Card re-renderiza
// apenas quando o PRÓPRIO cartão muda.

export const useColumnOrder = () => useBoardStore((s) => s.columnOrder);
export const useColumn = (id: ColumnId) => useBoardStore((s) => s.columns[id]);
export const useCardIds = (columnId: ColumnId) => useBoardStore((s) => s.cardOrder[columnId] ?? EMPTY_IDS);
export const useCard = (id: CardId) => useBoardStore((s) => s.cards[id]);
export const useTag = (id: TagId) => useBoardStore((s) => s.tags[id]);
export const useTags = () => useBoardStore((s) => s.tags);

const EMPTY_IDS: CardId[] = [];
