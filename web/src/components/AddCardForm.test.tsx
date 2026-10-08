import { BoardSnapshotSchema } from "@taskflow/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardStore } from "../store/boardStore.ts";
import { AddCardForm } from "./AddCardForm.tsx";

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

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().hydrate(snapshot);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("formulário de cartão", () => {
  it.each(["Escape", "Cancelar"])("fecha e limpa com %s", (method) => {
    render(<AddCardForm columnId={card.columnId} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar cartão" }));
    const input = screen.getByLabelText("Título do novo cartão");
    fireEvent.change(input, { target: { value: "Rascunho" } });
    if (method === "Escape") fireEvent.keyDown(input, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Título do novo cartão")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar cartão" }));
    expect(screen.getByLabelText("Título do novo cartão")).toHaveValue("");
    expect(Object.keys(useBoardStore.getState().cards)).toHaveLength(1);
  });

  it("não cria título vazio ou só com espaços mesmo ao submeter o formulário", () => {
    render(<AddCardForm columnId={card.columnId} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar cartão" }));
    const input = screen.getByLabelText("Título do novo cartão");
    for (const value of ["", "   "]) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
      fireEvent.submit(input.closest("form")!);
      expect(Object.keys(useBoardStore.getState().cards)).toHaveLength(1);
    }
  });

  it("cria na coluna, limpa o campo e mantém aberto para outro cartão", () => {
    render(<AddCardForm columnId={card.columnId} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar cartão" }));
    for (const title of ["Primeiro", "Segundo"]) {
      fireEvent.change(screen.getByLabelText("Título do novo cartão"), { target: { value: title } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
      expect(screen.getByLabelText("Título do novo cartão")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    }
    const state = useBoardStore.getState();
    expect(state.cardOrder[card.columnId]?.map((id) => state.cards[id]?.title)).toEqual([card.title, "Primeiro", "Segundo"]);
    expect(Object.values(state.cards).every((item) => item.columnId === card.columnId)).toBe(true);
  });
});
