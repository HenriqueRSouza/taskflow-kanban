import { BoardSnapshotSchema, CardHistorySchema } from "@taskflow/shared";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError, NetworkError } from "../data/BoardRepository.ts";
import { boardRepository } from "../data/sync.ts";
import { useBoardStore } from "../store/boardStore.ts";
import { CardHistory } from "./CardHistory.tsx";

const COL_A = "00000000-0000-4000-8000-00000000000a";
const COL_B = "00000000-0000-4000-8000-00000000000b";
const CARD = "00000000-0000-4000-8000-0000000000c1";

const board = BoardSnapshotSchema.pick({ columns: true, cards: true, tags: true }).parse({
  columns: [
    { id: COL_A, title: "Backlog", position: 1024 },
    { id: COL_B, title: "A Fazer", position: 2048 },
  ],
  cards: [{
    id: CARD, columnId: COL_A, title: "Tarefa", description: null, tagIds: [], position: 1024,
    createdAt: "2026-08-01T12:00:00Z", updatedAt: "2026-08-01T12:00:00Z",
  }],
  tags: [],
});

const history = CardHistorySchema.parse([
  { id: 1, cardId: CARD, type: "created", fromColumnId: null, fromColumnTitle: null, toColumnId: COL_A, toColumnTitle: "Backlog", occurredAt: "2026-08-01T12:00:00Z" },
  { id: 2, cardId: CARD, type: "moved", fromColumnId: COL_A, fromColumnTitle: "Backlog", toColumnId: COL_B, toColumnTitle: "A Fazer", occurredAt: "2026-08-03T12:00:00Z" },
]);

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().hydrate(board);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("mostra a criação e cada movimentação com data", async () => {
  vi.spyOn(boardRepository, "fetchCardHistory").mockResolvedValue(history);
  render(<CardHistory cardId={board.cards[0]!.id} />);
  expect(screen.getByText("Carregando histórico…")).toBeInTheDocument();
  expect(await screen.findByText(/Criado em/)).toHaveTextContent("Criado em Backlog");
  expect(screen.getByText(/Movido de/)).toHaveTextContent("Movido de Backlog para A Fazer");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getAllByRole("listitem")[1]!.querySelector("time")).toHaveAttribute("datetime", "2026-08-03T12:00:00Z");
});

it("busca de novo quando o cartão muda de coluna", async () => {
  const spy = vi.spyOn(boardRepository, "fetchCardHistory").mockResolvedValue(history);
  render(<CardHistory cardId={board.cards[0]!.id} />);
  await screen.findByText(/Criado em/);
  act(() => useBoardStore.getState().moveCard(board.cards[0]!.id, board.columns[1]!.id, 0));
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
});

it("explica quando o cartão ainda não chegou ao servidor", async () => {
  vi.spyOn(boardRepository, "fetchCardHistory").mockRejectedValue(new ApiError(404, "Cartão não encontrado"));
  render(<CardHistory cardId={board.cards[0]!.id} />);
  expect(await screen.findByText("O cartão ainda não foi salvo no servidor.")).toBeInTheDocument();
});

it("avisa quando está sem conexão", async () => {
  vi.spyOn(boardRepository, "fetchCardHistory").mockRejectedValue(new NetworkError(new Error("offline")));
  render(<CardHistory cardId={board.cards[0]!.id} />);
  expect(await screen.findByText("Histórico indisponível (sem conexão).")).toBeInTheDocument();
});
