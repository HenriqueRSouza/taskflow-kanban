import { BoardSnapshotSchema } from "@taskflow/shared";
import type { DragOverEvent } from "@dnd-kit/core";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncEngine } from "../data/sync.ts";
import { useBoardStore } from "../store/boardStore.ts";
import { useBoardDnd } from "./useBoardDnd.ts";

vi.mock("../data/sync.ts", () => ({ syncEngine: { pause: vi.fn(), resume: vi.fn() } }));

const snapshot = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true }).parse({
  columns: [
    { id: "00000000-0000-4000-8000-000000000001", title: "A Fazer", position: 1000 },
    { id: "00000000-0000-4000-8000-000000000002", title: "Fazendo", position: 2000 },
    { id: "00000000-0000-4000-8000-000000000003", title: "Feito", position: 3000 },
  ],
  tags: [],
  cards: [
    { id: "00000000-0000-4000-8000-000000000004", title: "A", columnId: "00000000-0000-4000-8000-000000000001", position: 1000 },
    { id: "00000000-0000-4000-8000-000000000005", title: "B", columnId: "00000000-0000-4000-8000-000000000001", position: 2000 },
    { id: "00000000-0000-4000-8000-000000000006", title: "C", columnId: "00000000-0000-4000-8000-000000000001", position: 3000 },
    { id: "00000000-0000-4000-8000-000000000007", title: "D", columnId: "00000000-0000-4000-8000-000000000002", position: 1000 },
    { id: "00000000-0000-4000-8000-000000000008", title: "E", columnId: "00000000-0000-4000-8000-000000000002", position: 2000 },
  ].map((card) => ({ ...card, description: null, tagIds: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" })),
});
const [source, target, empty] = snapshot.columns;
const [cardA, cardB, cardC, cardD, cardE] = snapshot.cards;
if (!source || !target || !empty || !cardA || !cardB || !cardC || !cardD || !cardE) {
  throw new Error("Dados de teste incompletos");
}
const sourceId = source.id;
const targetId = target.id;
const emptyId = empty.id;
const a = cardA.id;
const b = cardB.id;
const c = cardC.id;
const d = cardD.id;
const e = cardE.id;

// Um único construtor de eventos, com todos os campos exigidos pelo dnd-kit.
function dragEvent(
  id: string,
  data: Record<string, unknown>,
  overData: Record<string, unknown> | null = null,
  top = 110,
): DragOverEvent {
  const rect = { top: 100, height: 100, width: 200, left: 0, right: 200, bottom: 200 };
  return {
    activatorEvent: new Event("mousedown"),
    active: { id, data: { current: data }, rect: { current: { initial: rect, translated: { ...rect, top, bottom: top + rect.height } } } },
    over: overData ? { id: String(overData.id), data: { current: overData }, rect, disabled: false } : null,
    collisions: null,
    delta: { x: 0, y: 0 },
  };
}
const cardData = (id: string) => ({ type: "card", id });
const columnData = (id: string) => ({ type: "column", id });

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().hydrate(snapshot);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("arrastar e soltar no quadro", () => {
  it.each([
    { data: cardData(a), expected: { type: "card", id: a } },
    { data: columnData(sourceId), expected: { type: "column", id: sourceId } },
    { data: { type: "card", id: "inválido" }, expected: null },
    { data: { type: "outro", id: a }, expected: null },
  ])("inicia com os dados $data e pausa a sincronização", ({ data, expected }) => {
    const { result } = renderHook(useBoardDnd);
    act(() => result.current.contextProps.onDragStart(dragEvent(String(data.id), data)));
    expect(result.current.active).toEqual(expected);
    expect(syncEngine.pause).toHaveBeenCalledTimes(1);
    expect(syncEngine.resume).not.toHaveBeenCalled();
  });

  it.each([
    { top: 110, order: [a, d, e] },
    { top: 150, order: [a, d, e] },
    { top: 151, order: [d, a, e] },
  ])("insere em outra coluna conforme a metade do alvo (top $top)", ({ top, order }) => {
    const { result } = renderHook(useBoardDnd);
    act(() => result.current.contextProps.onDragOver(dragEvent(a, cardData(a), cardData(d), top)));
    const state = useBoardStore.getState();
    expect(state.cardOrder[targetId]).toEqual(order);
    expect(state.cardOrder[sourceId]).toEqual([b, c]);
    expect(state.cards[a]?.columnId).toBe(targetId);
  });

  it.each([
    { columnId: emptyId, order: [a] },
    { columnId: targetId, order: [d, e, a] },
  ])("soltar sobre a coluna $columnId insere no fim", ({ columnId, order }) => {
    const { result } = renderHook(useBoardDnd);
    act(() => result.current.contextProps.onDragOver(dragEvent(a, cardData(a), columnData(columnId))));
    expect(useBoardStore.getState().cardOrder[columnId]).toEqual(order);
    expect(useBoardStore.getState().cards[a]?.columnId).toBe(columnId);
  });

  it("passar sobre cartão da mesma coluna não altera o store", () => {
    const { result } = renderHook(useBoardDnd);
    const before = useBoardStore.getState();
    act(() => result.current.contextProps.onDragOver(dragEvent(a, cardData(a), cardData(c))));
    expect(useBoardStore.getState()).toBe(before);
  });

  it("ao finalizar A sobre C na mesma coluna reordena para B, C, A", () => {
    const { result } = renderHook(useBoardDnd);
    const event = dragEvent(a, cardData(a), cardData(c));
    act(() => result.current.contextProps.onDragStart(event));
    act(() => result.current.contextProps.onDragEnd(event));
    expect(useBoardStore.getState().cardOrder[sourceId]).toEqual([b, c, a]);
    expect(result.current.active).toBeNull();
    expect(syncEngine.pause).toHaveBeenCalledTimes(1);
    expect(syncEngine.resume).toHaveBeenCalledTimes(1);
  });

  it.each([columnData(targetId), cardData(d)])("move a coluna sobre alvo $type", (over) => {
    const { result } = renderHook(useBoardDnd);
    const moveColumn = vi.spyOn(useBoardStore.getState(), "moveColumn");
    act(() => result.current.contextProps.onDragEnd(dragEvent(sourceId, columnData(sourceId), over)));
    expect(moveColumn).toHaveBeenCalledWith(sourceId, 1);
    expect(useBoardStore.getState().columnOrder).toEqual([targetId, sourceId, emptyId]);
    expect(syncEngine.resume).toHaveBeenCalledTimes(1);
  });

  it("cancelar desfaz todas as trocas e restaura exatamente os cartões e a ordem", () => {
    const { result } = renderHook(useBoardDnd);
    const before = useBoardStore.getState();
    act(() => result.current.contextProps.onDragStart(dragEvent(a, cardData(a))));
    act(() => result.current.contextProps.onDragOver(dragEvent(a, cardData(a), cardData(d), 151)));
    act(() => result.current.contextProps.onDragOver(dragEvent(a, cardData(a), columnData(emptyId))));
    expect(useBoardStore.getState().cards[a]?.columnId).toBe(emptyId);
    act(() => result.current.contextProps.onDragCancel());
    const restored = useBoardStore.getState();
    expect(restored.cards).toEqual(before.cards);
    expect(restored.cardOrder).toEqual(before.cardOrder);
    expect(restored.cards).toBe(before.cards);
    expect(restored.cardOrder).toBe(before.cardOrder);
    expect(result.current.active).toBeNull();
    expect(syncEngine.pause).toHaveBeenCalledTimes(1);
    expect(syncEngine.resume).toHaveBeenCalledTimes(1);
  });

  it("finalizar descarta o snapshot e cancelar depois não desfaz a posição final", () => {
    const { result } = renderHook(useBoardDnd);
    const event = dragEvent(a, cardData(a), cardData(c));
    act(() => result.current.contextProps.onDragStart(event));
    act(() => result.current.contextProps.onDragEnd(event));
    const before = useBoardStore.getState();
    act(() => result.current.contextProps.onDragCancel());
    expect(useBoardStore.getState()).toBe(before);
  });

  it.each([
    dragEvent(a, cardData(a)),
    dragEvent(sourceId, columnData(sourceId), cardData(d)),
    dragEvent(a, cardData(a), { type: "inválido", id: d }),
    dragEvent(a, cardData(a), cardData("00000000-0000-4000-8000-000000000099")),
  ])("ignora alvo ausente ou inválido no drag over", (event) => {
    const { result } = renderHook(useBoardDnd);
    const before = useBoardStore.getState();
    act(() => result.current.contextProps.onDragOver(event));
    expect(useBoardStore.getState()).toBe(before);
  });

  it.each([
    dragEvent(a, cardData(a)),
    dragEvent(a, { type: "inválido", id: a }, cardData(c)),
    dragEvent(a, cardData(a), cardData(a)),
    dragEvent(a, cardData(a), columnData(targetId)),
    dragEvent(sourceId, columnData(sourceId), columnData(sourceId)),
    dragEvent(sourceId, columnData(sourceId), { type: "inválido", id: d }),
  ])("finaliza sem alterar o store quando não há destino válido", (event) => {
    const { result } = renderHook(useBoardDnd);
    const before = useBoardStore.getState();
    act(() => result.current.contextProps.onDragEnd(event));
    expect(useBoardStore.getState()).toBe(before);
    expect(result.current.active).toBeNull();
    expect(syncEngine.resume).toHaveBeenCalledTimes(1);
  });

  it("anuncia em português o início, alvo, fim e cancelamento", () => {
    const { result } = renderHook(useBoardDnd);
    const { announcements, screenReaderInstructions } = result.current.contextProps.accessibility;
    const event = dragEvent(a, cardData(a), columnData(targetId));
    expect(announcements.onDragStart(event)).toBe('cartão "A" selecionado.');
    expect(announcements.onDragOver(event)).toBe('cartão "A" sobre coluna "Fazendo".');
    expect(announcements.onDragEnd(event)).toBe('cartão "A" solto sobre coluna "Fazendo".');
    expect(announcements.onDragCancel(event)).toBe('Movimento de cartão "A" cancelado.');
    expect(announcements.onDragOver({ ...event, over: null })).toBe('cartão "A" fora de uma área válida.');
    expect(announcements.onDragEnd({ ...event, over: null })).toBe('cartão "A" solto.');
    expect(announcements.onDragStart(dragEvent(a, {}))).toBe("item selecionado.");
    expect(screenReaderInstructions.draggable).toContain("Esc para cancelar");
  });
});
