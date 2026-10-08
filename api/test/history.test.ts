import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ApiErrorSchema, CardHistorySchema, CardSchema, ColumnIdSchema, type UpsertCardInput } from "@taskflow/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { pool, query } from "../src/db.ts";

const app = createApp();

describe.skipIf(!process.env.DATABASE_URL)("Histórico com PostgreSQL real", () => {
  const boardId = randomUUID();
  const columnIds = [
    ColumnIdSchema.parse(randomUUID()),
    ColumnIdSchema.parse(randomUUID()),
    ColumnIdSchema.parse(randomUUID()),
  ] as const;
  const [columnA, columnB, columnC] = columnIds;
  const cardIds: string[] = [];
  let migration: string;

  beforeAll(async () => {
    migration = await readFile(new URL("../migrations/003_card_history.sql", import.meta.url), "utf8");
    await query(migration);
    await query(migration);
    await query("insert into boards (id, title) values ($1, 'Quadro de histórico')", [boardId]);
    for (const [index, id] of columnIds.entries()) {
      await query("insert into columns (id, board_id, title, position) values ($1, $2, $3, $4)",
        [id, boardId, ["A", "B", "C"][index], index]);
    }
  });

  afterAll(async () => {
    try {
      await query("delete from cards where id = any($1::uuid[])", [cardIds]);
      await query("delete from boards where id = $1", [boardId]);
    } finally {
      await pool.end();
    }
  });

  async function putCard(id: string, overrides: Partial<UpsertCardInput> = {}) {
    const response = await request(app).put(`/api/cards/${id}`).send({
      columnId: columnA, title: "Cartão de histórico", description: null,
      position: 1, tagIds: [], ...overrides,
    }).expect(200);
    return CardSchema.parse(response.body);
  }

  async function createCard(overrides: Partial<UpsertCardInput> = {}) {
    const id = randomUUID();
    cardIds.push(id);
    return putCard(id, overrides);
  }

  async function getHistory(id: string) {
    const response = await request(app).get(`/api/cards/${id}/history`).expect(200);
    return CardHistorySchema.parse(response.body);
  }

  it("registra criação, movimento e não registra alteração só de título ou repetição", async () => {
    const card = await createCard();
    const initial = await getHistory(card.id);
    expect(initial).toEqual([{
      id: expect.any(Number), cardId: card.id, type: "created",
      fromColumnId: null, fromColumnTitle: null, toColumnId: columnA,
      toColumnTitle: "A", occurredAt: card.createdAt,
    }]);
    const moved = await putCard(card.id, { columnId: columnB });
    const history = await getHistory(card.id);
    expect(history).toEqual([initial[0], {
      id: expect.any(Number), cardId: card.id, type: "moved",
      fromColumnId: columnA, fromColumnTitle: "A", toColumnId: columnB,
      toColumnTitle: "B", occurredAt: moved.updatedAt,
    }]);
    await putCard(card.id, { columnId: columnB, title: "Título alterado" });
    await putCard(card.id, { columnId: columnB, title: "Título alterado" });
    expect(await getHistory(card.id)).toEqual(history);
  });

  it("usa datas offline e ordena por data e por ID em caso de empate", async () => {
    const createdAt = "2026-08-04T09:00:00.000Z";
    const updatedAt = "2026-08-04T10:05:00.000Z";
    const card = await createCard({ createdAt });
    await putCard(card.id, { columnId: columnB, updatedAt });
    await putCard(card.id, { columnId: columnC, updatedAt });
    // Uma ação sincronizada depois pode ter ocorrido antes de outra já salva.
    await putCard(card.id, { updatedAt: "2026-08-04T10:00:00.000Z" });
    const history = await getHistory(card.id);
    expect(history.map((event) => event.occurredAt)).toEqual([
      createdAt, "2026-08-04T10:00:00.000Z", updatedAt, updatedAt,
    ]);
    expect(history.map((event) => event.toColumnTitle)).toEqual(["A", "A", "B", "C"]);
    expect(history[2]?.id).toBeLessThan(history[3]?.id ?? 0);
  });

  it("limita datas futuras ao agora do servidor e preserva createdAt no update", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const card = await createCard({ createdAt: future, updatedAt: future });
    expect(Date.parse(card.createdAt)).toBeLessThanOrEqual(Date.now());
    expect(Date.parse(card.updatedAt)).toBeLessThanOrEqual(Date.now());
    const moved = await putCard(card.id, {
      columnId: columnB, createdAt: "2020-01-01T00:00:00.000Z", updatedAt: future,
    });
    expect(moved.createdAt).toBe(card.createdAt);
    const history = await getHistory(card.id);
    expect(history).toHaveLength(2);
    expect(history[0]?.occurredAt).toBe(card.createdAt);
    expect(history[1]?.occurredAt).toBe(moved.updatedAt);
    expect(Date.parse(moved.updatedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("faz backfill uma única vez e preserva eventos existentes ao reaplicar a migration", async () => {
    const card = await createCard({ createdAt: "2026-08-01T08:00:00.000Z" });
    const otherCard = await createCard();
    await putCard(otherCard.id, { columnId: columnB });
    const existing = await getHistory(otherCard.id);
    // Simula um cartão legado, sem nenhum evento.
    await query("delete from card_events where card_id = $1", [card.id]);
    await query(migration);
    const backfilled = await getHistory(card.id);
    expect(backfilled).toEqual([{
      id: expect.any(Number), cardId: card.id, type: "created",
      fromColumnId: null, fromColumnTitle: null, toColumnId: columnA,
      toColumnTitle: "A", occurredAt: card.createdAt,
    }]);
    await query(migration);
    expect(await getHistory(card.id)).toEqual(backfilled);
    expect(await getHistory(otherCard.id)).toEqual(existing);
  });

  it("desfaz também o evento quando uma etiqueta inválida faz o PUT falhar", async () => {
    const card = await createCard();
    const history = await getHistory(card.id);
    await request(app).put(`/api/cards/${card.id}`).send({
      columnId: columnB, title: "Movimento desfeito", description: null,
      position: 2, tagIds: [randomUUID()],
    }).expect(409);
    expect(await getHistory(card.id)).toEqual(history);
    const result = await query<{ column_id: string }>("select column_id from cards where id = $1", [card.id]);
    expect(result.rows[0]?.column_id).toBe(columnA);
  });

  it("preserva títulos após renomear e excluir a coluna de origem", async () => {
    const sourceId = ColumnIdSchema.parse(randomUUID());
    await query("insert into columns (id, board_id, title, position) values ($1, $2, 'Origem', 4)",
      [sourceId, boardId]);
    const card = await createCard({ columnId: sourceId });
    await putCard(card.id, { columnId: columnB });
    const history = await getHistory(card.id);
    expect(history[0]?.toColumnTitle).toBe("Origem");
    expect(history[1]?.fromColumnTitle).toBe("Origem");
    await query("update columns set title = 'Origem renomeada' where id = $1", [sourceId]);
    expect(await getHistory(card.id)).toEqual(history);
    await query("delete from columns where id = $1", [sourceId]);
    expect(await getHistory(card.id)).toEqual(history);
  });

  it("retorna 404 para cartão inexistente e 400 para ID inválido", async () => {
    const missing = await request(app).get(`/api/cards/${randomUUID()}/history`).expect(404);
    expect(ApiErrorSchema.parse(missing.body)).toEqual({ error: "Cartão não encontrado" });
    const invalid = await request(app).get("/api/cards/nao-uuid/history").expect(400);
    expect(ApiErrorSchema.parse(invalid.body)).toEqual({ error: "ID inválido" });
  });

  it("exclui eventos em cascata ao excluir o cartão", async () => {
    const card = await createCard();
    await putCard(card.id, { columnId: columnB });
    expect(await getHistory(card.id)).toHaveLength(2);
    await request(app).delete(`/api/cards/${card.id}`).expect(204);
    const events = await query("select id from card_events where card_id = $1", [card.id]);
    expect(events.rows).toEqual([]);
    await request(app).get(`/api/cards/${card.id}/history`).expect(404);
  });
});
