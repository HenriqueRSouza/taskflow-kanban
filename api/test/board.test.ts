import { BoardSnapshotSchema, CreateColumnSchema } from "@taskflow/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { pool } from "../src/db.ts";
import { HttpError, parseBody } from "../src/http.ts";

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe("Validação do corpo HTTP", () => {
  it("retorna o corpo validado pelo schema compartilhado", () => {
    const body = parseBody(CreateColumnSchema, {
      body: { title: "  A Fazer  ", position: 1, extra: true },
    });
    expect(body).toEqual({ title: "A Fazer", position: 1 });
  });

  it("lança HTTP 400 com a mensagem do primeiro erro de validação", () => {
    const parse = () => parseBody(CreateColumnSchema, {
      body: { title: "", position: 1 },
    });
    expect(parse).toThrow(HttpError);
    expect(parse).toThrow("Título obrigatório");
    try {
      parse();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpError);
      if (error instanceof HttpError) expect(error.status).toBe(400);
    }
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Quadro com PostgreSQL real", () => {
  it("GET /api/health verifica a conexão com o banco", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("GET /api/board retorna o contrato compartilhado e listas ordenadas", async () => {
    const response = await request(app).get("/api/board").expect(200);
    const snapshot = BoardSnapshotSchema.parse(response.body);
    expect(snapshot.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(snapshot.columns.length).toBeGreaterThan(0);
    const positions = snapshot.columns.map((column) => column.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    const orderedCardIds = snapshot.columns.flatMap((column) => {
      const cards = snapshot.cards.filter((card) => card.columnId === column.id);
      const cardPositions = cards.map((card) => card.position);
      expect(cardPositions).toEqual([...cardPositions].sort((a, b) => a - b));
      return cards.map((card) => card.id);
    });
    expect(snapshot.cards.map((card) => card.id)).toEqual(orderedCardIds);
    for (const card of snapshot.cards) {
      expect(card.createdAt).toBe(new Date(card.createdAt).toISOString());
      expect(card.updatedAt).toBe(new Date(card.updatedAt).toISOString());
      for (const tagId of card.tagIds) {
        expect(snapshot.tags.some((tag) => tag.id === tagId)).toBe(true);
      }
    }
  });
});
