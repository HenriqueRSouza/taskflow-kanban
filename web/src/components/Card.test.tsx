import { BoardSnapshotSchema } from "@taskflow/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardStore } from "../store/boardStore.ts";
import { useFilterStore } from "../store/filterStore.ts";
import { useCardDetailsStore } from "../store/uiStore.ts";
import { Board } from "./Board.tsx";
import { Card } from "./Card.tsx";

const snapshot = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true }).parse({
  columns: [{ id: "00000000-0000-4000-8000-000000000001", title: "A Fazer", position: 1000 }],
  tags: [{ id: "00000000-0000-4000-8000-000000000002", name: "Urgente", color: "yellow" }],
  cards: [{
    id: "00000000-0000-4000-8000-000000000003",
    columnId: "00000000-0000-4000-8000-000000000001",
    title: "Estudar React", description: "Revisar os hooks", tagIds: [], position: 1000,
    createdAt: "2026-01-02T12:00:00Z", updatedAt: "2026-02-03T15:30:00Z",
  }],
});
const card = snapshot.cards[0]!;
const tagId = snapshot.tags[0]!.id;

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().hydrate(snapshot);
  useFilterStore.getState().clear();
  useCardDetailsStore.getState().closeCard();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("cartão", () => {
  it("abre os detalhes num portal no body e permite fechar", () => {
    const { container } = render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: `Abrir detalhes do cartão ${card.title}` }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(container).not.toContainElement(dialog);
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o painel continua aberto quando o filtro esconde o cartão", () => {
    act(() => useBoardStore.getState().toggleCardTag(card.id, tagId));
    act(() => useFilterStore.getState().toggleTag(tagId));
    render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: `Abrir detalhes do cartão ${card.title}` }));
    // desmarca a etiqueta filtrada: o cartão sai da coluna, mas o painel fica
    fireEvent.click(screen.getByRole("checkbox", { name: "Urgente" }));
    expect(screen.queryByRole("button", { name: card.title })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
  });

  it("mostra o ícone apenas quando existe descrição", () => {
    render(<Card id={card.id} />);
    expect(screen.getByRole("img", { name: "Tem descrição" })).toBeInTheDocument();
    act(() => useBoardStore.getState().updateCard(card.id, { description: null }));
    expect(screen.queryByRole("img", { name: "Tem descrição" })).not.toBeInTheDocument();
  });

  it("exclui o cartão", () => {
    render(<Card id={card.id} />);
    fireEvent.click(screen.getByRole("button", { name: `Excluir cartão ${card.title}` }));
    expect(useBoardStore.getState().cards[card.id]).toBeUndefined();
    expect(useBoardStore.getState().cardOrder[card.columnId]).toEqual([]);
    expect(screen.queryByRole("button", { name: card.title })).not.toBeInTheDocument();
  });
});
