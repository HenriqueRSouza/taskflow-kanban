import { ColumnIdSchema, ColumnSchema, UpsertColumnSchema } from "@taskflow/shared";
import { Router } from "express";
import type { z } from "zod";
import { BOARD_ID } from "../board-id.ts";
import { query } from "../db.ts";
import { parseBody, parseId } from "../http.ts";

export const columnsRouter = Router();

columnsRouter.put("/:id", async (req, res) => {
  const id = parseId(ColumnIdSchema, req.params.id);
  const body = parseBody(UpsertColumnSchema, req);
  const result = await query<z.input<typeof ColumnSchema>>(
    `insert into columns (id, board_id, title, position) values ($1, $2, $3, $4)
     on conflict (id) do update set board_id = excluded.board_id,
       title = excluded.title, position = excluded.position
     returning id, title, position`,
    [id, BOARD_ID, body.title, body.position],
  );
  res.json(ColumnSchema.parse(result.rows[0]));
});

columnsRouter.delete("/:id", async (req, res) => {
  const id = parseId(ColumnIdSchema, req.params.id);
  await query("delete from columns where id = $1", [id]);
  res.status(204).end();
});
