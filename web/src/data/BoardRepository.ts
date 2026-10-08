import type { BoardSnapshot, Card, CardEvent, CardId, Column, ColumnId, Tag, TagId } from "@taskflow/shared";

/**
 * Contrato da camada de dados (docs/PLANEJAMENTO.md §6.2).
 *
 * O resto do app só conhece esta interface. Hoje a implementação é a
 * HttpBoardRepository (nossa API Express); para migrar para o Supabase basta
 * escrever uma SupabaseBoardRepository com os mesmos métodos.
 *
 * Todas as escritas são idempotentes: chamar duas vezes com o mesmo dado
 * produz o mesmo resultado.
 */
export interface BoardRepository {
  fetchBoard(): Promise<BoardSnapshot>;
  upsertColumn(column: Column): Promise<void>;
  deleteColumn(id: ColumnId): Promise<void>;
  upsertCard(card: Card): Promise<void>;
  deleteCard(id: CardId): Promise<void>;
  upsertTag(tag: Tag): Promise<void>;
  deleteTag(id: TagId): Promise<void>;
  /** Histórico de movimentação do cartão (criação e trocas de coluna), do mais antigo ao mais recente. */
  fetchCardHistory(id: CardId): Promise<CardEvent[]>;
}

/** Sem conexão com o servidor (offline, servidor fora do ar, DNS...). Vale tentar de novo. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Sem conexão com o servidor", { cause });
    this.name = "NetworkError";
  }
}

/** O servidor respondeu com erro HTTP. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** 4xx (exceto 409/408/429) não se resolve tentando de novo: o dado é inválido. */
  get isPermanent(): boolean {
    return this.status >= 400 && this.status < 500 && ![408, 409, 429].includes(this.status);
  }
}
