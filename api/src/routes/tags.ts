import { TagIdSchema, TagSchema, UpsertTagSchema } from "@taskflow/shared";
import { Router } from "express";
import type { z } from "zod";
import { BOARD_ID } from "../board-id.ts";
import { query } from "../db.ts";
import { parseBody, parseId } from "../http.ts";

export const tagsRouter = Router();

tagsRouter.put("/:id", async (req, res) => {
  const id = parseId(TagIdSchema, req.params.id);
  const body = parseBody(UpsertTagSchema, req);
  const result = await query<z.input<typeof TagSchema>>(
    `insert into tags (id, board_id, name, color) values ($1, $2, $3, $4)
     on conflict (id) do update set board_id = excluded.board_id,
       name = excluded.name, color = excluded.color
     returning id, name, color`,
    [id, BOARD_ID, body.name, body.color],
  );
  res.json(TagSchema.parse(result.rows[0]));
});

tagsRouter.delete("/:id", async (req, res) => {
  const id = parseId(TagIdSchema, req.params.id);
  await query("delete from tags where id = $1", [id]);
  res.status(204).end();
});
