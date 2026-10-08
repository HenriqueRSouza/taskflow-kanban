import { create } from "zustand";
import { z } from "zod";
import type { BoardSnapshot } from "@taskflow/shared";
import type { BoardStore } from "../store/boardStore.ts";
import { ApiError, NetworkError } from "./BoardRepository.ts";
import type { BoardRepository } from "./BoardRepository.ts";
import { DirtySchema, diffBoard, dirtyKey } from "./diff.ts";
import type { Dirty } from "./diff.ts";

/*
 * Sincronização otimista e offline (docs/PLANEJAMENTO.md §6.2).
 *
 * 1. O usuário mexe no quadro → o store muda NA HORA (a tela não espera a rede).
 * 2. O motor compara o estado antigo com o novo (diffBoard) e põe o que mudou
 *    numa FILA, salva no localStorage (sobrevive a recarregar a página).
 * 3. Após uma pausa curta, a fila é enviada ao servidor, uma entidade por vez.
 * 4. Sem rede, a fila espera e o motor tenta de novo com intervalos crescentes
 *    (2s, 4s, 8s… até 60s) ou assim que o navegador voltar a ficar online.
 *
 * A fila guarda só "qual entidade mudou", não o conteúdo: na hora de enviar,
 * lê o estado ATUAL. Se um cartão foi editado 10 vezes offline, vai 1 requisição.
 */

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface SyncInfo {
  status: SyncStatus;
  /** Quantas entidades ainda não chegaram ao servidor. */
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/** Estado da sincronização, para a interface mostrar (indicador). */
export const useSyncStore = create<SyncInfo>(() => ({
  status: "idle",
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
}));

interface BoardStoreApi {
  getState: () => BoardStore;
  subscribe: (listener: (state: BoardStore, prev: BoardStore) => void) => () => void;
}

interface SyncEngineOptions {
  /** Espera após a última mudança antes de enviar (agrupa edições rápidas). */
  debounceMs?: number;
  storage?: Storage;
}

const OUTBOX_KEY = "taskflow-outbox";
const MAX_RETRY_MS = 60_000;

export function createSyncEngine(repo: BoardRepository, board: BoardStoreApi, options: SyncEngineOptions = {}) {
  const debounceMs = options.debounceMs ?? 400;
  const storage = options.storage ?? localStorage;

  // Fila: chave → { item, versão }. A versão sobe se a entidade mudar de novo
  // enquanto está sendo enviada; aí ela não sai da fila e é reenviada.
  const outbox = new Map<string, { item: Dirty; version: number }>(
    loadOutbox().map((item) => [dirtyKey(item), { item, version: 0 }]),
  );
  let version = 0;
  let running = false;
  let paused = false;
  let flushing = false;
  let suppressDiff = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 2_000;
  // Cartões cujas dependências (coluna/etiquetas) já foram reenfileiradas após um 409.
  const requeuedDeps = new Set<string>();
  let unsubscribe: (() => void) | null = null;

  updateInfo({ pending: outbox.size });

  // ---------- fila persistida ----------

  function loadOutbox(): Dirty[] {
    try {
      const parsed = z.array(DirtySchema).safeParse(JSON.parse(storage.getItem(OUTBOX_KEY) ?? "[]"));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  function saveOutbox() {
    try {
      storage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()].map(({ item }) => item)));
    } catch {
      // localStorage cheio ou bloqueado: a fila continua em memória.
    }
    updateInfo({ pending: outbox.size });
  }

  function enqueue(items: Dirty[]) {
    markDirty(items);
    schedule(debounceMs);
  }

  function markDirty(items: Dirty[]) {
    for (const item of items) outbox.set(dirtyKey(item), { item, version: ++version });
    saveOutbox();
  }

  // ---------- envio ----------

  function schedule(delay: number) {
    clearTimeout(timer);
    if (!running) return; // motor parado (stop): nada é agendado
    timer = setTimeout(() => void flush(), delay);
  }

  /** Envia a fila ao servidor. Pode ser chamado a qualquer momento (ex.: evento "online"). */
  async function flush(): Promise<void> {
    if (flushing || paused || outbox.size === 0) return;
    flushing = true;
    clearTimeout(timer);
    updateInfo({ status: "syncing" });

    let restart = false;
    try {
      for (const { item, version: sent } of ordered([...outbox.values()])) {
        if (await send(item) === "requeued") {
          restart = true; // dependências entraram na fila: recomeça na ordem certa
          break;
        }
        requeuedDeps.delete(dirtyKey(item));
        // Só sai da fila se não mudou de novo durante o envio.
        if (outbox.get(dirtyKey(item))?.version === sent) outbox.delete(dirtyKey(item));
        saveOutbox();
      }
      retryDelay = 2_000;
      updateInfo({ status: "idle", lastSyncedAt: new Date().toISOString(), lastError: null });
    } catch (error) {
      const offline = error instanceof NetworkError;
      updateInfo({ status: offline ? "offline" : "error", lastError: describeError(error) });
      schedule(retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    } finally {
      flushing = false;
    }

    if (restart) return schedule(0);
    // Mudanças que chegaram enquanto enviava.
    if (outbox.size > 0 && useSyncStore.getState().status === "idle") schedule(debounceMs);
  }

  /** Envia UMA entidade: se existe no estado atual → upsert; se não existe mais → delete. */
  async function send(item: Dirty): Promise<"sent" | "requeued"> {
    const state = board.getState();
    try {
      switch (item.kind) {
        case "column": {
          const column = state.columns[item.id];
          await (column ? repo.upsertColumn(column) : repo.deleteColumn(item.id));
          break;
        }
        case "card": {
          const card = state.cards[item.id];
          await (card ? repo.upsertCard(card) : repo.deleteCard(item.id));
          break;
        }
        case "tag": {
          const tag = state.tags[item.id];
          await (tag ? repo.upsertTag(tag) : repo.deleteTag(item.id));
          break;
        }
      }
      return "sent";
    } catch (error) {
      // 409 = o servidor não conhece a coluna ou uma etiqueta do cartão (ex.: o
      // quadro padrão foi criado offline e nunca enviado, ou outra aba apagou a
      // coluna). Reenfileira as dependências — que serão enviadas ANTES do cartão
      // — e tenta de novo. Só uma vez por cartão, para não entrar em laço.
      const card = item.kind === "card" ? state.cards[item.id] : undefined;
      if (error instanceof ApiError && error.status === 409 && card && !requeuedDeps.has(dirtyKey(item))) {
        requeuedDeps.add(dirtyKey(item));
        markDirty([
          { kind: "column", id: card.columnId },
          ...card.tagIds.map((id): Dirty => ({ kind: "tag", id })),
        ]);
        return "requeued";
      }
      // Dado inválido (400/404/422): tentar de novo não resolve. Descarta e segue.
      if (error instanceof ApiError && error.isPermanent) {
        console.warn(`Sincronização descartou ${dirtyKey(item)}:`, error.message);
        return "sent";
      }
      throw error;
    }
  }

  /**
   * Ordem segura para as chaves estrangeiras do banco:
   * colunas e etiquetas antes dos cartões que as usam; remoções por último,
   * cartões antes das colunas.
   */
  function ordered(entries: { item: Dirty; version: number }[]) {
    const state = board.getState();
    const exists = ({ kind, id }: Dirty) =>
      kind === "column" ? id in state.columns : kind === "card" ? id in state.cards : id in state.tags;
    const rank = (item: Dirty) => {
      if (exists(item)) return { column: 0, tag: 1, card: 2 }[item.kind];
      return { card: 3, tag: 4, column: 5 }[item.kind];
    };
    return [...entries].sort((a, b) => rank(a.item) - rank(b.item));
  }

  // ---------- ciclo de vida ----------

  /** Começa a observar o store. Devolve a função que para (ideal para o cleanup do useEffect). */
  function start(): () => void {
    unsubscribe?.();
    running = true;
    unsubscribe = board.subscribe((state, prev) => {
      if (suppressDiff) return;
      const changed = diffBoard(prev, state);
      if (changed.length > 0) enqueue(changed);
    });
    if (outbox.size > 0) schedule(0);
    return stop;
  }

  function stop() {
    running = false;
    unsubscribe?.();
    unsubscribe = null;
    clearTimeout(timer);
  }

  /**
   * Carga inicial: primeiro envia o que ficou pendente (ex.: editado offline),
   * depois baixa o quadro do servidor, que passa a ser a fonte da verdade.
   * Se o servidor não responder, o app segue com os dados do localStorage.
   */
  async function loadFromServer(): Promise<void> {
    await flush();
    if (outbox.size > 0) return; // não conseguiu enviar: mantém os dados locais
    updateInfo({ status: "syncing" });
    const versionBefore = version;
    try {
      const snapshot = await repo.fetchBoard();
      // O usuário mexeu no quadro enquanto o download acontecia: aplicar o
      // snapshot apagaria essa mudança. Mantém o local e deixa a fila enviar.
      const changedMeanwhile = version !== versionBefore || outbox.size > 0 || paused;
      if (!changedMeanwhile) applyServerBoard(snapshot);
      updateInfo({ status: "idle", lastSyncedAt: new Date().toISOString(), lastError: null });
    } catch (error) {
      updateInfo({ status: error instanceof NetworkError ? "offline" : "error", lastError: describeError(error) });
    }
  }

  /** Substitui o quadro pelo do servidor SEM gerar envios (não é mudança do usuário). */
  function applyServerBoard(snapshot: BoardSnapshot) {
    suppressDiff = true;
    try {
      board.getState().hydrate(snapshot);
    } finally {
      suppressDiff = false;
    }
  }

  /** Pausa os envios (ex.: durante um arrasto); as mudanças continuam sendo enfileiradas. */
  function pause() {
    paused = true;
    clearTimeout(timer);
  }

  function resume() {
    paused = false;
    if (outbox.size > 0) schedule(debounceMs);
  }

  return { start, stop, flush, loadFromServer, pause, resume };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

function updateInfo(partial: Partial<SyncInfo>) {
  useSyncStore.setState(partial);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido";
}
