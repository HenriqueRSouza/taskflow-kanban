import { CardIdSchema, CardSchema, UpsertCardSchema } from "@taskflow/shared";
import { Router } from "express";
import type { z } from "zod";
import { pool, query } from "../db.ts";
import { parseBody, parseId } from "../http.ts";

type CardRow = Omit<z.input<typeof CardSchema>, "tagIds" | "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

export const cardsRouter = Router();

cardsRouter.put("/:id", async (req, res) => {
  const id = parseId(CardIdSchema, req.params.id);
  const body = parseBody(UpsertCardSchema, req);
  const tagIds = [...new Set(body.tagIds)].sort();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<CardRow>(
      `insert into cards (id, column_id, title, description, position)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set column_id = excluded.column_id,
         title = excluded.title, description = excluded.description,
         position = excluded.position, updated_at = now()
       returning id, column_id as "columnId", title, description, position,
         created_at as "createdAt", updated_at as "updatedAt"`,
      [id, body.columnId, body.title, body.description, body.position],
    );
    await client.query("delete from card_tags where card_id = $1", [id]);
    await client.query(
      "insert into card_tags (card_id, tag_id) select $1, unnest($2::uuid[])",
      [id, tagIds],
    );
    const row = result.rows[0];
    const card = CardSchema.parse({
      ...row,
      tagIds,
      createdAt: row?.createdAt.toISOString(),
      updatedAt: row?.updatedAt.toISOString(),
    });
    await client.query("commit");
    res.json(card);
  } catch (error: unknown) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

cardsRouter.delete("/:id", async (req, res) => {
  const id = parseId(CardIdSchema, req.params.id);
  await query("delete from cards where id = $1", [id]);
  res.status(204).end();
});
