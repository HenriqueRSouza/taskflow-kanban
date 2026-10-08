import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  BoardSnapshotSchema,
  CardSchema,
  CardIdSchema,
  ColumnIdSchema,
  ColumnSchema,
  TagIdSchema,
  TagSchema,
} from "@taskflow/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { BOARD_ID } from "../src/board-id.ts";
import { pool, query } from "../src/db.ts";
import { HttpError, mapPostgresError, parseId } from "../src/http.ts";

const app = createApp();

describe.skipIf(!process.env.DATABASE_URL)("Validação HTTP das rotas de escrita", () => {
  for (const resource of ["columns", "cards", "tags"]) {
    it(`PUT e DELETE /api/${resource} rejeitam IDs inválidos`, async () => {
      for (const method of ["put", "delete"] as const) {
        const response = await request(app)[method](`/api/${resource}/nao-uuid`).expect(400);
        expect(ApiErrorSchema.parse(response.body)).toEqual({ error: "ID inválido" });
      }
    });

    it(`PUT /api/${resource} rejeita um corpo inválido`, async () => {
      const response = await request(app)
        .put(`/api/${resource}/${randomUUID()}`)
        .send({ title: "", name: "", color: "green", columnId: randomUUID(), description: null, tagIds: [], position: 0 })
        .expect(400);
      expect(ApiErrorSchema.parse(response.body)).toEqual({ error: "Título obrigatório" });
    });
  }
});

describe("Helpers das rotas de escrita", () => {
  it("valida os IDs com os schemas compartilhados", () => {
    const id = randomUUID();
    expect(parseId(ColumnIdSchema, id)).toBe(id);
    expect(parseId(CardIdSchema, id)).toBe(id);
    expect(parseId(TagIdSchema, id)).toBe(id);
    for (const parse of [
      () => parseId(ColumnIdSchema, "nao-uuid"),
      () => parseId(CardIdSchema, "nao-uuid"),
      () => parseId(TagIdSchema, "nao-uuid"),
    ]) {
      expect(parse).toThrow("ID inválido");
      try {
        parse();
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpError);
        if (error instanceof HttpError) expect(error.status).toBe(400);
      }
    }
  });

  it("mapeia violações de chave estrangeira e de check", () => {
    const foreignKeyError = mapPostgresError({ code: "23503" });
    expect(foreignKeyError).toBeInstanceOf(HttpError);
    if (foreignKeyError instanceof HttpError) {
      expect(foreignKeyError.status).toBe(409);
      expect(foreignKeyError.message).toBe("Coluna ou etiqueta inexistente");
    }
    const checkError = mapPostgresError({ code: "23514" });
    expect(checkError).toBeInstanceOf(HttpError);
    if (checkError instanceof HttpError) expect(checkError.status).toBe(400);
    const otherError = new Error("Falha inesperada");
    expect(mapPostgresError(otherError)).toBe(otherError);
    expect(mapPostgresError(null)).toBeNull();
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Escrita com PostgreSQL real", () => {
  const columnIds: string[] = [];
  const cardIds: string[] = [];
  const tagIds: string[] = [];

  function allocateId(ids: string[]) {
    const id = randomUUID();
    ids.push(id);
    return id;
  }

  async function createColumn() {
    const id = allocateId(columnIds);
    const response = await request(app).put(`/api/columns/${id}`)
      .send({ title: "Coluna de teste", position: 100 }).expect(200);
    return ColumnSchema.parse(response.body);
  }

  async function createTag() {
    const id = allocateId(tagIds);
    const response = await request(app).put(`/api/tags/${id}`)
      .send({ name: "Etiqueta de teste", color: "green" }).expect(200);
    return TagSchema.parse(response.body);
  }

  async function createCard(columnId: string, tags: string[] = []) {
    const id = allocateId(cardIds);
    const response = await request(app).put(`/api/cards/${id}`)
      .send({ columnId, title: "Cartão de teste", description: null, position: 1, tagIds: tags })
      .expect(200);
    return CardSchema.parse(response.body);
  }

  async function getBoard() {
    const response = await request(app).get("/api/board").expect(200);
    return BoardSnapshotSchema.parse(response.body);
  }

  afterAll(async () => {
    try {
      await query("delete from cards where id = any($1::uuid[])", [cardIds]);
      await query("delete from columns where id = any($1::uuid[])", [columnIds]);
      await query("delete from tags where id = any($1::uuid[])", [tagIds]);
    } finally {
      await pool.end();
    }
  });

  it("PUT coluna cria, repete sem duplicar e atualiza o título", async () => {
    const column = await createColumn();
    const body = { title: column.title, position: column.position };
    const repeated = await request(app).put(`/api/columns/${column.id}`).send(body).expect(200);
    expect(ColumnSchema.parse(repeated.body)).toEqual(column);
    const count = await query<{ count: number; board_id: string }>(
      "select count(*)::int as count, board_id from columns where id = $1 group by board_id",
      [column.id],
    );
    expect(count.rows).toEqual([{ count: 1, board_id: BOARD_ID }]);
    const updated = await request(app).put(`/api/columns/${column.id}`)
      .send({ ...body, title: "Título alterado" }).expect(200);
    expect(ColumnSchema.parse(updated.body)).toEqual({ ...column, title: "Título alterado" });
  });

  it("PUT tag cria, repete sem duplicar e atualiza nome e cor", async () => {
    const tag = await createTag();
    const body = { name: tag.name, color: tag.color };
    const repeated = await request(app).put(`/api/tags/${tag.id}`).send(body).expect(200);
    expect(TagSchema.parse(repeated.body)).toEqual(tag);
    const count = await query<{ count: number; board_id: string }>(
      "select count(*)::int as count, board_id from tags where id = $1 group by board_id",
      [tag.id],
    );
    expect(count.rows).toEqual([{ count: 1, board_id: BOARD_ID }]);
    const updated = await request(app).put(`/api/tags/${tag.id}`)
      .send({ name: "Etiqueta alterada", color: "blue" }).expect(200);
    expect(TagSchema.parse(updated.body)).toEqual({ ...tag, name: "Etiqueta alterada", color: "blue" });
  });

  it("PUT cartão salva etiquetas, repete sem duplicar e remove associações", async () => {
    const column = await createColumn();
    const tag = await createTag();
    const card = await createCard(column.id, [tag.id, tag.id]);
    expect(card.tagIds).toEqual([tag.id]);
    expect((await getBoard()).cards.find((item) => item.id === card.id)).toEqual(card);
    const { createdAt, updatedAt, id, ...body } = card;
    const repeated = await request(app).put(`/api/cards/${id}`).send(body).expect(200);
    const repeatedCard = CardSchema.parse(repeated.body);
    expect(repeatedCard).toEqual({ ...card, updatedAt: repeatedCard.updatedAt });
    expect(repeatedCard.createdAt).toBe(createdAt);
    expect(new Date(repeatedCard.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(updatedAt).getTime());
    const count = await query<{ count: number }>("select count(*)::int as count from cards where id = $1", [id]);
    expect(count.rows).toEqual([{ count: 1 }]);
    const cleared = await request(app).put(`/api/cards/${id}`)
      .send({ ...body, tagIds: [] }).expect(200);
    expect(CardSchema.parse(cleared.body).tagIds).toEqual([]);
    expect((await getBoard()).cards.find((item) => item.id === id)?.tagIds).toEqual([]);
  });

  it("PUT cartão move para outra coluna e atualiza os campos", async () => {
    const first = await createColumn();
    const second = await createColumn();
    const card = await createCard(first.id);
    const body = { columnId: second.id, title: "Cartão movido", description: "Descrição alterada", position: 5, tagIds: [] };
    const response = await request(app).put(`/api/cards/${card.id}`).send(body).expect(200);
    expect(CardSchema.parse(response.body)).toMatchObject({ id: card.id, ...body });
    expect((await getBoard()).cards.find((item) => item.id === card.id)).toMatchObject(body);
  });

  it("PUT cartão com coluna inexistente retorna 409 sem criar o cartão", async () => {
    const id = allocateId(cardIds);
    const response = await request(app).put(`/api/cards/${id}`)
      .send({ columnId: randomUUID(), title: "Cartão", description: null, position: 0, tagIds: [] })
      .expect(409);
    expect(ApiErrorSchema.parse(response.body)).toEqual({ error: "Coluna ou etiqueta inexistente" });
    expect((await getBoard()).cards.some((card) => card.id === id)).toBe(false);
  });

  it("PUT cartão com etiqueta inexistente desfaz os campos e associações", async () => {
    const column = await createColumn();
    const tag = await createTag();
    const card = await createCard(column.id, [tag.id]);
    const response = await request(app).put(`/api/cards/${card.id}`)
      .send({ columnId: column.id, title: "Alteração desfeita", description: null, position: 9, tagIds: [randomUUID()] })
      .expect(409);
    expect(ApiErrorSchema.parse(response.body)).toEqual({ error: "Coluna ou etiqueta inexistente" });
    expect((await getBoard()).cards.find((item) => item.id === card.id)).toEqual(card);
  });

  it("DELETE cartão é idempotente", async () => {
    const column = await createColumn();
    const card = await createCard(column.id);
    await request(app).delete(`/api/cards/${card.id}`).expect(204);
    await request(app).delete(`/api/cards/${card.id}`).expect(204);
    expect((await getBoard()).cards.some((item) => item.id === card.id)).toBe(false);
  });

  it("DELETE coluna apaga cartões e associações em cascata e é idempotente", async () => {
    const column = await createColumn();
    const tag = await createTag();
    const card = await createCard(column.id, [tag.id]);
    await request(app).delete(`/api/columns/${column.id}`).expect(204);
    await request(app).delete(`/api/columns/${column.id}`).expect(204);
    const board = await getBoard();
    expect(board.columns.some((item) => item.id === column.id)).toBe(false);
    expect(board.cards.some((item) => item.id === card.id)).toBe(false);
    const associations = await query("select card_id from card_tags where card_id = $1", [card.id]);
    expect(associations.rows).toEqual([]);
  });

  it("DELETE tag remove associações, preserva o cartão e é idempotente", async () => {
    const column = await createColumn();
    const tag = await createTag();
    const card = await createCard(column.id, [tag.id]);
    await request(app).delete(`/api/tags/${tag.id}`).expect(204);
    await request(app).delete(`/api/tags/${tag.id}`).expect(204);
    const board = await getBoard();
    expect(board.tags.some((item) => item.id === tag.id)).toBe(false);
    expect(board.cards.find((item) => item.id === card.id)?.tagIds).toEqual([]);
    const associations = await query("select tag_id from card_tags where tag_id = $1", [tag.id]);
    expect(associations.rows).toEqual([]);
  });
});
