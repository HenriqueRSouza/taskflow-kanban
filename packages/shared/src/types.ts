import type { z } from "zod";
import type {
  BoardIdSchema,
  BoardSnapshotSchema,
  CardEventSchema,
  CardIdSchema,
  CardSchema,
  ColumnIdSchema,
  ColumnSchema,
  TagColorSchema,
  TagIdSchema,
  TagSchema,
  UpsertCardSchema,
  UpsertColumnSchema,
  UpsertTagSchema,
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
export type CardEvent = z.infer<typeof CardEventSchema>;

export type UpsertColumnInput = z.infer<typeof UpsertColumnSchema>;
export type UpsertCardInput = z.infer<typeof UpsertCardSchema>;
export type UpsertTagInput = z.infer<typeof UpsertTagSchema>;

/** Estado de sincronização de um item com a API — união discriminada. */
export type SyncState =
  | { status: "synced" }
  | { status: "pending"; since: string }
  | { status: "error"; message: string };
