import type { z } from "zod";
import type {
  BoardIdSchema,
  BoardSnapshotSchema,
  CardIdSchema,
  CardSchema,
  ColumnIdSchema,
  ColumnSchema,
  CreateCardSchema,
  CreateColumnSchema,
  CreateTagSchema,
  SetCardTagsSchema,
  TagColorSchema,
  TagIdSchema,
  TagSchema,
  UpdateCardSchema,
  UpdateColumnSchema,
} from "./schemas.ts";

export type BoardId = z.infer<typeof BoardIdSchema>;
export type ColumnId = z.infer<typeof ColumnIdSchema>;
export type CardId = z.infer<typeof CardIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;

export type TagColor = z.infer<typeof TagColorSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Card = z.infer<typeof CardSchema>;
export type BoardSnapshot = z.infer<typeof BoardSnapshotSchema>;

export type CreateColumnInput = z.infer<typeof CreateColumnSchema>;
export type UpdateColumnInput = z.infer<typeof UpdateColumnSchema>;
export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type SetCardTagsInput = z.infer<typeof SetCardTagsSchema>;

/** Estado de sincronização de um item com a API — união discriminada. */
export type SyncState =
  | { status: "synced" }
  | { status: "pending"; since: string }
  | { status: "error"; message: string };
