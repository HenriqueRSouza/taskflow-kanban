import { BoardSnapshotSchema } from "@taskflow/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardStore } from "../store/boardStore.ts";
import { TagPicker } from "./TagPicker.tsx";

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

describe("seletor de etiquetas", () => {
  it("informa quando não há etiquetas", () => {
    useBoardStore.getState().hydrate({ ...snapshot, tags: [] });
    render(<TagPicker cardId={card.id} />);
    expect(screen.getByText(/Nenhuma etiqueta ainda/)).toBeInTheDocument();
  });

  it("marca e desmarca a etiqueta no cartão", () => {
    render(<TagPicker cardId={card.id} />);
    const checkbox = screen.getByRole("checkbox", { name: "Urgente" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(useBoardStore.getState().cards[card.id]?.tagIds).toEqual([snapshot.tags[0]!.id]);
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(useBoardStore.getState().cards[card.id]?.tagIds).toEqual([]);
  });

  it("cria etiqueta vermelha já marcada e limpa o campo", () => {
    render(<TagPicker cardId={card.id} />);
    const input = screen.getByRole("textbox", { name: "Nome da nova etiqueta" });
    const submit = screen.getByRole("button", { name: "Criar" });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "Revisão" } });
    fireEvent.click(screen.getByRole("radio", { name: "Vermelho" }));
    expect(screen.getByRole("radio", { name: "Vermelho" })).toBeChecked();
    fireEvent.click(submit);
    const tag = Object.values(useBoardStore.getState().tags).find((item) => item.name === "Revisão");
    expect(tag).toMatchObject({ name: "Revisão", color: "red" });
    expect(useBoardStore.getState().cards[card.id]?.tagIds).toEqual([tag?.id]);
    expect(screen.getByRole("checkbox", { name: "Revisão" })).toBeChecked();
    expect(input).toHaveValue("");
    expect(submit).toBeDisabled();
  });

  it.each([true, false])("exclui etiqueta do quadro e do cartão apenas com confirmação %s", (accepted) => {
    const tag = snapshot.tags[0]!;
    useBoardStore.getState().hydrate({ ...snapshot, cards: [{ ...card, tagIds: [tag.id] }] });
    const before = useBoardStore.getState();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(accepted);
    render(<TagPicker cardId={card.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta Urgente" }));
    expect(confirm).toHaveBeenCalledWith('Excluir a etiqueta "Urgente" de todos os cartões?');
    if (accepted) {
      expect(useBoardStore.getState().tags[tag.id]).toBeUndefined();
      expect(useBoardStore.getState().cards[card.id]?.tagIds).toEqual([]);
      expect(screen.queryByRole("checkbox", { name: "Urgente" })).not.toBeInTheDocument();
    } else {
      expect(useBoardStore.getState()).toBe(before);
      expect(screen.getByRole("checkbox", { name: "Urgente" })).toBeChecked();
    }
  });

  it("não renderiza para cartão ausente", () => {
    useBoardStore.getState().hydrate({ ...snapshot, cards: [] });
    expect(render(<TagPicker cardId={card.id} />).container).toBeEmptyDOMElement();
  });
});
