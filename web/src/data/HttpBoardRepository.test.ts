// @vitest-environment jsdom
import { BoardSnapshotSchema, CardIdSchema, CardSchema, ColumnIdSchema } from '@taskflow/shared';
import { ZodError } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBoard, denormalize, useBoardStore } from '../store/boardStore';
import { ApiError, NetworkError } from './BoardRepository';
import { HttpBoardRepository } from './HttpBoardRepository';

const fetchMock = vi.fn<typeof fetch>();
let repo: HttpBoardRepository;

beforeEach(() => {
  localStorage.clear();
  useBoardStore.setState(createDefaultBoard());
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  repo = new HttpBoardRepository();
});

afterEach(() => vi.unstubAllGlobals());

describe('HttpBoardRepository', () => {
  it('busca e valida o quadro retornado pela API', async () => {
    const snapshot = BoardSnapshotSchema.parse({
      id: crypto.randomUUID(), title: 'Quadro', ...denormalize(useBoardStore.getState()),
    });
    fetchMock.mockResolvedValue(Response.json(snapshot));
    await expect(repo.fetchBoard()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/board', {
      method: 'GET', headers: undefined, body: undefined,
    });
  });

  it('rejeita resposta inválida com erro do Zod', async () => {
    fetchMock.mockResolvedValue(Response.json({ columns: 'inválido' }));
    await expect(repo.fetchBoard()).rejects.toBeInstanceOf(ZodError);
  });

  it('envia PUT do cartão sem id, createdAt e updatedAt no corpo', async () => {
    const columnId = ColumnIdSchema.parse(useBoardStore.getState().columnOrder[0]);
    const id = CardIdSchema.parse(useBoardStore.getState().addCard(columnId, 'A'));
    const card = CardSchema.parse(useBoardStore.getState().cards[id]);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await repo.upsertCard(card);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/cards/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columnId, title: card.title, description: card.description,
        tagIds: card.tagIds, position: card.position,
      }),
    });
  });

  it('converte rejeição do fetch em NetworkError com a causa original', async () => {
    const cause = new TypeError('Falha de rede');
    fetchMock.mockRejectedValue(cause);
    const request = repo.fetchBoard();
    await expect(request).rejects.toMatchObject({ name: 'NetworkError', cause });
    await expect(request).rejects.toBeInstanceOf(NetworkError);
  });

  it('converte HTTP 502 em NetworkError', async () => {
    fetchMock.mockResolvedValue(new Response('Servidor indisponível', { status: 502 }));
    await expect(repo.fetchBoard()).rejects.toBeInstanceOf(NetworkError);
  });

  it.each([
    { status: 400, permanent: true },
    { status: 409, permanent: false },
  ])('classifica HTTP $status e preserva a mensagem da API', async ({ status, permanent }) => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status }));
    const request = repo.fetchBoard();
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status, message: 'x', isPermanent: permanent });
  });

  it('resolve DELETE com HTTP 204 sem tentar ler JSON', async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);
    const id = CardIdSchema.parse(crypto.randomUUID());
    await expect(repo.deleteCard(id)).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/cards/${id}`, {
      method: 'DELETE', headers: undefined, body: undefined,
    });
  });
});
