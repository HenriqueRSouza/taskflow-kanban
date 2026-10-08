import { CardHistorySchema, CardIdSchema, CardSchema, UpsertCardSchema } from "@taskflow/shared";
import { Router } from "express";
import type { z } from "zod";
import { pool, query } from "../db.ts";
import { HttpError, parseBody, parseId } from "../http.ts";

type CardRow = Omit<z.input<typeof CardSchema>, "tagIds" | "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

export const cardsRouter = Router();

cardsRouter.get("/:id/history", async (req, res) => {
  const id = parseId(CardIdSchema, req.params.id);
  const card = await query("select id from cards where id = $1", [id]);
  if (card.rows.length === 0) throw new HttpError(404, "Cartão não encontrado");

  const events = await query<
    Omit<z.input<typeof CardHistorySchema>[number], "id" | "occurredAt"> & {
      id: string;
      occurredAt: Date;
    }
  >(
    `select id, card_id as "cardId", type,
       from_column_id as "fromColumnId", from_column_title as "fromColumnTitle",
       to_column_id as "toColumnId", to_column_title as "toColumnTitle",
       occurred_at as "occurredAt"
     from card_events where card_id = $1 order by occurred_at, id`,
    [id],
  );
  res.json(CardHistorySchema.parse(events.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    occurredAt: event.occurredAt.toISOString(),
  }))));
});

cardsRouter.put("/:id", async (req, res) => {
  const id = parseId(CardIdSchema, req.params.id);
  const body = parseBody(UpsertCardSchema, req);
  const tagIds = [...new Set(body.tagIds)].sort();
  const client = await pool.connect();
  let failure: unknown;
  try {
    await client.query("begin");
    const result = await client.query<CardRow>(
      `insert into cards (id, column_id, title, description, position, created_at, updated_at)
       values ($1, $2, $3, $4, $5,
         least(coalesce($6::timestamptz, now()), now()),
         least(coalesce($7::timestamptz, now()), now()))
       on conflict (id) do update set column_id = excluded.column_id,
         title = excluded.title, description = excluded.description,
         position = excluded.position, updated_at = excluded.updated_at
       returning id, column_id as "columnId", title, description, position,
         created_at as "createdAt", updated_at as "updatedAt"`,
      [id, body.columnId, body.title, body.description, body.position,
        body.createdAt ?? null, body.updatedAt ?? null],
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
    failure = error;
    // Se o rollback também falhar (conexão caída), não esconde o erro original.
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    // release(erro) descarta a conexão em vez de devolvê-la quebrada ao pool.
    client.release(failure instanceof Error ? failure : undefined);
  }
});

cardsRouter.delete("/:id", async (req, res) => {
  const id = parseId(CardIdSchema, req.params.id);
  await query("delete from cards where id = $1", [id]);
  res.status(204).end();
});
