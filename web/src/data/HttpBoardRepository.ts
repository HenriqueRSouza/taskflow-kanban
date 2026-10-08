import { ApiErrorSchema, BoardSnapshotSchema } from "@taskflow/shared";
import type { BoardSnapshot, Card, CardId, Column, ColumnId, Tag, TagId } from "@taskflow/shared";
import { ApiError, NetworkError } from "./BoardRepository.ts";
import type { BoardRepository } from "./BoardRepository.ts";

/** Implementação do repositório que conversa com a nossa API REST. */
export class HttpBoardRepository implements BoardRepository {
  private readonly baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  async fetchBoard(): Promise<BoardSnapshot> {
    // Resposta da API é dado externo: valida antes de entregar ao app.
    return BoardSnapshotSchema.parse(await this.request("GET", "/board"));
  }

  async upsertColumn({ id, title, position }: Column): Promise<void> {
    await this.request("PUT", `/columns/${id}`, { title, position });
  }

  async deleteColumn(id: ColumnId): Promise<void> {
    await this.request("DELETE", `/columns/${id}`);
  }

  async upsertCard({ id, columnId, title, description, tagIds, position }: Card): Promise<void> {
    await this.request("PUT", `/cards/${id}`, { columnId, title, description, tagIds, position });
  }

  async deleteCard(id: CardId): Promise<void> {
    await this.request("DELETE", `/cards/${id}`);
  }

  async upsertTag({ id, name, color }: Tag): Promise<void> {
    await this.request("PUT", `/tags/${id}`, { name, color });
  }

  async deleteTag(id: TagId): Promise<void> {
    await this.request("DELETE", `/tags/${id}`);
  }

  private async request(method: "GET" | "PUT" | "DELETE", path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      // fetch só rejeita quando nem chegou a ter resposta: rede.
      throw new NetworkError(cause);
    }

    if (response.status === 204) return null;
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // Proxy do Vite responde 502/504 quando a API está fora do ar: trata como rede.
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new NetworkError(new Error(`HTTP ${response.status}`));
      }
      const parsed = ApiErrorSchema.safeParse(data);
      throw new ApiError(response.status, parsed.success ? parsed.data.error : `HTTP ${response.status}`);
    }
    return data;
  }
}
