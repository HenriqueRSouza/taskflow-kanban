import { BoardSnapshotSchema } from "@taskflow/shared";
import { Router } from "express";
import type { z } from "zod";
import { query } from "../db.ts";
import { HttpError } from "../http.ts";

const BOARD_ID = "00000000-0000-4000-8000-000000000001";
type SnapshotInput = z.input<typeof BoardSnapshotSchema>;
type BoardRow = Pick<SnapshotInput, "id" | "title">;
type ColumnRow = SnapshotInput["columns"][number];
type TagRow = SnapshotInput["tags"][number];
type CardRow = Omit<
  SnapshotInput["cards"][number],
  "columnId" | "tagIds" | "createdAt" | "updatedAt"
> & {
  column_id: string;
  tag_ids: string[];
  created_at: Date;
  updated_at: Date;
};

export const boardRouter = Router();

boardRouter.get("/health", async (_req, res) => {
  await query("select 1");
  res.json({ ok: true });
});

boardRouter.get("/board", async (_req, res) => {
  const boardResult = await query<BoardRow>(
    "select id, title from boards where id = $1",
    [BOARD_ID],
  );
  const board = boardResult.rows[0];
  if (!board) throw new HttpError(404, "Quadro não encontrado");

  const [columns, cards, tags] = await Promise.all([
    query<ColumnRow>(
      "select id, title, position from columns where board_id = $1 order by position, id",
      [BOARD_ID],
    ),
    query<CardRow>(
      `select c.id, c.column_id, c.title, c.description, c.position,
              c.created_at, c.updated_at,
              coalesce(array_agg(ct.tag_id order by ct.tag_id)
                filter (where ct.tag_id is not null), '{}') as tag_ids
       from cards c
       join columns col on col.id = c.column_id
       left join card_tags ct on ct.card_id = c.id
       where col.board_id = $1
       group by c.id, col.position, col.id
       order by col.position, col.id, c.position, c.id`,
      [BOARD_ID],
    ),
    query<TagRow>(
      "select id, name, color from tags where board_id = $1 order by name, id",
      [BOARD_ID],
    ),
  ]);

  const snapshot = BoardSnapshotSchema.parse({
    ...board,
    columns: columns.rows,
    cards: cards.rows.map((card) => ({
      id: card.id,
      columnId: card.column_id,
      title: card.title,
      description: card.description,
      position: card.position,
      tagIds: card.tag_ids,
      createdAt: card.created_at.toISOString(),
      updatedAt: card.updated_at.toISOString(),
    })),
    tags: tags.rows,
  });
  res.json(snapshot);
});
