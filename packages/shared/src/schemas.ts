import { z } from "zod";

/*
 * Fonte única da verdade dos dados do TaskFlow.
 * Os tipos TypeScript são derivados destes schemas (z.infer), então front-end
 * e API validam e tipam exatamente a mesma coisa.
 */

// IDs "marcados" (branded): impedem passar o ID de um cartão onde se espera o
// de uma coluna, mesmo sendo todos strings em tempo de execução.
export const BoardIdSchema = z.uuid().brand<"BoardId">();
export const ColumnIdSchema = z.uuid().brand<"ColumnId">();
export const CardIdSchema = z.uuid().brand<"CardId">();
export const TagIdSchema = z.uuid().brand<"TagId">();

export const TAG_COLORS = ["yellow", "black", "gray", "green", "red", "blue"] as const;
export const TagColorSchema = z.enum(TAG_COLORS);

export const TITLE_LIMITS = { column: 80, card: 200, tag: 30 } as const;

const title = (max: number) => z.string().trim().min(1, "Título obrigatório").max(max);

export const TagSchema = z.object({
  id: TagIdSchema,
  name: title(TITLE_LIMITS.tag),
  color: TagColorSchema,
});

export const ColumnSchema = z.object({
  id: ColumnIdSchema,
  title: title(TITLE_LIMITS.column),
  position: z.number().finite(),
});

export const CardSchema = z.object({
  id: CardIdSchema,
  columnId: ColumnIdSchema,
  title: title(TITLE_LIMITS.card),
  description: z.string().max(5000).nullable(),
  tagIds: z.array(TagIdSchema),
  position: z.number().finite(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

/** Resposta de GET /api/board: o quadro inteiro em listas "planas". */
export const BoardSnapshotSchema = z.object({
  id: BoardIdSchema,
  title: z.string(),
  columns: z.array(ColumnSchema),
  cards: z.array(CardSchema),
  tags: z.array(TagSchema),
});

// ---- Corpos de requisição da API ----
// O cliente pode gerar o próprio UUID (crypto.randomUUID) para permitir a
// criação otimista/offline; se omitido, o banco gera.

export const CreateColumnSchema = z.object({
  id: ColumnIdSchema.optional(),
  title: ColumnSchema.shape.title,
  position: ColumnSchema.shape.position,
});

export const UpdateColumnSchema = CreateColumnSchema.omit({ id: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nada para atualizar");

export const CreateCardSchema = z.object({
  id: CardIdSchema.optional(),
  columnId: ColumnIdSchema,
  title: CardSchema.shape.title,
  description: CardSchema.shape.description.optional(),
  position: CardSchema.shape.position,
});

export const UpdateCardSchema = CreateCardSchema.omit({ id: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nada para atualizar");

export const CreateTagSchema = z.object({
  id: TagIdSchema.optional(),
  name: TagSchema.shape.name,
  color: TagColorSchema,
});

export const SetCardTagsSchema = z.object({
  tagIds: z.array(TagIdSchema),
});

export const ApiErrorSchema = z.object({ error: z.string() });
