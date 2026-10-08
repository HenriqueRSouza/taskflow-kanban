// @vitest-environment jsdom
import { BoardSnapshotSchema, CardIdSchema, ColumnIdSchema } from '@taskflow/shared';
import type { BoardSnapshot, Card, CardId, Column, ColumnId, Tag, TagId } from '@taskflow/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBoard, denormalize, useBoardStore } from '../store/boardStore';
import { ApiError, NetworkError } from './BoardRepository';
import type { BoardRepository } from './BoardRepository';
import { createSyncEngine, useSyncStore } from './syncEngine';
import type { SyncEngine } from './syncEngine';

class MemoryBoardRepository implements BoardRepository {
  calls: string[] = [];
  snapshot: BoardSnapshot = BoardSnapshotSchema.parse({
    id: crypto.randomUUID(), title: 'Quadro remoto', ...denormalize(useBoardStore.getState()),
  });
  cardGate: Promise<void> | undefined;
  private failure: Error | undefined;

  failWith(error: Error | undefined): void {
    this.failure = error;
  }

  private record(call: string): void {
    this.calls.push(call);
    if (this.failure) throw this.failure;
  }

  async fetchBoard(): Promise<BoardSnapshot> {
    this.record('fetchBoard');
    return this.snapshot;
  }

  async upsertColumn(column: Column): Promise<void> {
    this.record(`upsertColumn:${column.id}`);
    this.snapshot.columns = [...this.snapshot.columns.filter((item) => item.id !== column.id), column];
  }

  async deleteColumn(id: ColumnId): Promise<void> {
    this.record(`deleteColumn:${id}`);
    this.snapshot.columns = this.snapshot.columns.filter((item) => item.id !== id);
  }

  async upsertCard(card: Card): Promise<void> {
    this.record(`upsertCard:${card.id}`);
    await this.cardGate;
    this.snapshot.cards = [...this.snapshot.cards.filter((item) => item.id !== card.id), card];
  }

  async deleteCard(id: CardId): Promise<void> {
    this.record(`deleteCard:${id}`);
    this.snapshot.cards = this.snapshot.cards.filter((item) => item.id !== id);
  }

  async upsertTag(tag: Tag): Promise<void> {
    this.record(`upsertTag:${tag.id}`);
    this.snapshot.tags = [...this.snapshot.tags.filter((item) => item.id !== tag.id), tag];
  }

  async deleteTag(id: TagId): Promise<void> {
    this.record(`deleteTag:${id}`);
    this.snapshot.tags = this.snapshot.tags.filter((item) => item.id !== id);
  }
}

let repo: MemoryBoardRepository;
let engine: SyncEngine;

function columnId(): ColumnId {
  return ColumnIdSchema.parse(useBoardStore.getState().columnOrder[0]);
}

function addCard(title = 'A'): CardId {
  return CardIdSchema.parse(useBoardStore.getState().addCard(columnId(), title));
}

function createEngine(): SyncEngine {
  return createSyncEngine(repo, useBoardStore, { debounceMs: 100, storage: localStorage });
}

function expectEmptyOutbox(): void {
  expect(useSyncStore.getState()).toMatchObject({ status: 'idle', pending: 0 });
  expect(localStorage.getItem('taskflow-outbox')).toBe('[]');
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useBoardStore.setState(createDefaultBoard());
  useSyncStore.setState({ status: 'idle', pending: 0, lastSyncedAt: null, lastError: null });
  repo = new MemoryBoardRepository();
  engine = createEngine();
  engine.start();
});

afterEach(() => {
  engine.stop();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createSyncEngine', () => {
  it('envia a edição somente depois de 100ms de debounce', async () => {
    const id = addCard();
    await vi.advanceTimersByTimeAsync(99);
    expect(repo.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    expect(repo.snapshot.cards[0]).toEqual(useBoardStore.getState().cards[id]);
    expectEmptyOutbox();
  });

  it('agrupa cinco edições e reinicia o debounce após a última', async () => {
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    repo.calls = [];
    for (let index = 0; index < 5; index += 1) {
      useBoardStore.getState().updateCard(id, { title: `Edição ${index}` });
      await vi.advanceTimersByTimeAsync(20);
    }
    await vi.advanceTimersByTimeAsync(79);
    expect(repo.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    expect(repo.snapshot.cards[0]?.title).toBe('Edição 4');
    expectEmptyOutbox();
  });

  it('envia a coluna antes do cartão criado nela no mesmo lote', async () => {
    const id = ColumnIdSchema.parse(useBoardStore.getState().addColumn('Revisão'));
    const cardId = CardIdSchema.parse(useBoardStore.getState().addCard(id, 'A'));
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`upsertColumn:${id}`, `upsertCard:${cardId}`]);
    expectEmptyOutbox();
  });

  it('remove os cartões antes da coluna', async () => {
    const id = columnId();
    const first = addCard();
    const second = addCard('B');
    await vi.advanceTimersByTimeAsync(100);
    repo.calls = [];
    useBoardStore.getState().removeColumn(id);
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`deleteCard:${first}`, `deleteCard:${second}`, `deleteColumn:${id}`]);
    expect(repo.snapshot.cards).toEqual([]);
    expectEmptyOutbox();
  });

  it('envia deleteCard quando um cartão é removido', async () => {
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    repo.calls = [];
    useBoardStore.getState().removeCard(id);
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`deleteCard:${id}`]);
    expectEmptyOutbox();
  });

  it('persiste a fila offline e envia no retry quando a rede volta', async () => {
    repo.failWith(new NetworkError(new Error('Sem rede')));
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    expect(useSyncStore.getState()).toMatchObject({ status: 'offline', pending: 1 });
    expect(localStorage.getItem('taskflow-outbox')).toBe(JSON.stringify([{ kind: 'card', id }]));
    repo.failWith(undefined);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    await vi.advanceTimersByTimeAsync(1);
    expect(repo.calls).toEqual([`upsertCard:${id}`, `upsertCard:${id}`]);
    expectEmptyOutbox();
  });

  it('um novo motor lê a fila persistida e envia ao iniciar', async () => {
    repo.failWith(new NetworkError(new Error('Sem rede')));
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    engine.stop();
    repo.failWith(undefined);
    repo.calls = [];
    engine = createEngine();
    expect(useSyncStore.getState().pending).toBe(1);
    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    expectEmptyOutbox();
  });

  it('descarta erro permanente 400 e segue para o próximo item', async () => {
    const first = addCard();
    const second = addCard('B');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const upsert = repo.upsertCard.bind(repo);
    vi.spyOn(repo, 'upsertCard').mockImplementation(async (card) => {
      if (card.id === first) {
        repo.failWith(new ApiError(400, 'Cartão inválido'));
        try {
          await upsert(card);
        } finally {
          repo.failWith(undefined);
        }
      } else await upsert(card);
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`upsertCard:${first}`, `upsertCard:${second}`]);
    expect(repo.snapshot.cards.map((card) => card.id)).toEqual([second]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(`Sincronização descartou card:${first}:`, 'Cartão inválido');
    expectEmptyOutbox();
  });

  it('409 reenvia a coluna e as etiquetas do cartão antes e tenta de novo', async () => {
    const upsertCard = repo.upsertCard.bind(repo);
    vi.spyOn(repo, 'upsertCard').mockRejectedValueOnce(new ApiError(409, 'Coluna ou etiqueta inexistente'))
      .mockImplementation(upsertCard);
    const id = addCard();
    const columnId = useBoardStore.getState().cards[id]?.columnId;
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(10); // reenvio imediato após reenfileirar
    expect(repo.calls).toEqual([`upsertColumn:${columnId}`, `upsertCard:${id}`]);
    expect(useSyncStore.getState().status).toBe('idle');
    expectEmptyOutbox();
  });

  it('409 persistente fica na fila com status error, sem laço infinito', async () => {
    vi.spyOn(repo, 'upsertCard').mockRejectedValue(new ApiError(409, 'Conflito'));
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(10);
    expect(useSyncStore.getState()).toMatchObject({ status: 'error', pending: 1, lastError: 'Conflito' });
    expect(localStorage.getItem('taskflow-outbox')).toBe(JSON.stringify([{ kind: 'card', id }]));
    expect(repo.calls.filter((call) => call.startsWith('upsertColumn'))).toHaveLength(1);
  });

  it('não aplica o quadro do servidor se o usuário editou durante o download', async () => {
    let release!: () => void;
    const fetchBoard = repo.fetchBoard.bind(repo);
    vi.spyOn(repo, 'fetchBoard').mockImplementation(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return fetchBoard();
    });
    const loading = engine.loadFromServer();
    await vi.advanceTimersByTimeAsync(0);
    const id = addCard();
    release();
    await loading;
    expect(useBoardStore.getState().cards[id]).toBeDefined();
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toContain(`upsertCard:${id}`);
    expect(repo.calls).not.toContain(`deleteCard:${id}`);
  });

  it('pause enfileira mudanças sem enviar e resume envia', async () => {
    engine.pause();
    const id = addCard();
    await vi.advanceTimersByTimeAsync(1_000);
    await engine.flush();
    expect(repo.calls).toEqual([]);
    expect(useSyncStore.getState().pending).toBe(1);
    engine.resume();
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    expectEmptyOutbox();
  });

  it('carrega o quadro remoto sem enfileirar upserts', async () => {
    repo.snapshot = BoardSnapshotSchema.parse({
      id: crypto.randomUUID(), title: 'Quadro remoto', ...denormalize(createDefaultBoard()),
    });
    const snapshot = repo.snapshot;
    await engine.loadFromServer();
    expect(denormalize(useBoardStore.getState())).toEqual({
      columns: snapshot.columns, cards: snapshot.cards, tags: snapshot.tags,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual(['fetchBoard']);
    expect(useSyncStore.getState()).toMatchObject({ status: 'idle', pending: 0 });
  });

  it('envia pendências antes de buscar o quadro remoto', async () => {
    const id = addCard();
    await engine.loadFromServer();
    expect(repo.calls).toEqual([`upsertCard:${id}`, 'fetchBoard']);
    expect(useBoardStore.getState().cards[id]?.title).toBe('A');
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toHaveLength(2);
    expectEmptyOutbox();
  });

  it('mantém o quadro local quando a busca está offline', async () => {
    const before = useBoardStore.getState();
    repo.failWith(new NetworkError(new Error('Sem rede')));
    await engine.loadFromServer();
    expect(repo.calls).toEqual(['fetchBoard']);
    expect(useBoardStore.getState()).toBe(before);
    expect(useSyncStore.getState()).toMatchObject({ status: 'offline', pending: 0 });
  });

  it('mantém pendências e não busca o quadro se o envio está offline', async () => {
    const id = addCard();
    const before = useBoardStore.getState();
    repo.failWith(new NetworkError(new Error('Sem rede')));
    await engine.loadFromServer();
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    expect(useBoardStore.getState()).toBe(before);
    expect(useSyncStore.getState()).toMatchObject({ status: 'offline', pending: 1 });
  });

  it('reenvia o cartão alterado enquanto o primeiro envio estava pendente', async () => {
    let release = () => {};
    repo.cardGate = new Promise<void>((resolve) => { release = resolve; });
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
    useBoardStore.getState().updateCard(id, { title: 'Alterado durante o envio' });
    // O debounce da edição vence enquanto o primeiro envio ainda está bloqueado.
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(useSyncStore.getState().pending).toBe(1);
    expect(localStorage.getItem('taskflow-outbox')).toBe(JSON.stringify([{ kind: 'card', id }]));
    await vi.advanceTimersByTimeAsync(100);
    expect(repo.calls).toEqual([`upsertCard:${id}`, `upsertCard:${id}`]);
    expect(repo.snapshot.cards[0]?.title).toBe('Alterado durante o envio');
    expectEmptyOutbox();
  });

  it('stop cancela o debounce e deixa de observar mudanças', async () => {
    addCard();
    engine.stop();
    addCard('Depois do stop');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(repo.calls).toEqual([]);
    expect(useSyncStore.getState().pending).toBe(1);
  });

  // Bug em syncEngine.ts:195-198 e 134: stop não impede um envio em andamento
  // de agendar outro debounce para a edição que chegou antes de parar o motor.
  it('stop impede novos envios quando há uma requisição em andamento', async () => {
    let release = () => {};
    repo.cardGate = new Promise<void>((resolve) => { release = resolve; });
    const id = addCard();
    await vi.advanceTimersByTimeAsync(100);
    useBoardStore.getState().updateCard(id, { title: 'Edição pendente' });
    engine.stop();
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(repo.calls).toEqual([`upsertCard:${id}`]);
  });
});
