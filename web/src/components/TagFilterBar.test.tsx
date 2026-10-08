import { BoardSnapshotSchema } from "@taskflow/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardStore } from "../store/boardStore.ts";
import { useFilterStore } from "../store/filterStore.ts";
import { Board } from "./Board.tsx";
import { TagFilterBar } from "./TagFilterBar.tsx";

// Detalhes do cartão são independentes do filtro e estão em edição paralela.

const columnId = "00000000-0000-4000-8000-000000000001";
const urgentId = "00000000-0000-4000-8000-000000000002";
const reviewId = "00000000-0000-4000-8000-000000000003";
const snapshot = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true }).parse({
  columns: [{ id: columnId, title: "A Fazer", position: 1000 }],
  tags: [
    { id: urgentId, name: "Urgente", color: "red" },
    { id: reviewId, name: "Revisão", color: "blue" },
  ],
  cards: [
    { id: "00000000-0000-4000-8000-000000000004", title: "Cartão urgente", tagIds: [urgentId] },
    { id: "00000000-0000-4000-8000-000000000005", title: "Cartão para revisão", tagIds: [reviewId] },
    { id: "00000000-0000-4000-8000-000000000006", title: "Cartão sem etiqueta", tagIds: [] },
  ].map((card, index) => ({
    ...card,
    columnId,
    description: null,
    position: (index + 1) * 1000,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  })),
});

function visibleCardButtons() {
  return screen.queryAllByRole("button", { name: /^(Cartão urgente|Cartão para revisão|Cartão sem etiqueta)$/ });
}

function filterButton(name: string) {
  return within(screen.getByRole("group", { name: "Filtrar cartões por etiqueta" }))
    .getByRole("button", { name });
}

beforeEach(() => {
  localStorage.clear();
  useFilterStore.getState().clear();
  useBoardStore.getState().hydrate(snapshot);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("barra de filtro no quadro", () => {
  it("não renderiza nada quando não há etiquetas", () => {
    useBoardStore.getState().hydrate({ ...snapshot, tags: [] });
    const { container } = render(<TagFilterBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("filtra um de três cartões, informa o contador e limpar volta a mostrar tudo", () => {
    render(<Board />);
    expect(visibleCardButtons()).toHaveLength(3);
    expect(filterButton("Urgente")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument();

    fireEvent.click(filterButton("Urgente"));
    expect(filterButton("Urgente")).toHaveAttribute("aria-pressed", "true");
    expect(filterButton("Urgente")).toHaveClass("ring-2", "ring-ink", "ring-offset-1");
    expect(visibleCardButtons()).toHaveLength(1);
    expect(screen.getByText("Cartão urgente")).toBeInTheDocument();
    expect(screen.queryByText("Cartão para revisão")).not.toBeInTheDocument();
    expect(screen.queryByText("Cartão sem etiqueta")).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 de 3 cartões visíveis")).toHaveTextContent("1/3");

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(visibleCardButtons()).toHaveLength(3);
    expect(screen.getByText("3", { selector: "span" })).toBeInTheDocument();
    expect(filterButton("Urgente")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument();
  });

  it("combina seleções com OU e desliga cada etiqueta independentemente", () => {
    render(<Board />);
    fireEvent.click(filterButton("Urgente"));
    fireEvent.click(filterButton("Revisão"));
    expect(visibleCardButtons()).toHaveLength(2);
    expect(screen.getByLabelText("2 de 3 cartões visíveis")).toHaveTextContent("2/3");
    fireEvent.click(filterButton("Urgente"));
    expect(visibleCardButtons()).toHaveLength(1);
    expect(screen.getByText("Cartão para revisão")).toBeInTheDocument();
    fireEvent.click(filterButton("Revisão"));
    expect(visibleCardButtons()).toHaveLength(3);
  });

  it("mostra o estado vazio e confirma a exclusão com o total, mesmo sem cartões visíveis", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    useBoardStore.getState().hydrate({
      ...snapshot,
      cards: snapshot.cards.map((card) => ({ ...card, tagIds: [] })),
    });
    render(<Board />);
    fireEvent.click(filterButton("Urgente"));
    expect(visibleCardButtons()).toHaveLength(0);
    expect(screen.getByLabelText("0 de 3 cartões visíveis")).toHaveTextContent("0/3");
    expect(screen.getByText("Nenhum cartão com essa etiqueta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir coluna A Fazer" }));
    expect(confirm).toHaveBeenCalledWith('Excluir a coluna "A Fazer" e seus 3 cartões?');
    expect(useBoardStore.getState().columnOrder).toHaveLength(1);
  });

  it("ignora etiquetas removidas e restaura tudo quando nenhuma seleção válida resta", () => {
    render(<Board />);
    fireEvent.click(filterButton("Urgente"));
    fireEvent.click(filterButton("Revisão"));
    const urgent = snapshot.tags[0]!;
    const review = snapshot.tags[1]!;
    act(() => useBoardStore.getState().removeTag(urgent.id));
    expect(visibleCardButtons()).toHaveLength(1);
    expect(screen.getByText("Cartão para revisão")).toBeInTheDocument();
    expect(screen.getByLabelText("1 de 3 cartões visíveis")).toBeInTheDocument();
    act(() => useBoardStore.getState().removeTag(review.id));
    expect(visibleCardButtons()).toHaveLength(3);
    expect(screen.queryByRole("group", { name: "Filtrar cartões por etiqueta" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cartões visíveis/)).not.toBeInTheDocument();
  });

  it("atualiza os visíveis quando uma etiqueta é adicionada ou retirada de um cartão", () => {
    render(<Board />);
    fireEvent.click(filterButton("Urgente"));
    const card = snapshot.cards[2]!;
    const tag = snapshot.tags[0]!;
    act(() => useBoardStore.getState().toggleCardTag(card.id, tag.id));
    expect(visibleCardButtons()).toHaveLength(2);
    expect(screen.getByText("Cartão sem etiqueta")).toBeInTheDocument();
    act(() => useBoardStore.getState().toggleCardTag(card.id, tag.id));
    expect(visibleCardButtons()).toHaveLength(1);
  });

  it("mantém a ordem completa ao mover um cartão com o filtro ativo", () => {
    render(<Board />);
    fireEvent.click(filterButton("Urgente"));
    const card = snapshot.cards[0]!;
    act(() => useBoardStore.getState().moveCard(card.id, card.columnId, 2));
    expect(useBoardStore.getState().cardOrder[card.columnId]).toEqual([
      snapshot.cards[1]!.id, snapshot.cards[2]!.id, card.id,
    ]);
    expect(visibleCardButtons()).toHaveLength(1);
    expect(screen.getByLabelText("1 de 3 cartões visíveis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(visibleCardButtons().map((button) => button.textContent)).toEqual(["Cartão para revisão", "Cartão sem etiqueta", "Cartão urgente"]);
  });
});
